import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[zero-downtime invariant] ${message}`);
  }
}

function contains(file, value, message) {
  assert(read(file).includes(value), `${message} (${file})`);
}

function excludes(file, value, message) {
  assert(!read(file).includes(value), `${message} (${file})`);
}

const login = 'src/components/OPCLogin.tsx';
const supabase = 'src/lib/supabase.ts';
const authCache = 'src/lib/opc-auth-cache.ts';
const offlineQueue = 'src/lib/opc-offline-action-queue.ts';
const jobAccess = 'src/lib/opc-job-access.ts';
const inspectionUpload = 'src/lib/opc-inspection-media-client.ts';
const clientData = 'src/pages/api/opc/client-portal/data.ts';
const clientDownload = 'src/pages/api/opc/client-portal/document-download.ts';
const liveAudit = 'supabase/audits/20260825_zero_downtime_live_audit.sql';

// One browser Supabase session owner: login must reuse the shared singleton.
contains(login, "import { supabase } from '../lib/supabase';", 'Login must use the shared Supabase client');
excludes(login, "from '@supabase/supabase-js'", 'Login must not construct a second Supabase client');

// HTTP-only cookie lifecycle must follow Supabase auth lifecycle.
contains(supabase, "event === 'SIGNED_OUT'", 'Shared auth lifecycle must handle sign-out');
contains(supabase, "method: 'DELETE'", 'Sign-out must clear the server session cookie');
contains(supabase, "'/api/auth/set-session'", 'Shared auth lifecycle must synchronize server cookies');
contains(supabase, "event === 'TOKEN_REFRESHED'", 'Token refresh must update the server session');

// Profile cache can only be used behind a real same-user Supabase session.
contains(authCache, 'getPersistedSessionUserId', 'Auth cache must validate the persisted Supabase session');
contains(authCache, 'cachedProfile?.id === sessionUserId', 'Cached profile must belong to the active session user');
contains(authCache, "['active', 'aktiv', 'enabled']", 'Auth resolver must accept the canonical active-status compatibility set');
excludes(
  authCache,
  'can_manage_jobs,can_view_all_jobs,can_manage_calendar',
  'Auth role query must not depend on the unverified can_manage_calendar column',
);

// Offline mutations must not cross account boundaries on shared devices.
contains(offlineQueue, 'ownerUserId', 'Offline mutations must have an authenticated owner');
contains(offlineQueue, 'opc:offline-action-queue:v2:user:', 'Offline queues must be namespaced by user');
contains(offlineQueue, 'blocked cross-user mutation replay', 'Cross-user offline replay must be blocked');
contains(offlineQueue, "const LEGACY_QUEUE_KEY = 'opc:offline-action-queue:v1'", 'Legacy queue must remain explicitly quarantined');

// Active-status vocabulary must be consistent at the central job resolver.
contains(jobAccess, "new Set(['active', 'aktiv', 'enabled'])", 'Job access must recognize all supported active status values');

// Ambiguous mobile uploads must verify whether the server already completed them.
contains(inspectionUpload, 'verifyInspectionUpload', 'Inspection upload retries must verify ambiguous success');
contains(inspectionUpload, 'uploadToken', 'Inspection upload verification must use the logical upload token');

// Customer portal must distinguish partial query failure from genuine empty data.
contains(clientData, 'partial: warnings.length > 0', 'Client portal must surface partial database failures');
contains(clientData, '/api/opc/client-portal/document-download?document_id=', 'Client documents must use the authenticated download bridge');

// Customer download route must enforce both authentication and client ownership.
contains(clientDownload, 'authenticateOpcClientPortalRequest', 'Client document downloads must authenticate the portal user');
contains(clientDownload, ".eq('client_id', access.clientId)", 'Client document downloads must enforce client ownership');
contains(clientDownload, 'createSignedUrl', 'Private documents must use short-lived signed storage URLs');

// Live database remediation must remain explicitly audit-first and non-mutating.
const audit = read(liveAudit);
assert(!/^\s*(update|delete|insert|alter|drop|create|truncate|grant|revoke)\b/im.test(audit), 'Live audit SQL must remain read-only');
contains(liveAudit, 'pg_get_functiondef', 'Live audit must capture the real time-tracking RPC implementations');
contains(liveAudit, 'pg_policies', 'Live audit must capture RLS policies');

console.log('Zero-downtime invariants verified.');
