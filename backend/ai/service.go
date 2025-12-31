package ai

import (
	"context"

	"github.com/roman/trainer/backend/domain"
)

// AIService определяет интерфейс для работы с AI провайдерами
type AIService interface {
	// GenerateTutorial генерирует персонализированный туториал
	GenerateTutorial(ctx context.Context, profile domain.Profile, codeContext string, userRequest string) (string, error)
}

// AIServiceWithProgress расширенный интерфейс с поддержкой прогресса
// Опционально реализуется провайдерами для более персонализированного обучения
type AIServiceWithProgress interface {
	AIService

	// GenerateTutorialWithProgress генерирует туториал с учетом текущего прогресса
	GenerateTutorialWithProgress(ctx context.Context, profile domain.Profile, codeContext string, userRequest string, progress *domain.Progress) (string, error)
}

// AIServiceWithQuizGeneration интерфейс для генерации квизов
type AIServiceWithQuizGeneration interface {
	AIService

	// GenerateQuiz генерирует квиз на основе туториала
	GenerateQuiz(ctx context.Context, tutorial domain.Tutorial, difficulty string) ([]domain.QuizQuestion, error)
}
