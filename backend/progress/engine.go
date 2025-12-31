package progress

import (
	"math"
	"time"

	"github.com/roman/trainer/backend/domain"
	"gorm.io/gorm"
)

// Engine управляет прогрессом обучения и Spaced Repetition
type Engine struct {
	db *gorm.DB
}

// NewEngine создает новый экземпляр Progress Engine
func NewEngine(db *gorm.DB) *Engine {
	return &Engine{db: db}
}

// RecordLearning записывает факт изучения темы
func (e *Engine) RecordLearning(topic string, initialScore float64) error {
	var progress domain.Progress

	err := e.db.Where("topic = ?", topic).First(&progress).Error
	if err == gorm.ErrRecordNotFound {
		// Создаем новую запись
		progress = domain.Progress{
			Topic:        topic,
			MasteryScore: initialScore,
			LastReviewed: time.Now(),
			NextReview:   time.Now().Add(24 * time.Hour), // Первое повторение через 1 день
			IntervalDays: 1,
		}
		return e.db.Create(&progress).Error
	} else if err != nil {
		return err
	}

	// Если уже существует, обновляем
	progress.LastReviewed = time.Now()
	progress.NextReview = e.calculateNextReview(progress.IntervalDays, true)

	return e.db.Save(&progress).Error
}

// UpdateMastery обновляет уровень мастерства после проверки знаний
func (e *Engine) UpdateMastery(topic string, quizScore float64, success bool) error {
	var progress domain.Progress

	err := e.db.Where("topic = ?", topic).First(&progress).Error
	if err != nil {
		return err
	}

	// Обновляем MasteryScore на основе результата
	// Используем exponential moving average для сглаживания
	alpha := 0.3 // Коэффициент обучения
	progress.MasteryScore = progress.MasteryScore*(1-alpha) + quizScore*alpha

	// Ограничиваем значение от 0 до 1
	if progress.MasteryScore > 1.0 {
		progress.MasteryScore = 1.0
	}
	if progress.MasteryScore < 0.0 {
		progress.MasteryScore = 0.0
	}

	// Обновляем интервал повторения по алгоритму SM-2 (SuperMemo)
	progress.IntervalDays = e.calculateNextInterval(progress.IntervalDays, progress.MasteryScore, success)
	progress.LastReviewed = time.Now()
	progress.NextReview = e.calculateNextReview(progress.IntervalDays, success)

	return e.db.Save(&progress).Error
}

// GetMasteryLevel возвращает текущий уровень мастерства по теме
func (e *Engine) GetMasteryLevel(topic string) float64 {
	var progress domain.Progress

	err := e.db.Where("topic = ?", topic).First(&progress).Error
	if err != nil {
		return 0.0 // Тема не изучалась
	}

	return progress.MasteryScore
}

// ShouldReview проверяет, пора ли повторить тему
func (e *Engine) ShouldReview(topic string) bool {
	var progress domain.Progress

	err := e.db.Where("topic = ?", topic).First(&progress).Error
	if err != nil {
		return false
	}

	return time.Now().After(progress.NextReview)
}

// GetTopicsForReview возвращает список тем, которые нужно повторить
func (e *Engine) GetTopicsForReview() ([]domain.Progress, error) {
	var topics []domain.Progress

	err := e.db.Where("next_review <= ?", time.Now()).
		Order("next_review ASC").
		Find(&topics).Error

	return topics, err
}

// GetWeakTopics возвращает темы с низким уровнем мастерства
func (e *Engine) GetWeakTopics(threshold float64, limit int) ([]domain.Progress, error) {
	var topics []domain.Progress

	err := e.db.Where("mastery_score < ?", threshold).
		Order("mastery_score ASC").
		Limit(limit).
		Find(&topics).Error

	return topics, err
}

// GetStrongTopics возвращает темы с высоким уровнем мастерства
func (e *Engine) GetStrongTopics(threshold float64, limit int) ([]domain.Progress, error) {
	var topics []domain.Progress

	err := e.db.Where("mastery_score >= ?", threshold).
		Order("mastery_score DESC").
		Limit(limit).
		Find(&topics).Error

	return topics, err
}

// GetAllProgress возвращает весь прогресс пользователя
func (e *Engine) GetAllProgress() ([]domain.Progress, error) {
	var progress []domain.Progress
	err := e.db.Order("mastery_score DESC").Find(&progress).Error
	return progress, err
}

