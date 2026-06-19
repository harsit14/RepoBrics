import type { AnalyzeRequest, WorldManifest } from "@/types/world";
import { InvalidRepoUrlError } from "@/lib/github";
import { analyzeGitHubRepository, RepoTooLargeError, RepoUnavailableError } from "@/lib/analyzer";

export type AnalyzeHandlerDeps = {
  analyze?: (repoUrl: string, options?: Pick<AnalyzeRequest, "includeHistory" | "maxHistoryFrames" | "maxRenderedFiles">) => Promise<WorldManifest>;
};

export type AnalyzeHandlerResult =
  | { status: 200; body: WorldManifest }
  | { status: 400 | 404 | 413 | 500; body: { error: string } };

export async function handleAnalyzeRequest(
  input: Partial<AnalyzeRequest>,
  deps: AnalyzeHandlerDeps = {}
): Promise<AnalyzeHandlerResult> {
  if (!input.repoUrl || typeof input.repoUrl !== "string") {
    return { status: 400, body: { error: "repoUrl is required." } };
  }

  try {
    const manifest = await (deps.analyze ?? analyzeGitHubRepository)(input.repoUrl, {
      includeHistory: input.includeHistory,
      maxHistoryFrames: input.maxHistoryFrames,
      maxRenderedFiles: input.maxRenderedFiles
    });
    return { status: 200, body: manifest };
  } catch (error) {
    if (error instanceof InvalidRepoUrlError) {
      return { status: 400, body: { error: error.message } };
    }
    if (error instanceof RepoUnavailableError) {
      return { status: 404, body: { error: error.message } };
    }
    if (error instanceof RepoTooLargeError) {
      return { status: 413, body: { error: error.message } };
    }

    return { status: 500, body: { error: "RepoBricks could not analyze this repository." } };
  }
}
