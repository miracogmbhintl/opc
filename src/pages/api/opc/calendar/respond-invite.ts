import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

type Payload = {
  attendee_id: string;
  status: "accepted" | "declined" | "tentative";
  response_note?: string;
};

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7);
  }
  return null;
}

function createUserSupabase(request: Request) {
  const supabaseUrl =
    import.meta.env.PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.SUPABASE_URL;

  const supabaseAnonKey =
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase URL or anon key.");
  }

  const token = getBearerToken(request);

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const supabase = createUserSupabase(request);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
      });
    }

    const payload = (await request.json()) as Payload;

    if (!payload.attendee_id) {
      throw new Error("attendee_id is required.");
    }

    if (!["accepted", "declined", "tentative"].includes(payload.status)) {
      throw new Error("Invalid invite status.");
    }

    const { data: attendee, error: attendeeError } = await supabase
      .from("opc_calendar_event_attendees")
      .select("*")
      .eq("id", payload.attendee_id)
      .maybeSingle();

    if (attendeeError) throw attendeeError;
    if (!attendee) throw new Error("Invite not found.");

    if (attendee.user_id !== user.id) {
      throw new Error("You can only respond to your own invite.");
    }

    const { data, error } = await supabase
      .from("opc_calendar_event_attendees")
      .update({
        status: payload.status,
        response_note: payload.response_note || null,
        responded_at: new Date().toISOString(),
      })
      .eq("id", payload.attendee_id)
      .select("*")
      .single();

    if (error) throw error;

    await supabase
      .from("opc_calendar_notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("attendee_id", payload.attendee_id)
      .eq("recipient_user_id", user.id);

    return new Response(JSON.stringify({ attendee: data }), {
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Invite response could not be saved.",
      }),
      {
        status: 500,
      }
    );
  }
};