/**
 * Google OAuth Callback
 * Completes Google OAuth using the live SQL contract.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { encryptTokens } from "../_shared/encryption.ts";
import {
  exchangeCodeForTokens,
  getUserInfo,
} from "../_shared/google-oauth.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabase = createAdminClient();

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    let session:
      | {
          id: string;
          organization_id: string;
          provider: string;
          redirect_uri: string;
          code_verifier: string;
          requested_scopes: string[] | null;
          status: string;
          expires_at: string;
        }
      | null = null;

    if (state) {
      const { data } = await supabase
        .from("calendar_oauth_sessions")
        .select(
          "id, organization_id, provider, redirect_uri, code_verifier, requested_scopes, status, expires_at",
        )
        .eq("state", state)
        .limit(1)
        .maybeSingle();

      session = data;
    }

    if (oauthError) {
      if (session?.id) {
        await supabase.rpc("fail_calendar_oauth_session", {
          target_session_id: session.id,
          target_error_message: errorDescription || oauthError,
        });
      }

      return json(
        {
          success: false,
          error: oauthError,
          message: errorDescription || "OAuth authorization failed",
        },
        400,
      );
    }

    if (!code || !state) {
      return json(
        {
          success: false,
          error: "missing_parameters",
          message: "Missing code or state parameter",
        },
        400,
      );
    }

    if (!session) {
      return json(
        {
          success: false,
          error: "invalid_session",
          message: "OAuth session not found",
        },
        400,
      );
    }

    if (session.status !== "pending") {
      return json(
        {
          success: false,
          error: "invalid_session_state",
          message: `OAuth session is ${session.status}`,
        },
        400,
      );
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      await supabase.rpc("fail_calendar_oauth_session", {
        target_session_id: session.id,
        target_error_message: "OAuth session expired",
      });

      return json(
        {
          success: false,
          error: "session_expired",
          message: "OAuth session has expired. Please start again.",
        },
        400,
      );
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    const encryptionSecret = Deno.env.get("CALENDAR_ENCRYPTION_SECRET");

    if (!clientId || !clientSecret || !encryptionSecret) {
      return json(
        {
          success: false,
          error: "configuration_error",
          message: "Missing required Google or encryption secrets",
        },
        500,
      );
    }

    try {
      const tokenResponse = await exchangeCodeForTokens(
        code,
        clientId,
        clientSecret,
        session.redirect_uri,
        session.code_verifier,
      );

      const userInfo = await getUserInfo(tokenResponse.access_token);

      const {
        encrypted_access_token,
        encrypted_refresh_token,
      } = await encryptTokens(
        {
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token,
        },
        encryptionSecret,
      );

      const tokenExpiresAt = new Date(
        Date.now() + tokenResponse.expires_in * 1000,
      ).toISOString();

      const { data: completionData, error: completionError } = await supabase.rpc(
        "complete_calendar_oauth_session",
        {
          target_session_id: session.id,
          target_provider_account_id: userInfo.id,
          target_email: userInfo.email,
          target_display_name: userInfo.name || userInfo.email,
          target_scopes: tokenResponse.scope ? tokenResponse.scope.split(" ") : [],
          target_encrypted_access_token: encrypted_access_token,
          target_encrypted_refresh_token: encrypted_refresh_token ?? null,
          target_token_expires_at: tokenExpiresAt,
          target_token_type: tokenResponse.token_type || "Bearer",
        },
      );

      if (completionError) {
        console.error("complete_calendar_oauth_session failed:", completionError);

        await supabase.rpc("fail_calendar_oauth_session", {
          target_session_id: session.id,
          target_error_message: completionError.message,
        });

        return json(
          {
            success: false,
            error: "completion_failed",
            message: completionError.message,
          },
          500,
        );
      }

      const providerAccountUuid =
        typeof completionData === "string"
          ? completionData
          : Array.isArray(completionData)
          ? completionData[0]
          : completionData;

      return json({
        success: true,
        provider: "google",
        providerAccountId: providerAccountUuid,
        email: userInfo.email,
        displayName: userInfo.name || userInfo.email,
        message: "Google Calendar connected successfully",
      });
    } catch (exchangeError) {
      console.error("OAuth callback flow failed:", exchangeError);

      await supabase.rpc("fail_calendar_oauth_session", {
        target_session_id: session.id,
        target_error_message:
          exchangeError instanceof Error
            ? exchangeError.message
            : String(exchangeError),
      });

      return json(
        {
          success: false,
          error: "token_exchange_failed",
          message:
            exchangeError instanceof Error
              ? exchangeError.message
              : "Failed to exchange authorization code for tokens",
        },
        500,
      );
    }
  } catch (error) {
    console.error("google-oauth-callback unexpected error:", error);
    return json(
      {
        success: false,
        error: "internal_error",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});