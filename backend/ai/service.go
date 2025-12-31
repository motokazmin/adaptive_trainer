package ai

import (
	"context"

	"github.com/roman/trainer/backend/domain"
)

type AIService interface {
	GenerateTutorial(ctx context.Context, profile domain.Profile, codeContext string, userRequest string) (string, error)
}
