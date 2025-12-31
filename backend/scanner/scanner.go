package scanner

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// ScanProject walks through the project directory and returns the content of relevant files.
// rootPath is the directory to start scanning from.
func ScanProject(rootPath string) (string, error) {
	var builder strings.Builder

	err := filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			// Skip .git, node_modules, and other heavy directories
			if d.Name() == ".git" || d.Name() == "node_modules" || d.Name() == "dist" || d.Name() == "build" {
				return filepath.SkipDir
			}
			return nil
		}

		// Filter for Go files only for now (can optionally include JS/TS)
		if strings.HasSuffix(d.Name(), ".go") {
			content, err := os.ReadFile(path)
			if err != nil {
				return fmt.Errorf("failed to read file %s: %w", path, err)
			}

			// Add file header and content to context
			// We use relative path for clarity
			relPath, _ := filepath.Rel(rootPath, path)
			builder.WriteString(fmt.Sprintf("\n--- FILE: %s ---\n", relPath))
			builder.Write(content)
			builder.WriteString("\n")
		}

		return nil
	})

	if err != nil {
		return "", err
	}

	return builder.String(), nil
}
