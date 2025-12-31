package ai

import (
	"context"
	"fmt"

	"github.com/roman/trainer/backend/domain"
	openai "github.com/sashabaranov/go-openai"
)

type OpenAIClient struct {
	client *openai.Client
	model  string
}

func NewOpenAIClient(apiKey string, baseURL string, model string) *OpenAIClient {
	config := openai.DefaultConfig(apiKey)
	if baseURL != "" {
		config.BaseURL = baseURL
	}
	client := openai.NewClientWithConfig(config)

	if model == "" {
		model = openai.GPT3Dot5Turbo // Default fallback
	}

	return &OpenAIClient{
		client: client,
		model:  model,
	}
}

// GenerateTutorial генерирует персонализированный туториал
func (c *OpenAIClient) GenerateTutorial(ctx context.Context, profile domain.Profile, codeContext string, userRequest string) (string, error) {
	prompt := fmt.Sprintf(`
You are an expert programming tutor. Create a personalized tutorial based on the user's profile and code context.

USER PROFILE:
Background: %s
Goals: %s

CODE CONTEXT (from user's project):
%s

USER SPECIFIC REQUEST:
%s

GUIDELINES:
1. Use the provided code context for practical examples.
2. Explain concepts starting from what the user already knows (based on their background).
3. Keep it interactive and encouraging.
4. Format the output in Markdown with clear headers.
5. Include a "Key Takeaways" section at the end.
`, profile.Background, profile.Goals, codeContext, userRequest)

	resp, err := c.client.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model: c.model,
			Messages: []openai.ChatCompletionMessage{
				{
					Role:    openai.ChatMessageRoleSystem,
					Content: "You are a helpful and expert coding assistant.",
				},
				{
					Role:    openai.ChatMessageRoleUser,
					Content: prompt,
				},
			},
		},
	)

	if err != nil {
		return "", fmt.Errorf("OpenAI API error: %v", err)
	}

	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no response from AI")
	}

	return resp.Choices[0].Message.Content, nil
}

// ExtractTopicFromContent пытается извлечь тему из контента
func ExtractTopicFromContent(content string) string {
	// Простая реализация - можно расширить
	return "General Programming"
}
