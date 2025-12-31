package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
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
		})
		r.Route("/quizzes", func(r chi.Router) {
			r.Post("/generate", a.generateQuiz)
			r.Post("/submit", a.submitQuiz)
		})
	})
}

// Profile Handlers
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

// Tutorial Handlers
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

	// Use injected AI service
	if a.AIService == nil {
		http.Error(w, "AI Service not configured", http.StatusInternalServerError)
		return
	}

	// Augment request with real project context
	// Augment request with real project context
	// Use provided project path or default to parent directory
	scanPath := req.ProjectPath
	if scanPath == "" {
		scanPath = ".."
	}

	log.Printf("Scanning project at: %s", scanPath)
	projectContext, err := scanner.ScanProject(scanPath)
	if err != nil {
		log.Printf("Error scanning project: %v", err)
		// Don't fail completely, just use provided context or empty
		log.Println("Continuing with limited context")
	}

	// Combine frontend context (if any) with project context
	fullContext := fmt.Sprintf("USER SELECTED:\n%s\n\nPROJECT FILES:\n%s", req.CodeContext, projectContext)
	log.Printf("Context size: %d characters", len(fullContext))

	content, err := a.AIService.GenerateTutorial(r.Context(), profile, fullContext, req.UserRequest)
	if err != nil {
		log.Printf("Error generating tutorial: %v", err)
		http.Error(w, "Error generating tutorial: "+err.Error(), http.StatusInternalServerError)
		return
	}

	tutorial := domain.Tutorial{
		Title:   "Generated Tutorial", // Could be extracted from content
		Content: content,
		Topic:   "General",
	}
	a.DB.Create(&tutorial)

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

// Placeholder for Quiz handlers - can be expanded later
func (a *App) generateQuiz(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNotImplemented)
}

func (a *App) submitQuiz(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNotImplemented)
}

// Add AIService to App struct
// Note: App struct definition is in main.go, but Go allows extension in same package.
// However, best to update main.go where struct is defined.
// Since we are rewriting this file, we assume App is defined elsewhere correctly.
