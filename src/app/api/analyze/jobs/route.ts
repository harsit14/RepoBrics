import { NextResponse } from "next/server";
import { startAnalysisJob } from "@/lib/analysisJobs";
import { startSupabaseAnalysisJob } from "@/lib/supabaseAnalysis";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const input = body && typeof body === "object" ? body : {};
  const result = process.env.REPOBRICKS_JOB_BACKEND === "supabase"
    ? await startSupabaseAnalysisJob(input)
    : await startAnalysisJob(input);
  return NextResponse.json(result.body, { status: result.status });
}
