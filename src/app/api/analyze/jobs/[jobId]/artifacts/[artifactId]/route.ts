import { NextResponse } from "next/server";
import { readAnalysisArtifact } from "@/lib/analysisJobs";

export const runtime = "nodejs";
export const maxDuration = 10;

type RouteContext = {
  params: Promise<{ jobId: string; artifactId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { jobId, artifactId } = await context.params;
  const artifact = await readAnalysisArtifact(jobId, artifactId);

  if (!artifact) {
    return NextResponse.json({ error: "Analysis artifact was not found." }, { status: 404 });
  }

  return NextResponse.json(artifact);
}
