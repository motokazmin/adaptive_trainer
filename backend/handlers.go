package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/roman/trainer/backend/ai"
	"github.com/roman/trainer/backend/domain"
	"github.com/roman/trainer/backend/scanner"
)

func (a *App) Routes() {
	a.Router.Route("/api", func(r chi.Router) {
		r.Route("/profile", func(r chi.Router) {
			r.Get("/", a.getProfile)
			r.Post("/", a.updateProfile)
		})
		r.Route("/tutorials", func(r chi.Router) {
			r.Get("/", a.listTutorials)
			r.Post("/generate", a.generateTutorial)
			r.Get("/{id}", a.getTutorial)
			r.Delete("/{id}", a.deleteTutorial)
		})
		r.Route("/quizzes", func(r chi.Router) {
			r.Post("/generate", a.generateQuiz)
			r.Get("/{id}", a.getQuiz)
			r.Post("/{id}/submit", a.submitQuiz)
			r.Get("/tutorial/{tutorialId}", a.getQuizzesByTutorial)
		})
		r.Route("/progress", func(r chi.Router) {
			r.Get("/", a.getProgress)
			r.Get("/stats", a.getProgressStats)
			r.Get("/weak", a.getWeakTopics)
			r.Get("/review", a.getTopicsForReview)
			r.Get("/path", a.getLearningPath)
			r.Delete("/{topic}", a.resetProgress)
		})
		r.Route("/project", func(r chi.Router) {
			r.Post("/analyze", a.analyzeProject)
		})
	})
}

// ==================== Profile Handlers ====================

