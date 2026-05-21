/**
 * Google OAuth Start
 * Starts Google Calendar OAuth using the live SQL contract.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { buildAuthorizationUrl, generatePKCE } from "../_shared/google-oauth.ts";
import { createUserClient, getUserFromToken } from "../_shared/supabase-admin.ts";

const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

interface StartOAuthRequest {
  organizationId: string;
  redirectUri: string;
  scopes?: string[];
  expiresInMinutes?: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing or invalid authorization header" }, 401);
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const user = await getUserFromToken(token);
    if (!user) {
      return json({ error: "Invalid or expired token" }, 401);
    }

    const body = (await req.json()) as StartOAuthRequest;
    const { organizationId, redirectUri } = body;
    const scopes = body.scopes?.length ? body.scopes : DEFAULT_SCOPES;
    const expiresInMinutes = body.expiresInMinutes ?? 15;

    if (!organizationId || !redirectUri) {
      return json(
        { error: "Missing required fields: organizationId, redirectUri" },
        400,
      );
    }

    try {
      new URL(redirectUri);
    } catch {
      return json({ error: "Invalid redirectUri format" }, 400);
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    if (!clientId) {
      return json({ error: "Missing GOOGLE_OAUTH_CLIENT_ID" }, 500);
    }

    const { verifier, challenge } = await generatePKCE();

    const supabase = createUserClient(token);

    const { data, error } = await supabase.rpc("start_calendar_oauth_session", {
      target_org_id: organizationId,
      target_provider: "google",
      target_redirect_uri: redirectUri,
      target_requested_scopes: scopes,
      target_code_verifier: verifier,
      target_code_challenge: challenge,
      target_expires_in_minutes: expiresInMinutes,
    });

    if (error) {
      console.error("start_calendar_oauth_session failed:", error);
      return json(
        {
          error: "Failed to initialize OAuth session",
          details: error.message,
        },
        500,
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.session_id || !row?.state) {
      return json({ error: "OAuth session creation returned no data" }, 500);
    }

    const authorizationUrl = buildAuthorizationUrl(
      {
        clientId,
        redirectUri,
        scopes,
      },
      row.state,
      challenge,
    );

    return json({
      authorizationUrl,
      sessionId: row.session_id,
      state: row.state,
      expiresAt: row.expires_at,
    });
  } catch (error) {
    console.error("google-oauth-start unexpected error:", error);
    return json(
      {
        error: "internal_error",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});