package scanner

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// ProjectAnalysis содержит детальную информацию о проекте
type ProjectAnalysis struct {
	Structure    string            // Дерево проекта
	MainPackages []string          // Основные пакеты
	Dependencies map[string]string // Зависимости из go.mod
	TotalLines   int               // Общее количество строк
	FileCount    int               // Количество файлов
}

// FileInfo содержит информацию о файле
type FileInfo struct {
	Path    string
	Content string
	Lines   int
}

// AnalyzeProject выполняет полный анализ структуры проекта
func AnalyzeProject(rootPath string) (*ProjectAnalysis, error) {
	analysis := &ProjectAnalysis{
		MainPackages: make([]string, 0),
		Dependencies: make(map[string]string),
	}

	// Строим дерево структуры
	tree, err := buildProjectTree(rootPath, 0, 3) // Максимум 3 уровня
	if err != nil {
		return nil, err
	}
	analysis.Structure = tree

	// Ищем основные пакеты
	packages := make(map[string]bool)
	filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil || !d.IsDir() {
			return err
		}

		// Пропускаем служебные директории
		if shouldSkipDir(d.Name()) {
			return filepath.SkipDir
		}

		// Проверяем наличие .go файлов
		entries, err := os.ReadDir(path)
		if err == nil {
			for _, entry := range entries {
				if strings.HasSuffix(entry.Name(), ".go") && !strings.HasSuffix(entry.Name(), "_test.go") {
					relPath, _ := filepath.Rel(rootPath, path)
					if relPath == "." {
						relPath = "main"
					}
					packages[relPath] = true
					break
				}
			}
		}
		return nil
	})

	for pkg := range packages {
		analysis.MainPackages = append(analysis.MainPackages, pkg)
	}
	sort.Strings(analysis.MainPackages)

	// Читаем go.mod если есть
	goModPath := filepath.Join(rootPath, "go.mod")
	if content, err := os.ReadFile(goModPath); err == nil {
		analysis.Dependencies = parseGoMod(string(content))
	}

	return analysis, nil
}

// SmartScanWithLimit сканирует проект с ограничением по токенам
// Приоритезирует важные файлы и обрезает контекст если нужно
func SmartScanWithLimit(rootPath string, maxTokens int) (string, error) {
	files, err := collectFiles(rootPath)
	if err != nil {
		return "", err
	}

	// Сортируем файлы по важности
	sortFilesByImportance(files)

	var builder strings.Builder
	totalTokens := 0
	estimatedTokensPerChar := 0.25 // Примерно 4 символа на токен

	for _, file := range files {
		fileTokens := int(float64(len(file.Content)) * estimatedTokensPerChar)

		if totalTokens+fileTokens > maxTokens {
			// Если файл не помещается целиком, добавляем частично
			remainingTokens := maxTokens - totalTokens
			if remainingTokens > 100 { // Минимум 100 токенов чтобы имело смысл
				charsToAdd := int(float64(remainingTokens) / estimatedTokensPerChar)
				builder.WriteString(fmt.Sprintf("\n--- FILE: %s (TRUNCATED) ---\n", file.Path))
				builder.WriteString(file.Content[:charsToAdd])
				builder.WriteString("\n... [truncated] ...\n")
			}
			break
		}

		builder.WriteString(fmt.Sprintf("\n--- FILE: %s ---\n", file.Path))
		builder.WriteString(file.Content)
		builder.WriteString("\n")
		totalTokens += fileTokens
	}

	return builder.String(), nil
}

// ScanProject - оригинальная функция для обратной совместимости
func ScanProject(rootPath string) (string, error) {
	// Используем лимит в 50000 токенов (~200k символов)
	return SmartScanWithLimit(rootPath, 50000)
}

// collectFiles собирает все релевантные файлы проекта
func collectFiles(rootPath string) ([]FileInfo, error) {
	var files []FileInfo

	err := filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			if shouldSkipDir(d.Name()) {
				return filepath.SkipDir
			}
			return nil
		}

		// Фильтруем файлы по расширениям
		if shouldIncludeFile(d.Name()) {
			content, err := os.ReadFile(path)
			if err != nil {
				return fmt.Errorf("failed to read file %s: %w", path, err)
			}

			relPath, _ := filepath.Rel(rootPath, path)
			lines := strings.Count(string(content), "\n") + 1

			files = append(files, FileInfo{
				Path:    relPath,
				Content: string(content),
				Lines:   lines,
			})
		}

		return nil
	})

	return files, err
}

// sortFilesByImportance сортирует файлы по важности
// Приоритет: main.go, handlers, models, services, остальное
func sortFilesByImportance(files []FileInfo) {
	sort.Slice(files, func(i, j int) bool {
		scoreI := getFileImportanceScore(files[i].Path)
		scoreJ := getFileImportanceScore(files[j].Path)
		return scoreI > scoreJ
	})
}

