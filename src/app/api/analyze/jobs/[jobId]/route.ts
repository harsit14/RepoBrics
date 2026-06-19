import { NextResponse } from "next/server";
import { getAnalysisJob } from "@/lib/analysisJobs";
import { getSupabaseAnalysisJob } from "@/lib/supabaseAnalysis";

export const runtime = "nodejs";
export const maxDuration = 10;

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const job = process.env.REPOBRICKS_JOB_BACKEND === "supabase"
    ? await getSupabaseAnalysisJob(jobId)
    : await getAnalysisJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Analysis job was not found." }, { status: 404 });
  }

  return NextResponse.json(job);
}
