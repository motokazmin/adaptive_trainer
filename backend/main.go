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
	"github.com/roman/trainer/backend/progress"
	"github.com/roman/trainer/backend/quiz"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type App struct {
	DB             *gorm.DB
	AIService      ai.AIService
	ProgressEngine *progress.Engine
	QuizService    *quiz.Service
	Router         *chi.Mux
}

func main() {
	godotenv.Load()

	db, err := gorm.Open(sqlite.Open("../user-data/trainer.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("failed to connect database")
	}

	// Auto migrate - добавляем новые модели
	db.AutoMigrate(
		&domain.Profile{},
		&domain.Tutorial{},
		&domain.Progress{},
		&domain.Quiz{},
		&domain.QuizSubmission{},
	)

	// Initialize AI Service
	apiKey := os.Getenv("AI_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("GEMINI_API_KEY") // Fallback
	}

	baseURL := os.Getenv("AI_BASE_URL")
	model := os.Getenv("AI_MODEL")

	log.Printf("Initializing AI Client...")
	log.Printf("Base URL: '%s'", baseURL)
	log.Printf("Model: '%s'", model)
	if len(apiKey) > 4 {
		log.Printf("API Key: '%s...'", apiKey[:4])
	} else {
		log.Printf("API Key: [EMPTY/SHORT]")
	}

	aiClient := ai.NewOpenAIClient(apiKey, baseURL, model)

	// Initialize Progress Engine
	progressEngine := progress.NewEngine(db)
	log.Printf("Progress Engine initialized")

	// Initialize Quiz Service
	quizService := quiz.NewService(db, aiClient)
	log.Printf("Quiz Service initialized")

	app := &App{
		DB:             db,
		AIService:      aiClient,
		ProgressEngine: progressEngine,
		QuizService:    quizService,
		Router:         chi.NewRouter(),
	}

	// Setup Middleware
	app.Router.Use(middleware.Logger)
	app.Router.Use(middleware.Recoverer)
	app.Router.Use(middleware.RequestID)
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

	log.Printf("✓ All systems initialized")
	log.Printf("✓ Server starting on port %s", port)
	log.Printf("✓ Available endpoints:")
	log.Printf("  - Profile: /api/profile")
	log.Printf("  - Tutorials: /api/tutorials")
	log.Printf("  - Quizzes: /api/quizzes")
	log.Printf("  - Progress: /api/progress")
	log.Printf("  - Project Analysis: /api/project/analyze")

	log.Fatal(http.ListenAndServe(":"+port, app.Router))
}