// getFileImportanceScore возвращает оценку важности файла
func getFileImportanceScore(path string) int {
	basename := filepath.Base(path)
	dir := filepath.Dir(path)

	score := 0

	// Главные файлы
	if basename == "main.go" {
		score += 1000
	}

	// Важные паттерны в именах
	importantPatterns := map[string]int{
		"handler":    800,
		"model":      700,
		"service":    600,
		"controller": 500,
		"router":     400,
		"api":        300,
	}

	lowerPath := strings.ToLower(path)
	for pattern, points := range importantPatterns {
		if strings.Contains(lowerPath, pattern) {
			score += points
		}
	}

	// Файлы в корне важнее
	if dir == "." {
		score += 200
	}

	// Меньше вложенности - важнее
	depth := strings.Count(path, string(filepath.Separator))
	score -= depth * 50

	return score
}

// shouldSkipDir определяет, нужно ли пропустить директорию
func shouldSkipDir(name string) bool {
	skipDirs := []string{
		".git", "node_modules", "dist", "build",
		"vendor", ".next", ".vscode", ".idea",
		"coverage", "tmp", "temp", "__pycache__",
	}

	for _, skip := range skipDirs {
		if name == skip {
			return true
		}
	}
	return false
}

// shouldIncludeFile определяет, нужно ли включить файл
func shouldIncludeFile(name string) bool {
	// Go файлы
	if strings.HasSuffix(name, ".go") && !strings.HasSuffix(name, "_test.go") {
		return true
	}

	// Конфигурационные файлы
	configFiles := []string{
		"go.mod", "go.sum", "package.json",
		".env.example", "Dockerfile", "docker-compose.yml",
	}
	for _, cf := range configFiles {
		if name == cf {
			return true
		}
	}

	// TypeScript/JavaScript (опционально)
	extensions := []string{".ts", ".tsx", ".js", ".jsx"}
	for _, ext := range extensions {
		if strings.HasSuffix(name, ext) && !strings.Contains(name, ".test.") && !strings.Contains(name, ".spec.") {
			return true
		}
	}

	return false
}

// buildProjectTree строит текстовое представление дерева проекта
func buildProjectTree(rootPath string, currentDepth, maxDepth int) (string, error) {
	if currentDepth >= maxDepth {
		return "", nil
	}

	var builder strings.Builder
	entries, err := os.ReadDir(rootPath)
	if err != nil {
		return "", err
	}

	indent := strings.Repeat("  ", currentDepth)

	for _, entry := range entries {
		if shouldSkipDir(entry.Name()) {
			continue
		}

		if entry.IsDir() {
			builder.WriteString(fmt.Sprintf("%s📁 %s/\n", indent, entry.Name()))
			subPath := filepath.Join(rootPath, entry.Name())
			subTree, err := buildProjectTree(subPath, currentDepth+1, maxDepth)
			if err == nil {
				builder.WriteString(subTree)
			}
		} else if shouldIncludeFile(entry.Name()) {
			builder.WriteString(fmt.Sprintf("%s📄 %s\n", indent, entry.Name()))
		}
	}

	return builder.String(), nil
}

// parseGoMod парсит go.mod и извлекает основные зависимости
func parseGoMod(content string) map[string]string {
	deps := make(map[string]string)
	lines := strings.Split(content, "\n")
	inRequire := false

	for _, line := range lines {
		line = strings.TrimSpace(line)

		if strings.HasPrefix(line, "require") {
			inRequire = true
			continue
		}

		if inRequire && line == ")" {
			inRequire = false
			continue
		}

		if inRequire && line != "" && !strings.HasPrefix(line, "//") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				// Убираем indirect комментарии
				version := parts[1]
				if len(parts) > 2 && parts[2] == "//" {
					// Пропускаем indirect
					continue
				}
				deps[parts[0]] = version
			}
		}
	}

	return deps
}

// GetProjectSummary создает краткое описание проекта для AI
func GetProjectSummary(rootPath string) (string, error) {
	analysis, err := AnalyzeProject(rootPath)
	if err != nil {
		return "", err
	}

	var builder strings.Builder
	builder.WriteString("=== PROJECT STRUCTURE ===\n\n")
	builder.WriteString(analysis.Structure)
	builder.WriteString("\n\n=== MAIN PACKAGES ===\n")
	for _, pkg := range analysis.MainPackages {
		builder.WriteString(fmt.Sprintf("- %s\n", pkg))
	}

	if len(analysis.Dependencies) > 0 {
		builder.WriteString("\n=== KEY DEPENDENCIES ===\n")
		// Показываем только топ-10 важных зависимостей
		count := 0
		for dep, version := range analysis.Dependencies {
			if count >= 10 {
				break
			}
			builder.WriteString(fmt.Sprintf("- %s %s\n", dep, version))
			count++
		}
	}

	return builder.String(), nil
}
