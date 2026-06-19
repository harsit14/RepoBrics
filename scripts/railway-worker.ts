import {
  claimNextSupabaseJob,
  createSupabaseAdmin,
  processSupabaseJob,
  supabaseAnalysisConfigFromEnv
} from "../src/lib/supabaseAnalysis";

const once = process.argv.includes("--once");
const pollMs = clampInt(Number(process.env.REPOBRICKS_WORKER_POLL_MS) || 5_000, 1_000, 60_000);
const workerId = process.env.RAILWAY_REPLICA_ID ?? process.env.HOSTNAME ?? `local-${Date.now()}`;

let stopping = false;

process.on("SIGTERM", () => {
  stopping = true;
});

process.on("SIGINT", () => {
  stopping = true;
});

async function main() {
  const config = supabaseAnalysisConfigFromEnv();
  const client = createSupabaseAdmin(config);
  console.log(`[repobricks-worker] started worker=${workerId} bucket=${config.bucket} once=${once}`);

  while (!stopping) {
    const job = await claimNextSupabaseJob(workerId, client);
    if (!job) {
      if (once) {
        console.log("[repobricks-worker] no queued job found");
        return;
      }
      await sleep(pollMs);
      continue;
    }

    console.log(`[repobricks-worker] claimed job=${job.id} repo=${job.repo_url}`);
    await processSupabaseJob(job, client, config);
    console.log(`[repobricks-worker] finished job=${job.id}`);

    if (once) {
      return;
    }
  }

  console.log("[repobricks-worker] stopped");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

main().catch((error) => {
  console.error("[repobricks-worker] fatal", error);
  process.exitCode = 1;
});
