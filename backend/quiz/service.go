package quiz

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/roman/trainer/backend/ai"
	"github.com/roman/trainer/backend/domain"
	"gorm.io/gorm"
)

// Service управляет генерацией и проверкой квизов
type Service struct {
	db        *gorm.DB
	aiService ai.AIService
}

// NewService создает новый экземпляр Quiz Service
func NewService(db *gorm.DB, aiService ai.AIService) *Service {
	return &Service{
		db:        db,
		aiService: aiService,
	}
}

// GenerateQuiz генерирует тест на основе туториала
func (s *Service) GenerateQuiz(ctx context.Context, tutorialID uint, difficulty string) (*domain.Quiz, error) {
	var tutorial domain.Tutorial
	if err := s.db.First(&tutorial, tutorialID).Error; err != nil {
		return nil, fmt.Errorf("tutorial not found: %w", err)
	}

	// Генерируем вопросы через AI
	questions, err := s.generateQuestionsWithAI(ctx, tutorial, difficulty)
	if err != nil {
		return nil, fmt.Errorf("failed to generate questions: %w", err)
	}

	quiz := &domain.Quiz{
		TutorialID: tutorialID,
		Topic:      tutorial.Topic,
		Title:      fmt.Sprintf("Quiz: %s", tutorial.Title),
		Difficulty: difficulty,
	}

	if err := quiz.SetQuestions(questions); err != nil {
		return nil, fmt.Errorf("failed to serialize questions: %w", err)
	}

	if err := s.db.Create(quiz).Error; err != nil {
		return nil, fmt.Errorf("failed to save quiz: %w", err)
	}

	return quiz, nil
}

// generateQuestionsWithAI использует AI для генерации вопросов
func (s *Service) generateQuestionsWithAI(ctx context.Context, tutorial domain.Tutorial, difficulty string) ([]domain.QuizQuestion, error) {
	// Определяем количество вопросов и типы в зависимости от сложности
	questionCount := 5
	if difficulty == "advanced" || difficulty == "expert" {
		questionCount = 7
	}

	prompt := fmt.Sprintf(`You are an expert at creating educational quizzes. Generate a quiz based on the following tutorial.

TUTORIAL TOPIC: %s
TUTORIAL CONTENT:
%s

DIFFICULTY LEVEL: %s

Generate EXACTLY %d questions. Each question must be in valid JSON format.

INSTRUCTIONS:
1. Create questions that test understanding, not just memorization
2. For difficulty levels:
   - basic: Focus on definitions and simple concepts
   - intermediate: Focus on application and practical examples
   - advanced: Focus on analysis and problem-solving
   - expert: Focus on edge cases and optimization

3. Use these question types:
   - multiple_choice: Question with 4 options (A, B, C, D)
   - true_false: True/False question
   - code_completion: Complete the code snippet
   - free_text: Short answer question

4. Return ONLY a valid JSON array with this structure:
[
  {
    "id": 1,
    "question": "What is...",
    "type": "multiple_choice",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Option B",
    "explanation": "Brief explanation why this is correct",
    "points": 10
  }
]

IMPORTANT: 
- Return ONLY the JSON array, no markdown formatting, no backticks
- Make sure "correct_answer" exactly matches one of the options
- Each question should have points (10 for basic, 15 for intermediate, 20 for advanced)
- Explanation should be concise but informative`, tutorial.Topic, tutorial.Content, difficulty, questionCount)

	response, err := s.aiService.GenerateTutorial(ctx, domain.Profile{}, "", prompt)
	if err != nil {
		return nil, err
	}

	// Очищаем response от markdown форматирования если есть
	response = strings.TrimSpace(response)
	response = strings.TrimPrefix(response, "```json")
	response = strings.TrimPrefix(response, "```")
	response = strings.TrimSuffix(response, "```")
	response = strings.TrimSpace(response)

	// Парсим JSON
	var questions []domain.QuizQuestion
	if err := json.Unmarshal([]byte(response), &questions); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %w\nResponse: %s", err, response)
	}

	return questions, nil
}