// GetProgressStats возвращает статистику прогресса
func (e *Engine) GetProgressStats() (*ProgressStats, error) {
	var progress []domain.Progress
	err := e.db.Find(&progress).Error
	if err != nil {
		return nil, err
	}

	stats := &ProgressStats{
		TotalTopics: len(progress),
	}

	if len(progress) == 0 {
		return stats, nil
	}

	var totalScore float64
	for _, p := range progress {
		totalScore += p.MasteryScore

		if p.MasteryScore >= 0.8 {
			stats.MasteredTopics++
		} else if p.MasteryScore >= 0.5 {
			stats.IntermediateTopics++
		} else {
			stats.BeginnerTopics++
		}

		if time.Now().After(p.NextReview) {
			stats.TopicsNeedingReview++
		}
	}

	stats.AverageMastery = totalScore / float64(len(progress))

	return stats, nil
}

// calculateNextInterval вычисляет следующий интервал повторения
// Основан на алгоритме SM-2 (SuperMemo 2)
func (e *Engine) calculateNextInterval(currentInterval int, masteryScore float64, success bool) int {
	if !success || masteryScore < 0.6 {
		// При провале или низком результате - сбрасываем на 1 день
		return 1
	}

	// Ease factor зависит от уровня мастерства
	// Чем выше mastery, тем быстрее растет интервал
	easeFactor := 1.3 + (masteryScore * 1.7) // От 1.3 до 3.0

	nextInterval := int(math.Round(float64(currentInterval) * easeFactor))

	// Минимальный интервал - 1 день
	if nextInterval < 1 {
		nextInterval = 1
	}

	// Максимальный интервал - 365 дней (1 год)
	if nextInterval > 365 {
		nextInterval = 365
	}

	return nextInterval
}

// calculateNextReview вычисляет дату следующего повторения
func (e *Engine) calculateNextReview(intervalDays int, success bool) time.Time {
	if !success {
		// При провале - повторить через несколько часов
		return time.Now().Add(6 * time.Hour)
	}

	return time.Now().Add(time.Duration(intervalDays) * 24 * time.Hour)
}

// GetLearningPath генерирует рекомендуемый путь обучения
func (e *Engine) GetLearningPath() ([]string, error) {
	// Сначала темы, требующие повторения
	reviewTopics, err := e.GetTopicsForReview()
	if err != nil {
		return nil, err
	}

	path := make([]string, 0)
	for _, topic := range reviewTopics {
		path = append(path, topic.Topic)
	}

	// Затем слабые темы для укрепления
	weakTopics, err := e.GetWeakTopics(0.6, 5)
	if err != nil {
		return nil, err
	}

	for _, topic := range weakTopics {
		// Избегаем дубликатов
		found := false
		for _, p := range path {
			if p == topic.Topic {
				found = true
				break
			}
		}
		if !found {
			path = append(path, topic.Topic)
		}
	}

	return path, nil
}

// ResetTopic сбрасывает прогресс по теме (для переобучения)
func (e *Engine) ResetTopic(topic string) error {
	return e.db.Where("topic = ?", topic).Delete(&domain.Progress{}).Error
}

// ProgressStats содержит статистику прогресса
type ProgressStats struct {
	TotalTopics          int     `json:"total_topics"`
	MasteredTopics       int     `json:"mastered_topics"`
	IntermediateTopics   int     `json:"intermediate_topics"`
	BeginnerTopics       int     `json:"beginner_topics"`
	TopicsNeedingReview  int     `json:"topics_needing_review"`
	AverageMastery       float64 `json:"average_mastery"`
}

// GetMasteryCategory возвращает категорию мастерства
func GetMasteryCategory(score float64) string {
	if score >= 0.8 {
		return "mastered"
	} else if score >= 0.5 {
		return "intermediate"
	} else if score >= 0.3 {
		return "beginner"
	}
	return "novice"
}

// GetDifficultyLevel возвращает рекомендуемый уровень сложности
func GetDifficultyLevel(masteryScore float64) string {
	if masteryScore < 0.3 {
		return "basic" // Базовые концепции
	} else if masteryScore < 0.6 {
		return "intermediate" // Практические примеры
	} else if masteryScore < 0.8 {
		return "advanced" // Продвинутые паттерны
	}
	return "expert" // Edge cases и оптимизации
}