func (a *App) getProfile(w http.ResponseWriter, r *http.Request) {
	var profile domain.Profile
	if err := a.DB.First(&profile).Error; err != nil {
		http.Error(w, "Profile not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(profile)
}

func (a *App) updateProfile(w http.ResponseWriter, r *http.Request) {
	var profile domain.Profile
	if err := json.NewDecoder(r.Body).Decode(&profile); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// upsert
	var existing domain.Profile
	if err := a.DB.First(&existing).Error; err == nil {
		profile.ID = existing.ID
		a.DB.Save(&profile)
	} else {
		a.DB.Create(&profile)
	}

	json.NewEncoder(w).Encode(profile)
}

// ==================== Tutorial Handlers ====================

func (a *App) listTutorials(w http.ResponseWriter, r *http.Request) {
	var tutorials []domain.Tutorial
	a.DB.Order("created_at desc").Find(&tutorials)
	json.NewEncoder(w).Encode(tutorials)
}

func (a *App) generateTutorial(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserRequest string `json:"user_request"`
		CodeContext string `json:"code_context"`
		ProjectPath string `json:"project_path"`
		Topic       string `json:"topic"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var profile domain.Profile
	if err := a.DB.First(&profile).Error; err != nil {
		http.Error(w, "Please complete onboarding first", http.StatusPreconditionFailed)
		return
	}

	if a.AIService == nil {
		http.Error(w, "AI Service not configured", http.StatusInternalServerError)
		return
	}

	// Сканируем проект с улучшенным сканером
	scanPath := req.ProjectPath
	if scanPath == "" {
		scanPath = ".."
	}

	// Раскрываем тильду в пути
	scanPath = expandPath(scanPath)

	log.Printf("Scanning project at: %s", scanPath)

	// Используем умный сканер с ограничением токенов
	projectContext, err := scanner.SmartScanWithLimit(scanPath, 30000)
	if err != nil {
		log.Printf("Error scanning project: %v", err)
		projectContext = ""
	}

	// Получаем анализ структуры проекта
	projectSummary, err := scanner.GetProjectSummary(scanPath)
	if err != nil {
		log.Printf("Error analyzing project: %v", err)
		projectSummary = ""
	}

	// Комбинируем контекст
	fullContext := fmt.Sprintf("%s\n\n%s\n\nUSER SELECTED:\n%s",
		projectSummary, projectContext, req.CodeContext)

	log.Printf("Context size: %d characters", len(fullContext))

	// Проверяем прогресс по теме
	topic := req.Topic
	if topic == "" {
		topic = "General Programming"
	}

	// Логируем существующий прогресс если есть
	prog := domain.Progress{}
	if err := a.DB.Where("topic = ?", topic).First(&prog).Error; err == nil {
		log.Printf("Found existing progress for topic '%s': %.2f", topic, prog.MasteryScore)
	} else {
		log.Printf("No existing progress for topic '%s', starting fresh", topic)
	}

	// Генерируем туториал (базовый метод, работает для всех провайдеров)
	content, err := a.AIService.GenerateTutorial(r.Context(), profile, fullContext, req.UserRequest)

	if err != nil {
		log.Printf("Error generating tutorial: %v", err)
		http.Error(w, "Error generating tutorial: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Извлекаем заголовок из контента
	title := ai.ExtractTopicFromContent(content)
	if title == "" || title == "General Programming" {
		// Используем topic который ввел пользователь
		title = topic
	}

	// Если всё ещё пустой, используем дефолт с топиком
	if title == "" {
		title = "Tutorial: " + topic
	}

	tutorial := domain.Tutorial{
		Title:   title,
		Content: content,
		Topic:   topic,
	}
	a.DB.Create(&tutorial)

	// Обновляем прогресс - начальный уровень 0.3 (beginner)
	if a.ProgressEngine != nil {
		if err := a.ProgressEngine.RecordLearning(topic, 0.3); err != nil {
			log.Printf("Error recording learning progress: %v", err)
		}
	}

	json.NewEncoder(w).Encode(tutorial)
}

func (a *App) getTutorial(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var tutorial domain.Tutorial
	if err := a.DB.First(&tutorial, id).Error; err != nil {
		http.Error(w, "Tutorial not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(tutorial)
}

func (a *App) deleteTutorial(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := a.DB.Delete(&domain.Tutorial{}, id).Error; err != nil {
		http.Error(w, "Failed to delete tutorial", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ==================== Quiz Handlers ====================

func (a *App) generateQuiz(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TutorialID uint   `json:"tutorial_id"`
		Difficulty string `json:"difficulty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Difficulty == "" {
		req.Difficulty = "intermediate"
	}

	quiz, err := a.QuizService.GenerateQuiz(r.Context(), req.TutorialID, req.Difficulty)
	if err != nil {
		log.Printf("Error generating quiz: %v", err)
		http.Error(w, "Error generating quiz: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Возвращаем квиз без правильных ответов
	response := struct {
		ID         uint                  `json:"id"`
		TutorialID uint                  `json:"tutorial_id"`
		Topic      string                `json:"topic"`
		Title      string                `json:"title"`
		Difficulty string                `json:"difficulty"`
		Questions  []domain.QuizQuestion `json:"questions"`
	}{
		ID:         quiz.ID,
		TutorialID: quiz.TutorialID,
		Topic:      quiz.Topic,
		Title:      quiz.Title,
		Difficulty: quiz.Difficulty,
	}

	questions, err := quiz.GetQuestionsForUser()
	if err != nil {
		http.Error(w, "Error processing quiz", http.StatusInternalServerError)
		return
	}
	response.Questions = questions

	json.NewEncoder(w).Encode(response)
}

func (a *App) getQuiz(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	quizID, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		http.Error(w, "Invalid quiz ID", http.StatusBadRequest)
		return
	}

	quiz, err := a.QuizService.GetQuiz(uint(quizID))
	if err != nil {
		http.Error(w, "Quiz not found", http.StatusNotFound)
		return
	}

	// Возвращаем без правильных ответов
	response := struct {
		ID         uint                  `json:"id"`
		TutorialID uint                  `json:"tutorial_id"`
		Topic      string                `json:"topic"`
		Title      string                `json:"title"`
		Difficulty string                `json:"difficulty"`
		Questions  []domain.QuizQuestion `json:"questions"`
	}{
		ID:         quiz.ID,
		TutorialID: quiz.TutorialID,
		Topic:      quiz.Topic,
		Title:      quiz.Title,
		Difficulty: quiz.Difficulty,
	}

	questions, err := quiz.GetQuestionsForUser()
	if err != nil {
		http.Error(w, "Error processing quiz", http.StatusInternalServerError)
		return
	}
	response.Questions = questions

	json.NewEncoder(w).Encode(response)
}

func (a *App) submitQuiz(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	quizID, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		http.Error(w, "Invalid quiz ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Answers []domain.QuizAnswer `json:"answers"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	submission, err := a.QuizService.SubmitQuiz(r.Context(), uint(quizID), req.Answers)
	if err != nil {
		log.Printf("Error submitting quiz: %v", err)
		http.Error(w, "Error submitting quiz: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Обновляем прогресс на основе результата квиза
	if a.ProgressEngine != nil {
		quiz, _ := a.QuizService.GetQuiz(uint(quizID))
		if quiz != nil {
			if err := a.ProgressEngine.UpdateMastery(quiz.Topic, submission.Score, submission.Passed); err != nil {
				log.Printf("Error updating mastery: %v", err)
			}
		}
	}

	json.NewEncoder(w).Encode(submission)
}

func (a *App) getQuizzesByTutorial(w http.ResponseWriter, r *http.Request) {
	tutorialIDStr := chi.URLParam(r, "tutorialId")
	tutorialID, err := strconv.ParseUint(tutorialIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid tutorial ID", http.StatusBadRequest)
		return
	}

	quizzes, err := a.QuizService.GetQuizzesByTutorial(uint(tutorialID))
	if err != nil {
		http.Error(w, "Error fetching quizzes", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(quizzes)
}

// ==================== Progress Handlers ====================

func (a *App) getProgress(w http.ResponseWriter, r *http.Request) {
	if a.ProgressEngine == nil {
		http.Error(w, "Progress engine not initialized", http.StatusInternalServerError)
		return
	}

	progress, err := a.ProgressEngine.GetAllProgress()
	if err != nil {
		http.Error(w, "Error fetching progress", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(progress)
}

func (a *App) getProgressStats(w http.ResponseWriter, r *http.Request) {
	if a.ProgressEngine == nil {
		http.Error(w, "Progress engine not initialized", http.StatusInternalServerError)
		return
	}

	stats, err := a.ProgressEngine.GetProgressStats()
	if err != nil {
		http.Error(w, "Error fetching stats", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(stats)
}

func (a *App) getWeakTopics(w http.ResponseWriter, r *http.Request) {
	if a.ProgressEngine == nil {
		http.Error(w, "Progress engine not initialized", http.StatusInternalServerError)
		return
	}

	topics, err := a.ProgressEngine.GetWeakTopics(0.6, 10)
	if err != nil {
		http.Error(w, "Error fetching weak topics", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(topics)
}

func (a *App) getTopicsForReview(w http.ResponseWriter, r *http.Request) {
	if a.ProgressEngine == nil {
		http.Error(w, "Progress engine not initialized", http.StatusInternalServerError)
		return
	}

	topics, err := a.ProgressEngine.GetTopicsForReview()
	if err != nil {
		http.Error(w, "Error fetching topics for review", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(topics)
}

func (a *App) getLearningPath(w http.ResponseWriter, r *http.Request) {
	if a.ProgressEngine == nil {
		http.Error(w, "Progress engine not initialized", http.StatusInternalServerError)
		return
	}

	path, err := a.ProgressEngine.GetLearningPath()
	if err != nil {
		http.Error(w, "Error generating learning path", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"path": path,
	})
}

func (a *App) resetProgress(w http.ResponseWriter, r *http.Request) {
	topic := chi.URLParam(r, "topic")

	if a.ProgressEngine == nil {
		http.Error(w, "Progress engine not initialized", http.StatusInternalServerError)
		return
	}

	if err := a.ProgressEngine.ResetTopic(topic); err != nil {
		http.Error(w, "Error resetting progress", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ==================== Project Analysis Handler ====================

func (a *App) analyzeProject(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProjectPath string `json:"project_path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.ProjectPath == "" {
		req.ProjectPath = ".."
	}

	analysis, err := scanner.AnalyzeProject(req.ProjectPath)
	if err != nil {
		http.Error(w, "Error analyzing project: "+err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(analysis)
}

// expandPath раскрывает тильду (~) и относительные пути
func expandPath(path string) string {
	// Обработка тильды
	if strings.HasPrefix(path, "~/") {
		homeDir, err := os.UserHomeDir()
		if err == nil {
			path = filepath.Join(homeDir, path[2:])
		}
	}

	// Раскрываем относительный путь
	absPath, err := filepath.Abs(path)
	if err == nil {
		return absPath
	}

	return path
}
