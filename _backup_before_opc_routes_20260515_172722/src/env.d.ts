/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

/**
 * Cloudflare Workers runtime types
 */
type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    // Additional locals
    env?: Env;
  }
}

/**
 * Environment variables available in Workers runtime
 */
interface Env {
  // KV Namespace for sessions
  SESSION: KVNamespace;
  
  // Public environment variables (embedded at build time for client)
  PUBLIC_SUPABASE_URL: string;
  PUBLIC_SUPABASE_ANON_KEY: string;
  
  // Server-only environment variables (runtime only)
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SERVICE_ROLE?: string;
  WEBFLOW_API_HOST?: string;
  EDGE_FUNCTION_BASE?: string;
}

/**
 * Import.meta.env types for build-time
 * These are available as string literals in client code
 */
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly SUPABASE_SERVICE_ROLE: string;
  readonly WEBFLOW_API_HOST: string;
  readonly EDGE_FUNCTION_BASE: string;
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
