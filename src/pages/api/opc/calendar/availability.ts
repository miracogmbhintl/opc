import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

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

function normaliseRole(value: unknown): string {
  return String(value || "client").toLowerCase();
}

async function assertCanViewAvailability(
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const { data, error } = await supabase
    .from("opc_staff_roles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("No staff role found for current user.");
  }

  const role = normaliseRole((data as any).role || (data as any).position || (data as any).staff_role);

  if (!["owner", "admin", "dispatch", "employee"].includes(role)) {
    throw new Error("You do not have permission to view availability.");
  }

  return role;
}

export const GET: APIRoute = async ({ request }) => {
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

    await assertCanViewAvailability(supabase, user.id);

    const url = new URL(request.url);
    const startsAt = url.searchParams.get("starts_at");
    const endsAt = url.searchParams.get("ends_at");

    if (!startsAt || !endsAt) {
      throw new Error("starts_at and ends_at are required.");
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (Number.isNaN(start.getTime())) throw new Error("starts_at is invalid.");
    if (Number.isNaN(end.getTime())) throw new Error("ends_at is invalid.");
    if (end <= start) throw new Error("ends_at must be after starts_at.");

    const { data: staffRows, error: staffError } = await supabase
      .from("opc_staff_roles")
      .select("*")
      .order("created_at", { ascending: true });

    if (staffError) throw staffError;

    const { data: busyRows, error: busyError } = await supabase
      .from("opc_calendar_busy_slots")
      .select("*")
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString());

    if (busyError) throw busyError;

    const busyStaffIds = new Set(
      (busyRows || [])
        .map((row: any) => row.staff_role_id)
        .filter(Boolean)
    );

    const availability = (staffRows || []).map((row: any) => {
      const role = normaliseRole(row.role || row.position || row.staff_role);

      return {
        staff_role_id: row.id,
        user_id: row.user_id || row.auth_user_id || null,
        name:
          row.full_name ||
          row.name ||
          row.display_name ||
          row.email ||
          row.phone ||
          "Teammitglied",
        role,
        is_active: row.is_active ?? row.active ?? true,
        is_busy: busyStaffIds.has(row.id),
        status: busyStaffIds.has(row.id) ? "busy" : "available",
      };
    });

    return new Response(
      JSON.stringify({
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        availability,
        busy_slots: busyRows || [],
      }),
      {
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Availability could not be checked.",
      }),
      {
        status: 500,
      }
    );
  }
};