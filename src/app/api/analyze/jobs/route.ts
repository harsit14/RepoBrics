import { NextResponse } from "next/server";
import { startAnalysisJob } from "@/lib/analysisJobs";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const result = await startAnalysisJob(body && typeof body === "object" ? body : {});
  return NextResponse.json(result.body, { status: result.status });
}
