package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"github.com/roman/trainer/backend/ai"
	"github.com/roman/trainer/backend/domain"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type App struct {
	DB        *gorm.DB
	AIService ai.AIService
	Router    *chi.Mux
}

func main() {
	godotenv.Load()

	db, err := gorm.Open(sqlite.Open("../user-data/trainer.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("failed to connect database")
	}

	// Auto migrate
	db.AutoMigrate(&domain.Profile{}, &domain.Tutorial{}, &domain.Progress{})

	// Initialize AI Service
	apiKey := os.Getenv("AI_API_KEY") // Changed from GEMINI_API_KEY
	if apiKey == "" {
		// Fallback for backward compatibility or dev environment
		apiKey = os.Getenv("GEMINI_API_KEY")
	}

	baseURL := os.Getenv("AI_BASE_URL")
	model := os.Getenv("AI_MODEL")

	// Default to generic OpenAI client which works for DeepSeek/Qwen too
	log.Printf("Initializing AI Client...")
	log.Printf("Base URL: '%s'", baseURL)
	log.Printf("Model: '%s'", model)
	if len(apiKey) > 4 {
		log.Printf("API Key: '%s...'", apiKey[:4])
	} else {
		log.Printf("API Key: [EMPTY/SHORT]")
	}

	aiClient := ai.NewOpenAIClient(apiKey, baseURL, model)

	app := &App{
		DB:        db,
		AIService: aiClient,
		Router:    chi.NewRouter(),
	}

	// Setup Middleware
	app.Router.Use(middleware.Logger)
	app.Router.Use(middleware.Recoverer)
	app.Router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	app.Routes()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, app.Router))
}
