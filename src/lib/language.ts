import type { LanguageStats } from "@/types/world";

type LanguageDefinition = {
  language: string;
  color: string;
};

const EXTENSIONS: Record<string, LanguageDefinition> = {
  ".ts": { language: "TypeScript", color: "#3178c6" },
  ".tsx": { language: "TypeScript React", color: "#2f9fd7" },
  ".js": { language: "JavaScript", color: "#f2c94c" },
  ".jsx": { language: "JavaScript React", color: "#f7df1e" },
  ".mjs": { language: "JavaScript", color: "#f2c94c" },
  ".cjs": { language: "JavaScript", color: "#f2c94c" },
  ".py": { language: "Python", color: "#3776ab" },
  ".css": { language: "CSS", color: "#2f80ed" },
  ".scss": { language: "CSS", color: "#c6538c" },
  ".sass": { language: "CSS", color: "#c6538c" },
  ".less": { language: "CSS", color: "#1d365d" },
  ".html": { language: "HTML", color: "#e34c26" },
  ".md": { language: "Markdown", color: "#7c8798" },
  ".mdx": { language: "MDX", color: "#fcb32c" },
  ".json": { language: "JSON", color: "#d29922" },
  ".jsonc": { language: "JSON", color: "#d29922" },
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
  ".bash": { language: "Shell", color: "#4eaa25" },
  ".zsh": { language: "Shell", color: "#4eaa25" },
  ".fish": { language: "Shell", color: "#4eaa25" },
  ".ps1": { language: "PowerShell", color: "#012456" },
  ".bat": { language: "Batch", color: "#6d8086" },
  ".cmd": { language: "Batch", color: "#6d8086" },
  ".sql": { language: "SQL", color: "#336791" },
  ".graphql": { language: "GraphQL", color: "#e10098" },
  ".gql": { language: "GraphQL", color: "#e10098" },
  ".vue": { language: "Vue", color: "#42b883" },
  ".svelte": { language: "Svelte", color: "#ff3e00" },
  ".astro": { language: "Astro", color: "#ff5d01" },
  ".dart": { language: "Dart", color: "#0175c2" },
  ".lua": { language: "Lua", color: "#000080" },
  ".r": { language: "R", color: "#276dc3" },
  ".jl": { language: "Julia", color: "#9558b2" },
  ".scala": { language: "Scala", color: "#dc322f" },
  ".clj": { language: "Clojure", color: "#5881d8" },
  ".cljs": { language: "ClojureScript", color: "#5881d8" },
  ".ex": { language: "Elixir", color: "#6e4a7e" },
  ".exs": { language: "Elixir", color: "#6e4a7e" },
  ".erl": { language: "Erlang", color: "#a90533" },
  ".hrl": { language: "Erlang", color: "#a90533" },
  ".fs": { language: "F#", color: "#378bba" },
  ".fsx": { language: "F#", color: "#378bba" },
  ".hs": { language: "Haskell", color: "#5e5086" },
  ".ml": { language: "OCaml", color: "#ef7a08" },
  ".mli": { language: "OCaml", color: "#ef7a08" },
  ".zig": { language: "Zig", color: "#f7a41d" },
  ".nim": { language: "Nim", color: "#ffc200" },
  ".v": { language: "V", color: "#5d87bf" },
  ".odin": { language: "Odin", color: "#60affe" },
  ".sol": { language: "Solidity", color: "#363636" },
  ".tf": { language: "Terraform", color: "#7b42bc" },
  ".hcl": { language: "HCL", color: "#844fba" },
  ".proto": { language: "Protocol Buffers", color: "#4285f4" },
  ".prisma": { language: "Prisma", color: "#0c344b" },
  ".xml": { language: "XML", color: "#0060ac" },
  ".svg": { language: "SVG", color: "#ffb13b" },
  ".gradle": { language: "Gradle", color: "#02303a" },
  ".groovy": { language: "Groovy", color: "#4298b8" },
  ".pl": { language: "Perl", color: "#39457e" },
  ".pm": { language: "Perl", color: "#39457e" },
  ".ipynb": { language: "Notebook", color: "#f37626" }
};

const SPECIAL_FILES: Record<string, LanguageDefinition> = {
  dockerfile: { language: "Dockerfile", color: "#2496ed" },
  "docker-compose.yml": { language: "Docker Compose", color: "#2496ed" },
  "docker-compose.yaml": { language: "Docker Compose", color: "#2496ed" },
  makefile: { language: "Makefile", color: "#6d4c41" },
  justfile: { language: "Justfile", color: "#6d4c41" },
  gemfile: { language: "Ruby", color: "#cc342d" },
  rakefile: { language: "Ruby", color: "#cc342d" },
  podfile: { language: "Ruby", color: "#cc342d" },
  "go.mod": { language: "Go Module", color: "#00add8" },
  "go.sum": { language: "Go Module", color: "#00add8" },
  "cargo.toml": { language: "Rust Manifest", color: "#b7410e" },
  "cargo.lock": { language: "Rust Manifest", color: "#b7410e" }
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
