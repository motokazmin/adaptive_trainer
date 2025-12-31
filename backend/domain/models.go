package domain

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// Profile представляет профиль пользователя
type Profile struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
	Name       string         `json:"name"`
	Background string         `gorm:"type:text" json:"background"` // Опыт и знания
	Goals      string         `gorm:"type:text" json:"goals"`      // Цели обучения
}

// Tutorial представляет учебный материал
type Tutorial struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
	Title      string         `json:"title"`
	Content    string         `gorm:"type:text" json:"content"`
	SourceRepo string         `json:"source_repo,omitempty"`
	Topic      string         `json:"topic"`      // Тема для связи с Progress
	Difficulty string         `json:"difficulty"` // basic, intermediate, advanced, expert
	Quizzes    []Quiz         `gorm:"foreignKey:TutorialID" json:"quizzes,omitempty"`
}

// Progress представляет прогресс изучения темы
type Progress struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	Topic        string         `gorm:"uniqueIndex" json:"topic"` // Уникальная тема
	MasteryScore float64        `json:"mastery_score"`            // 0.0 to 1.0
	LastReviewed time.Time      `json:"last_reviewed"`
	NextReview   time.Time      `json:"next_review"`
	IntervalDays int            `json:"interval_days"`
}

// Quiz представляет тест для проверки знаний
type Quiz struct {
	ID          uint             `gorm:"primaryKey" json:"id"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
	DeletedAt   gorm.DeletedAt   `gorm:"index" json:"-"`
	TutorialID  uint             `json:"tutorial_id" gorm:"index"`
	Tutorial    *Tutorial        `json:"tutorial,omitempty" gorm:"foreignKey:TutorialID"`
	Topic       string           `json:"topic" gorm:"index"`
	Title       string           `json:"title"`
	Questions   string           `gorm:"type:text" json:"-"` // JSON массив вопросов
	Difficulty  string           `json:"difficulty"`         // basic, intermediate, advanced, expert
	Submissions []QuizSubmission `gorm:"foreignKey:QuizID" json:"submissions,omitempty"`
}

// QuizQuestion представляет один вопрос в тесте
type QuizQuestion struct {
	ID            int      `json:"id"`
	Question      string   `json:"question"`
	Type          string   `json:"type"` // multiple_choice, true_false, code_completion, free_text
	Options       []string `json:"options,omitempty"`
	CorrectAnswer string   `json:"correct_answer,omitempty"` // Для проверки на сервере
	Explanation   string   `json:"explanation,omitempty"`
	Points        int      `json:"points"` // Вес вопроса
}

// QuizSubmission представляет сдачу теста
type QuizSubmission struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	QuizID    uint           `json:"quiz_id" gorm:"index"`
	Quiz      *Quiz          `json:"quiz,omitempty" gorm:"foreignKey:QuizID"`
	Answers   string         `gorm:"type:text" json:"-"` // JSON массив ответов
	Score     float64        `json:"score"`              // 0.0 - 1.0
	MaxScore  int            `json:"max_score"`
	Passed    bool           `json:"passed"`
	Feedback  string         `gorm:"type:text" json:"feedback"` // Детальная обратная связь
}

// QuizAnswer представляет ответ на вопрос
type QuizAnswer struct {
	QuestionID int    `json:"question_id"`
	Answer     string `json:"answer"`
	IsCorrect  bool   `json:"is_correct,omitempty"` // Заполняется сервером
}

// ==================== Quiz Methods ====================

// GetQuestions десериализует вопросы из JSON
func (q *Quiz) GetQuestions() ([]QuizQuestion, error) {
	var questions []QuizQuestion
	if err := json.Unmarshal([]byte(q.Questions), &questions); err != nil {
		return nil, err
	}
	return questions, nil
}

// SetQuestions сериализует вопросы в JSON
func (q *Quiz) SetQuestions(questions []QuizQuestion) error {
	data, err := json.Marshal(questions)
	if err != nil {
		return err
	}
	q.Questions = string(data)
	return nil
}

// GetQuestionsForUser возвращает вопросы без правильных ответов (для фронтенда)
func (q *Quiz) GetQuestionsForUser() ([]QuizQuestion, error) {
	questions, err := q.GetQuestions()
	if err != nil {
		return nil, err
	}

	// Убираем правильные ответы из вопросов для пользователя
	userQuestions := make([]QuizQuestion, len(questions))
	for i, question := range questions {
		userQuestions[i] = QuizQuestion{
			ID:       question.ID,
			Question: question.Question,
			Type:     question.Type,
			Options:  question.Options,
			Points:   question.Points,
		}
	}

	return userQuestions, nil
}

// ==================== QuizSubmission Methods ====================

// GetAnswers десериализует ответы из JSON
func (s *QuizSubmission) GetAnswers() ([]QuizAnswer, error) {
	var answers []QuizAnswer
	if err := json.Unmarshal([]byte(s.Answers), &answers); err != nil {
		return nil, err
	}
	return answers, nil
}

// SetAnswers сериализует ответы в JSON
func (s *QuizSubmission) SetAnswers(answers []QuizAnswer) error {
	data, err := json.Marshal(answers)
	if err != nil {
		return err
	}
	s.Answers = string(data)
	return nil
}

// ==================== Progress Helper Methods ====================

// GetMasteryLabel возвращает текстовую метку для уровня мастерства
func (p *Progress) GetMasteryLabel() string {
	if p.MasteryScore < 0.3 {
		return "Beginner"
	} else if p.MasteryScore < 0.6 {
		return "Intermediate"
	} else if p.MasteryScore < 0.8 {
		return "Advanced"
	}
	return "Expert"
}

// NeedsReview проверяет, нужно ли повторить тему
func (p *Progress) NeedsReview() bool {
	return time.Now().After(p.NextReview)
}

// ==================== Tutorial Helper Methods ====================

// GetDifficultyLevel определяет сложность на основе прогресса
func GetDifficultyForProgress(masteryScore float64) string {
	if masteryScore < 0.3 {
		return "basic"
	} else if masteryScore < 0.6 {
		return "intermediate"
	} else if masteryScore < 0.8 {
		return "advanced"
	}
	return "expert"
}
