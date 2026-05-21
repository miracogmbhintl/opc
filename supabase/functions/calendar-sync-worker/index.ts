/**
 * Calendar Sync Worker
 * Processes calendar_sync_jobs using the live SQL contract.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { listAllCalendars } from "../_shared/google-calendar-api.ts";
import { decryptToken, encryptToken } from "../_shared/encryption.ts";
import { refreshAccessToken } from "../_shared/google-oauth.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

interface WorkerRequest {
  workerId?: string;
  provider?: string | null;
  providers?: string[];
  jobTypes?: string[] | null;
  maxJobs?: number;
}

interface ClaimedJob {
  job_id: string;
  organization_id: string;
  provider: string;
  provider_account_id: string | null;
  booking_id: string | null;
  booking_calendar_link_id: string | null;
  direction: string;
  job_type: string;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown>;
}

interface JobResult {
  jobId: string;
  jobType: string;
  status: "completed" | "failed";
  message?: string;
  calendarsFound?: number;
  error?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-worker-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getSuppliedWorkerSecret(req: Request): string | null {
  const xSecret = req.headers.get("x-worker-secret");
  if (xSecret) return xSecret;

  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const expectedSecret = Deno.env.get("CALENDAR_WORKER_SECRET");
    if (!expectedSecret) {
      return json({ error: "Missing CALENDAR_WORKER_SECRET" }, 500);
    }

    const suppliedSecret = getSuppliedWorkerSecret(req);
    if (!suppliedSecret || suppliedSecret !== expectedSecret) {
      return json({ error: "Unauthorized worker invocation" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as WorkerRequest;
    const workerId = body.workerId || Deno.env.get("HOSTNAME") || "calendar-worker";
    const provider = body.provider || (body.providers?.length ? body.providers[0] : null);
    const jobTypes = body.jobTypes ?? null;
    const maxJobs = Math.max(1, Math.min(body.maxJobs ?? 1, 25));

    const supabase = createAdminClient();
    const results: JobResult[] = [];

    for (let i = 0; i < maxJobs; i++) {
      const { data, error } = await supabase.rpc("claim_next_calendar_sync_job", {
        target_worker_id: workerId,
        target_provider: provider,
        target_job_types: jobTypes,
      });

      if (error) {
        console.error("Failed to claim job:", error);
        return json(
          {
            error: "claim_failed",
            message: error.message,
            processed: results.length,
            results,
          },
          500,
        );
      }

      const job = (Array.isArray(data) ? data[0] : data) as ClaimedJob | null;
      if (!job?.job_id) {
        break;
      }

      try {
        let result: JobResult;

        switch (job.job_type) {
          case "fetch_calendars":
            result = await handleFetchCalendars(job, supabase);
            break;
          default:
            await supabase.rpc("fail_calendar_sync_job", {
              target_job_id: job.job_id,
              target_error: `Unsupported job type: ${job.job_type}`,
              target_retry_delay_minutes: 60,
            });

            result = {
              jobId: job.job_id,
              jobType: job.job_type,
              status: "failed",
              error: `Unsupported job type: ${job.job_type}`,
            };
        }

        results.push(result);
      } catch (jobError) {
        const errorMessage =
          jobError instanceof Error ? jobError.message : String(jobError);

        console.error(`Job ${job.job_id} failed:`, errorMessage);

        await supabase.rpc("fail_calendar_sync_job", {
          target_job_id: job.job_id,
          target_error: errorMessage,
          target_retry_delay_minutes: 5,
        });

        await supabase.from("calendar_sync_logs").insert({
          organization_id: job.organization_id,
          provider_account_id: job.provider_account_id,
          booking_id: job.booking_id,
          direction: job.direction,
          status: "error",
          message: errorMessage,
          payload: {
            job_id: job.job_id,
            job_type: job.job_type,
          },
        });

        results.push({
          jobId: job.job_id,
          jobType: job.job_type,
          status: "failed",
          error: errorMessage,
        });
      }
    }

    return json({
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("calendar-sync-worker unexpected error:", error);
    return json(
      {
        error: "worker_error",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

async function handleFetchCalendars(
  job: ClaimedJob,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<JobResult> {
  if (!job.provider_account_id) {
    throw new Error("Missing provider_account_id for fetch_calendars job");
  }

  const encryptionSecret = Deno.env.get("CALENDAR_ENCRYPTION_SECRET");
  const googleClientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");

  if (!encryptionSecret || !googleClientId || !googleClientSecret) {
    throw new Error("Missing Google or encryption environment variables");
  }

  const { data: providerAccount, error: providerError } = await supabase
    .from("calendar_provider_accounts")
    .select("id, organization_id, provider, provider_account_id, email, display_name, status")
    .eq("id", job.provider_account_id)
    .maybeSingle();

  if (providerError || !providerAccount) {
    throw new Error(`Provider account not found: ${job.provider_account_id}`);
  }

  const { data: secrets, error: secretsError } = await supabase
    .from("calendar_oauth_secrets")
    .select("encrypted_access_token, encrypted_refresh_token, token_expires_at, token_type")
    .eq("provider_account_id", providerAccount.id)
    .maybeSingle();

  if (secretsError || !secrets?.encrypted_access_token) {
    throw new Error("OAuth secrets not found for provider account");
  }

  let accessToken = await decryptToken(
    secrets.encrypted_access_token,
    encryptionSecret,
  );

  const expiresAt = secrets.token_expires_at
    ? new Date(secrets.token_expires_at)
    : null;

  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    if (!secrets.encrypted_refresh_token) {
      throw new Error("Access token expired and no refresh token is available");
    }

    const refreshToken = await decryptToken(
      secrets.encrypted_refresh_token,
      encryptionSecret,
    );

    const refreshed = await refreshAccessToken(
      refreshToken,
      googleClientId,
      googleClientSecret,
    );

    accessToken = refreshed.access_token;

    const encryptedAccessToken = await encryptToken(
      refreshed.access_token,
      encryptionSecret,
    );

    await supabase
      .from("calendar_oauth_secrets")
      .update({
        encrypted_access_token: encryptedAccessToken,
        token_expires_at: new Date(
          Date.now() + refreshed.expires_in * 1000,
        ).toISOString(),
        token_type: refreshed.token_type || "Bearer",
      })
      .eq("provider_account_id", providerAccount.id);
  }

  const calendars = await listAllCalendars(accessToken);

  for (const calendar of calendars) {
    const isReadOnly =
      calendar.accessRole === "reader" ||
      calendar.accessRole === "freeBusyReader";

    const resourceRow = {
      organization_id: providerAccount.organization_id,
      provider_account_id: providerAccount.id,
      provider_calendar_id: calendar.id,
      name: calendar.summary,
      timezone: calendar.timeZone,
      color: calendar.backgroundColor || calendar.colorId || null,
      is_primary: calendar.primary || false,
      is_read_only: isReadOnly,
      selected_for_sync: false,
      sync_direction: "two_way",
    };

    const { error: upsertError } = await supabase
      .from("calendar_resources")
      .upsert(resourceRow, {
        onConflict: "provider_account_id,provider_calendar_id",
      });

    if (upsertError) {
      throw new Error(`Failed to upsert calendar ${calendar.id}: ${upsertError.message}`);
    }
  }

  const resultPayload = {
    calendars_found: calendars.length,
    primary_calendar_id: calendars.find((c) => c.primary)?.id ?? null,
    calendar_ids: calendars.map((c) => c.id),
  };

  const { error: completeError } = await supabase.rpc("complete_calendar_sync_job", {
    target_job_id: job.job_id,
    target_result: resultPayload,
  });

  if (completeError) {
    throw new Error(`Failed to complete job: ${completeError.message}`);
  }

  await supabase.from("calendar_sync_logs").insert({
    organization_id: providerAccount.organization_id,
    provider_account_id: providerAccount.id,
    booking_id: null,
    direction: "import",
    status: "success",
    message: `Fetched ${calendars.length} calendars`,
    payload: resultPayload,
  });

  return {
    jobId: job.job_id,
    jobType: job.job_type,
    status: "completed",
    calendarsFound: calendars.length,
    message: `Successfully fetched ${calendars.length} calendars`,
  };
}