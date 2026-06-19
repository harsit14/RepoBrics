import { NextResponse } from "next/server";
import { readAnalysisArtifact } from "@/lib/analysisJobs";
import { readSupabaseAnalysisArtifact } from "@/lib/supabaseAnalysis";

export const runtime = "nodejs";
export const maxDuration = 10;

type RouteContext = {
  params: Promise<{ jobId: string; artifactId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { jobId, artifactId } = await context.params;
  const artifact = process.env.REPOBRICKS_JOB_BACKEND === "supabase"
    ? await readSupabaseAnalysisArtifact(jobId, artifactId)
    : await readAnalysisArtifact(jobId, artifactId);

  if (!artifact) {
    return NextResponse.json({ error: "Analysis artifact was not found." }, { status: 404 });
  }

  return NextResponse.json(artifact);
}
