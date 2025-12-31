package domain

import (
	"time"

	"gorm.io/gorm"
)

type Profile struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
	Name       string         `json:"name"`
	Background string         `json:"background"`
	Goals      string         `json:"goals"`
}

type Tutorial struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
	Title      string         `json:"title"`
	Content    string         `json:"content"`
	SourceRepo string         `json:"source_repo"`
	Topic      string         `json:"topic"`
}

type Progress struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	Topic        string         `gorm:"uniqueIndex" json:"topic"`
	MasteryScore float64        `json:"mastery_score"` // 0.0 to 1.0
	LastReviewed time.Time      `json:"last_reviewed"`
	NextReview   time.Time      `json:"next_review"`
	IntervalDays int            `json:"interval_days"`
}