// SubmitQuiz проверяет ответы и создает submission
func (s *Service) SubmitQuiz(ctx context.Context, quizID uint, answers []domain.QuizAnswer) (*domain.QuizSubmission, error) {
	var quiz domain.Quiz
	if err := s.db.First(&quiz, quizID).Error; err != nil {
		return nil, fmt.Errorf("quiz not found: %w", err)
	}

	questions, err := quiz.GetQuestions()
	if err != nil {
		return nil, fmt.Errorf("failed to get questions: %w", err)
	}

	// Проверяем ответы
	correctCount := 0
	maxScore := 0
	userScore := 0
	feedback := strings.Builder{}

	for i, question := range questions {
		maxScore += question.Points

		// Находим ответ пользователя
		var userAnswer *domain.QuizAnswer
		for j := range answers {
			if answers[j].QuestionID == question.ID {
				userAnswer = &answers[j]
				break
			}
		}

		if userAnswer == nil {
			feedback.WriteString(fmt.Sprintf("Question %d: No answer provided\n", question.ID))
			continue
		}

		// Проверяем правильность
		isCorrect := s.checkAnswer(question, userAnswer.Answer)
		answers[i].IsCorrect = isCorrect

		if isCorrect {
			correctCount++
			userScore += question.Points
			feedback.WriteString(fmt.Sprintf("✓ Question %d: Correct! %s\n", question.ID, question.Explanation))
		} else {
			feedback.WriteString(fmt.Sprintf("✗ Question %d: Incorrect. %s\nCorrect answer: %s\n", 
				question.ID, question.Explanation, question.CorrectAnswer))
		}
	}

	// Вычисляем финальную оценку (0.0 - 1.0)
	score := 0.0
	if maxScore > 0 {
		score = float64(userScore) / float64(maxScore)
	}

	passed := score >= 0.7 // 70% для прохождения

	submission := &domain.QuizSubmission{
		QuizID:   quizID,
		Score:    score,
		MaxScore: maxScore,
		Passed:   passed,
		Feedback: feedback.String(),
	}

	if err := submission.SetAnswers(answers); err != nil {
		return nil, fmt.Errorf("failed to serialize answers: %w", err)
	}

	if err := s.db.Create(submission).Error; err != nil {
		return nil, fmt.Errorf("failed to save submission: %w", err)
	}

	return submission, nil
}

// checkAnswer проверяет правильность ответа
func (s *Service) checkAnswer(question domain.QuizQuestion, userAnswer string) bool {
	userAnswer = strings.TrimSpace(strings.ToLower(userAnswer))
	correctAnswer := strings.TrimSpace(strings.ToLower(question.CorrectAnswer))

	switch question.Type {
	case "multiple_choice":
		return userAnswer == correctAnswer
	case "true_false":
		return userAnswer == correctAnswer
	case "code_completion":
		// Для кода делаем более мягкую проверку
		return strings.Contains(strings.ReplaceAll(userAnswer, " ", ""), 
			strings.ReplaceAll(correctAnswer, " ", ""))
	case "free_text":
		// Для свободного текста проверяем ключевые слова
		return s.checkFreeTextAnswer(correctAnswer, userAnswer)
	default:
		return false
	}
}

// checkFreeTextAnswer проверяет ответ со свободным текстом
func (s *Service) checkFreeTextAnswer(correct, user string) bool {
	// Извлекаем ключевые слова из правильного ответа
	correctWords := strings.Fields(correct)
	
	matchCount := 0
	for _, word := range correctWords {
		if len(word) <= 3 { // Игнорируем короткие слова
			continue
		}
		if strings.Contains(user, word) {
			matchCount++
		}
	}

	// Считаем правильным если совпадают 60% ключевых слов
	threshold := float64(len(correctWords)) * 0.6
	return float64(matchCount) >= threshold
}

// GetQuiz возвращает квиз по ID
func (s *Service) GetQuiz(quizID uint) (*domain.Quiz, error) {
	var quiz domain.Quiz
	if err := s.db.First(&quiz, quizID).Error; err != nil {
		return nil, err
	}
	return &quiz, nil
}

// GetQuizzesByTutorial возвращает все квизы для туториала
func (s *Service) GetQuizzesByTutorial(tutorialID uint) ([]domain.Quiz, error) {
	var quizzes []domain.Quiz
	err := s.db.Where("tutorial_id = ?", tutorialID).Find(&quizzes).Error
	return quizzes, err
}

// GetSubmissionsByQuiz возвращает все сдачи квиза
func (s *Service) GetSubmissionsByQuiz(quizID uint) ([]domain.QuizSubmission, error) {
	var submissions []domain.QuizSubmission
	err := s.db.Where("quiz_id = ?", quizID).Order("created_at DESC").Find(&submissions).Error
	return submissions, err
}

// GetBestSubmission возвращает лучшую попытку прохождения квиза
func (s *Service) GetBestSubmission(quizID uint) (*domain.QuizSubmission, error) {
	var submission domain.QuizSubmission
	err := s.db.Where("quiz_id = ?", quizID).
		Order("score DESC").
		First(&submission).Error
	
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &submission, err
}
