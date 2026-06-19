import { describe, expect, it } from "vitest";
import { InvalidRepoUrlError, parseGitHubUrl } from "@/lib/github";

describe("parseGitHubUrl", () => {
  it("normalizes public GitHub repository URLs", () => {
    expect(parseGitHubUrl("https://github.com/owner/repo")).toEqual({
      owner: "owner",
      name: "repo",
      fullName: "owner/repo",
      url: "https://github.com/owner/repo",
      cloneUrl: "https://github.com/owner/repo.git"
    });
  });

  it("rejects unsupported hosts and nested paths", () => {
    expect(() => parseGitHubUrl("https://example.com/owner/repo")).toThrow(InvalidRepoUrlError);
    expect(() => parseGitHubUrl("https://github.com/owner/repo/tree/main")).toThrow(InvalidRepoUrlError);
  });
});
