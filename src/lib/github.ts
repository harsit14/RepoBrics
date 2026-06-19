import type { RepoInfo } from "@/types/world";

export class InvalidRepoUrlError extends Error {
  constructor(message = "Enter a public GitHub repository URL.") {
    super(message);
    this.name = "InvalidRepoUrlError";
  }
}

export function parseGitHubUrl(rawUrl: string): Omit<RepoInfo, "branch"> {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new InvalidRepoUrlError();
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
    throw new InvalidRepoUrlError("Only https://github.com/owner/repo URLs are supported.");
  }

  const [owner, repo, ...rest] = parsed.pathname.split("/").filter(Boolean);
  if (!owner || !repo || rest.length > 0) {
    throw new InvalidRepoUrlError("Use the repository root URL, such as https://github.com/owner/repo.");
  }

  const cleanRepo = repo.endsWith(".git") ? repo.slice(0, -4) : repo;
  if (!isSafeSegment(owner) || !isSafeSegment(cleanRepo)) {
    throw new InvalidRepoUrlError("Repository owner and name contain unsupported characters.");
  }

  const url = `https://github.com/${owner}/${cleanRepo}`;
  return {
    owner,
    name: cleanRepo,
    fullName: `${owner}/${cleanRepo}`,
    url,
    cloneUrl: `${url}.git`
  };
}

function isSafeSegment(value: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(value) && !value.includes("..");
}
