import type { LanguageStats } from "@/types/world";

type LanguageDefinition = {
  language: string;
  color: string;
};

const EXTENSIONS: Record<string, LanguageDefinition> = {
  ".ts": { language: "TypeScript", color: "#3178c6" },
  ".tsx": { language: "TypeScript", color: "#3178c6" },
  ".js": { language: "JavaScript", color: "#f2c94c" },
  ".jsx": { language: "JavaScript", color: "#f2c94c" },
  ".mjs": { language: "JavaScript", color: "#f2c94c" },
  ".cjs": { language: "JavaScript", color: "#f2c94c" },
  ".py": { language: "Python", color: "#3776ab" },
  ".css": { language: "CSS", color: "#2f80ed" },
  ".scss": { language: "CSS", color: "#c6538c" },
  ".html": { language: "HTML", color: "#e34c26" },
  ".md": { language: "Markdown", color: "#7c8798" },
  ".json": { language: "JSON", color: "#d29922" },
  ".yml": { language: "YAML", color: "#cb4b16" },
  ".yaml": { language: "YAML", color: "#cb4b16" },
  ".toml": { language: "TOML", color: "#9b5de5" },
  ".rs": { language: "Rust", color: "#b7410e" },
  ".go": { language: "Go", color: "#00add8" },
  ".java": { language: "Java", color: "#b07219" },
  ".kt": { language: "Kotlin", color: "#7f52ff" },
  ".rb": { language: "Ruby", color: "#cc342d" },
  ".php": { language: "PHP", color: "#777bb4" },
  ".cs": { language: "C#", color: "#239120" },
  ".cpp": { language: "C++", color: "#00599c" },
  ".c": { language: "C", color: "#555555" },
  ".h": { language: "C/C++ Header", color: "#6f8ab7" },
  ".swift": { language: "Swift", color: "#fa7343" },
  ".sh": { language: "Shell", color: "#4eaa25" },
  ".sql": { language: "SQL", color: "#336791" }
};

const SPECIAL_FILES: Record<string, LanguageDefinition> = {
  dockerfile: { language: "Dockerfile", color: "#2496ed" },
  makefile: { language: "Makefile", color: "#6d4c41" },
  justfile: { language: "Justfile", color: "#6d4c41" }
};

export const UNKNOWN_LANGUAGE: LanguageDefinition = {
  language: "Other",
  color: "#8b95a5"
};

export function languageForPath(path: string): LanguageDefinition {
  const base = path.split("/").pop()?.toLowerCase() ?? "";
  if (SPECIAL_FILES[base]) {
    return SPECIAL_FILES[base];
  }

  const dot = base.lastIndexOf(".");
  if (dot === -1) {
    return UNKNOWN_LANGUAGE;
  }

  return EXTENSIONS[base.slice(dot)] ?? UNKNOWN_LANGUAGE;
}

export function sortLanguageStats(stats: Map<string, LanguageStats>): LanguageStats[] {
  return [...stats.values()].sort((a, b) => b.loc - a.loc || b.files - a.files || a.language.localeCompare(b.language));
}
