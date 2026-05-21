import { createClient } from "@supabase/supabase-js";

type RuntimeLocals = {
  runtime?: {
    env?: Record<string, string | undefined>;
  };
};

export function getOpcRuntimeEnv(locals?: unknown) {
  const runtimeEnv = (locals as RuntimeLocals | undefined)?.runtime?.env ?? {};

  const supabaseUrl =
    runtimeEnv.SUPABASE_URL ||
    runtimeEnv.PUBLIC_SUPABASE_URL ||
    import.meta.env.SUPABASE_URL ||
    import.meta.env.PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    runtimeEnv.SUPABASE_SERVICE_ROLE_KEY ||
    runtimeEnv.SUPABASE_SERVICE_KEY ||
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
    import.meta.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL or PUBLIC_SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return {
    supabaseUrl,
    serviceRoleKey,
  };
}

export function createOpcServiceClient(locals?: unknown) {
  const { supabaseUrl, serviceRoleKey } = getOpcRuntimeEnv(locals);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function sanitizePublicText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return null;

  const cleaned = value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  return cleaned.slice(0, maxLength);
}

export function sanitizeTicketCategory(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "general";

  const allowed = new Set([
    "damage",
    "cleaning_needed",
    "recleaning",
    "material_missing",
    "complaint",
    "praise",
    "general",
    "other",
  ]);

  return allowed.has(value) ? value : "general";
}

export function getClientIp(request: Request, clientAddress?: string) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  const realIp = request.headers.get("x-real-ip");

  return (
    cfConnectingIp ||
    forwardedFor?.split(",")[0]?.trim() ||
    realIp ||
    clientAddress ||
    null
  );
}

export function safeFileName(filename: string) {
  const fallback = "upload";
  const cleaned = filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\-+|\-+$/g, "")
    .slice(0, 120);

  return cleaned || fallback;
}

export function isAllowedTicketImage(file: File) {
  const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);

  return allowedMimeTypes.has(file.type);
}