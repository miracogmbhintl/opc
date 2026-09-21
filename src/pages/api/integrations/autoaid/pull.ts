import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

type AutoAidSettingsRow = {
  id: string;
  provider: string;
  enabled?: boolean | null;
  api_base_url?: string | null;
  api_key_encrypted?: string | null;
  access_token_encrypted?: string | null;
  access_token_expires_at?: string | null;
  refresh_token_encrypted?: string | null;
  oauth_client_id?: string | null;
};

const DEFAULT_API_BASE = 'https://api-production.autoaid.de/cc/v3.0';
const DEFAULT_OAUTH_CLIENT_ID = 'connectedCarApi';
const OAUTH_ENDPOINT = 'https://oauth.autoaid.de';

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getRuntimeEnv(locals: any, request: Request) {
  const hostname = new URL(request.url).hostname;
  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
  const runtimeEnv = locals?.runtime?.env || {};

  return {
    supabaseUrl: isLocalDev
      ? import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL
      : runtimeEnv.PUBLIC_SUPABASE_URL || runtimeEnv.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL,
    supabaseServiceKey: isLocalDev
      ? import.meta.env.SUPABASE_SERVICE_ROLE_KEY
      : runtimeEnv.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    autoAidSecret: isLocalDev
      ? import.meta.env.AUTOAID_SETTINGS_SECRET
      : runtimeEnv.AUTOAID_SETTINGS_SECRET || import.meta.env.AUTOAID_SETTINGS_SECRET,
  };
}

async function getServerSupabase(locals: any, request: Request) {
  const env = getRuntimeEnv(locals, request);

  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new Error('Server configuration error: Supabase env vars missing');
  }

  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAuthenticatedUser(request: Request, cookies: any, supabase: any) {
  const cookieToken = cookies.get('sb-access-token')?.value || '';
  const authHeader = request.headers.get('authorization') || '';
  const explicitHeader = request.headers.get('x-opc-auth-token') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';
  const candidates = [bearerToken, explicitHeader, cookieToken].filter(Boolean);

  if (!candidates.length) throw new Error('Not authenticated');

  for (const token of candidates) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) return user;
  }

  throw new Error('Invalid authentication');
}

async function assertOwnerOrAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('opc_staff_roles')
    .select('id, role, status, can_access_portal')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('can_access_portal', true)
    .in('role', ['owner', 'admin'])
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Owner/Admin permission required');
  return data;
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function deriveEncryptionKey(secret: string, usages: KeyUsage[]) {
  const encoded = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, usages);
}

async function decryptSecret(value: string | null | undefined, secret: string) {
  if (!value) return '';
  const parts = value.split(':');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    throw new Error('Stored AutoAid token format is invalid');
  }
  const [, ivRaw, payloadRaw] = parts;
  const key = await deriveEncryptionKey(secret, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivRaw) },
    key,
    fromBase64(payloadRaw)
  );
  return new TextDecoder().decode(decrypted);
}

async function encryptSecret(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(secret, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value)
  );
  return `v1:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

function normalizeBaseUrl(row?: AutoAidSettingsRow | null) {
  return String(row?.api_base_url || DEFAULT_API_BASE).replace(/\/+$/, '');
}

function tokenLast4(value: string) {
  return value.slice(-4);
}

function normalizeArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  for (const key of ['data', 'items', 'results', 'vehicles', 'devices', 'records']) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  for (const key of ['data', 'result', 'response']) {
    if (payload[key] && typeof payload[key] === 'object') {
      const nested = normalizeArray(payload[key]);
      if (nested.length) return nested;
    }
  }

  return [];
}

function nestedValue(source: any, paths: string[]) {
  for (const path of paths) {
    const value = path.split('.').reduce((current, segment) => current?.[segment], source);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function textValue(source: any, paths: string[]) {
  const value = nestedValue(source, paths);
  return value === null || value === undefined ? null : String(value).trim() || null;
}

function numberValue(source: any, paths: string[]) {
  const value = nestedValue(source, paths);
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function statusValue(raw: any) {
  const rawStatus = String(textValue(raw, ['status', 'state', 'vehicleStatus']) || '').toLowerCase();
  if (rawStatus.includes('inactive') || rawStatus.includes('archived')) return 'inactive';
  if (rawStatus.includes('maintenance') || rawStatus.includes('repair')) return 'maintenance';
  if (rawStatus.includes('sold')) return 'sold';
  return 'active';
}

function normalizeVehicle(raw: any) {
  const directVehicle = raw?.vehicle && typeof raw.vehicle === 'object' ? { ...raw.vehicle, device: raw } : raw;
  const autoAidVehicleId = textValue(directVehicle, ['id', 'vehicleId', 'vehicle_id', 'uuid', 'autoaidVehicleId', 'vehicle.id'])
    || textValue(raw, ['vehicleId', 'vehicle_id', 'vin', 'VIN', 'deviceId', 'device_id', 'id']);
  const autoAidDeviceId = textValue(directVehicle, ['deviceId', 'device_id', 'device.id', 'dongleId', 'dongle_id'])
    || textValue(raw, ['deviceId', 'device_id', 'id']);
  const vin = textValue(directVehicle, ['vin', 'VIN', 'vehicleIdentificationNumber']);
  const licensePlate = textValue(directVehicle, ['licensePlate', 'license_plate', 'plate', 'registrationNumber', 'numberPlate']);
  const make = textValue(directVehicle, ['make', 'manufacturer', 'brand']);
  const model = textValue(directVehicle, ['model', 'modelName']);
  const modelYear = numberValue(directVehicle, ['modelYear', 'model_year', 'year']);
  const displayName = textValue(directVehicle, ['displayName', 'display_name', 'name', 'label'])
    || [make, model, licensePlate].filter(Boolean).join(' ')
    || (autoAidVehicleId ? `AutoAid Fahrzeug ${autoAidVehicleId}` : null);

  if (!autoAidVehicleId || !displayName) return null;

  return {
    raw,
    row: {
      autoaid_vehicle_id: autoAidVehicleId,
      autoaid_device_id: autoAidDeviceId,
      autoaid_device_imei: textValue(directVehicle, ['imei', 'device.imei']),
      license_plate: licensePlate,
      display_name: displayName,
      vin,
      make,
      model,
      model_year: modelYear,
      fuel_type: textValue(directVehicle, ['fuelType', 'fuel_type', 'fuel.type']),
      status: statusValue(directVehicle),
      metadata: directVehicle,
    },
  };
}

function normalizeStatusPayload(raw: any, vehicleId: string) {
  const latitude = numberValue(raw, ['latitude', 'lat', 'location.latitude', 'position.latitude', 'lastPosition.latitude', 'lastEvent.latitude']);
  const longitude = numberValue(raw, ['longitude', 'lon', 'lng', 'location.longitude', 'position.longitude', 'lastPosition.longitude', 'lastEvent.longitude']);
  const fuelLevelPercent = numberValue(raw, ['fuelLevelPercent', 'fuel_level_percent', 'fuel.percent', 'tank.percent', 'tankLevelPercent']);
  const rangeKm = numberValue(raw, ['rangeKm', 'range_km', 'fuelRangeKm', 'range']);
  const odometerKm = numberValue(raw, ['odometerKm', 'odometer_km', 'mileageKm', 'mileage_km', 'mileage', 'odometer']);
  const speedKmh = numberValue(raw, ['speedKmh', 'speed_kmh', 'speed', 'vehicleSpeed']);
  const batteryVoltage = numberValue(raw, ['batteryVoltage', 'battery_voltage', 'battery.voltage']);
  const dtcCount = numberValue(raw, ['dtcActiveCount', 'dtc_active_count', 'dtcCount', 'errors.count']);

  return {
    statusRow: {
      vehicle_id: vehicleId,
      last_seen_at: new Date().toISOString(),
      last_position_at: latitude !== null && longitude !== null ? new Date().toISOString() : null,
      latitude,
      longitude,
      speed_kmh: speedKmh,
      odometer_km: odometerKm,
      fuel_level_percent: fuelLevelPercent,
      range_km: rangeKm,
      battery_voltage: batteryVoltage,
      dtc_active_count: dtcCount || 0,
      status: speedKmh && speedKmh > 3 ? 'driving' : 'online',
      raw_status: raw,
      updated_at: new Date().toISOString(),
    },
    locationRow: latitude !== null && longitude !== null ? {
      vehicle_id: vehicleId,
      recorded_at: new Date().toISOString(),
      latitude,
      longitude,
      speed_kmh: speedKmh,
      payload: raw,
    } : null,
  };
}

async function refreshAccessToken(supabase: any, row: AutoAidSettingsRow, secret: string) {
  const refreshToken = await decryptSecret(row.refresh_token_encrypted || row.api_key_encrypted, secret);
  if (!refreshToken) throw new Error('Kein AutoAid Refresh Token hinterlegt');

  const body = new FormData();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);
  body.set('client_id', row.oauth_client_id || DEFAULT_OAUTH_CLIENT_ID);

  const response = await fetch(OAUTH_ENDPOINT, { method: 'POST', body });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`AutoAid OAuth Refresh fehlgeschlagen (${response.status}): ${text.slice(0, 240)}`);
  }

  const payload = JSON.parse(text);
  const accessToken = String(payload.access_token || '').trim();
  if (!accessToken) throw new Error('AutoAid OAuth Antwort enthält keinen access_token');

  const expiresIn = Number(payload.expires_in || 0);
  const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  const encrypted = await encryptSecret(accessToken, secret);
  await supabase
    .from('opc_integration_settings')
    .update({
      access_token_encrypted: encrypted,
      access_token_last4: tokenLast4(accessToken),
      access_token_set_at: new Date().toISOString(),
      access_token_expires_at: expiresAt,
    })
    .eq('id', row.id);

  return accessToken;
}

async function resolveAccessToken(supabase: any, row: AutoAidSettingsRow, secret: string) {
  const encryptedAccessToken = row.access_token_encrypted;
  const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0;
  const stillValid = encryptedAccessToken && (!expiresAt || expiresAt > Date.now() + 60_000);

  if (stillValid) return decryptSecret(encryptedAccessToken, secret);
  if (row.refresh_token_encrypted || row.api_key_encrypted) return refreshAccessToken(supabase, row, secret);
  if (encryptedAccessToken) return decryptSecret(encryptedAccessToken, secret);

  throw new Error('Kein AutoAid Access Token oder Refresh Token hinterlegt');
}

async function autoAidGet(baseUrl: string, accessToken: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`AutoAid ${path} fehlgeschlagen (${response.status}): ${text.slice(0, 240)}`);
  }

  return text ? JSON.parse(text) : null;
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const env = getRuntimeEnv(locals, request);
    if (!env.autoAidSecret) throw new Error('AUTOAID_SETTINGS_SECRET fehlt');

    const supabase = await getServerSupabase(locals, request);
    const user = await getAuthenticatedUser(request, cookies, supabase);
    await assertOwnerOrAdmin(supabase, user.id);

    const { data: settingsRow, error: settingsError } = await supabase
      .from('opc_integration_settings')
      .select('*')
      .eq('provider', 'autoaid')
      .maybeSingle();

    if (settingsError) throw settingsError;
    if (!settingsRow) throw new Error('AutoAid Einstellungen wurden noch nicht gespeichert');

    const row = settingsRow as AutoAidSettingsRow;
    const baseUrl = normalizeBaseUrl(row);
    const accessToken = await resolveAccessToken(supabase, row, env.autoAidSecret);

    let vehiclePayload: any = null;
    let devicePayload: any = null;
    const endpointErrors: string[] = [];

    try {
      vehiclePayload = await autoAidGet(baseUrl, accessToken, '/vehicles');
    } catch (error: any) {
      endpointErrors.push(error?.message || 'AutoAid /vehicles fehlgeschlagen');
    }

    try {
      devicePayload = await autoAidGet(baseUrl, accessToken, '/devices');
    } catch (error: any) {
      endpointErrors.push(error?.message || 'AutoAid /devices fehlgeschlagen');
    }

    const vehicleItems = normalizeArray(vehiclePayload).map(normalizeVehicle).filter(Boolean) as Array<{ raw: any; row: Record<string, unknown> }>;
    const deviceItems = normalizeArray(devicePayload).map(normalizeVehicle).filter(Boolean) as Array<{ raw: any; row: Record<string, unknown> }>;
    const byProviderId = new Map<string, { raw: any; row: Record<string, unknown> }>();

    [...vehicleItems, ...deviceItems].forEach((entry) => {
      const providerId = String(entry.row.autoaid_vehicle_id || '');
      if (providerId && !byProviderId.has(providerId)) byProviderId.set(providerId, entry);
    });

    const normalized = Array.from(byProviderId.values());
    if (!normalized.length) {
      return jsonResponse({
        ok: false,
        message: 'AutoAid hat keine Fahrzeuge geliefert. Prüfe, ob die AutoAid-Zugänge Fahrzeuge im Connected-Car-API-Profil enthalten.',
        endpoint_errors: endpointErrors,
      }, 422);
    }

    const vehicleRows = normalized.map((entry) => entry.row);
    const { error: upsertError } = await supabase
      .from('opc_fleet_vehicles')
      .upsert(vehicleRows, { onConflict: 'autoaid_vehicle_id' });

    if (upsertError) throw upsertError;

    const providerIds = vehicleRows.map((row: any) => row.autoaid_vehicle_id).filter(Boolean);
    const { data: storedVehicles, error: storedError } = await supabase
      .from('opc_fleet_vehicles')
      .select('id, autoaid_vehicle_id')
      .in('autoaid_vehicle_id', providerIds);

    if (storedError) throw storedError;

    const vehicleIdByProvider = new Map<string, string>();
    (storedVehicles || []).forEach((vehicle: any) => {
      if (vehicle.autoaid_vehicle_id) vehicleIdByProvider.set(vehicle.autoaid_vehicle_id, vehicle.id);
    });

    const statusRows: Record<string, unknown>[] = [];
    const locationRows: Record<string, unknown>[] = [];

    normalized.forEach((entry) => {
      const providerId = String(entry.row.autoaid_vehicle_id || '');
      const vehicleId = vehicleIdByProvider.get(providerId);
      if (!vehicleId) return;
      const normalizedStatus = normalizeStatusPayload(entry.raw, vehicleId);
      statusRows.push(normalizedStatus.statusRow);
      if (normalizedStatus.locationRow) locationRows.push(normalizedStatus.locationRow);
    });

    if (statusRows.length) {
      const { error } = await supabase
        .from('opc_vehicle_status_current')
        .upsert(statusRows, { onConflict: 'vehicle_id' });
      if (error) throw error;
    }

    if (locationRows.length) {
      const { error } = await supabase
        .from('opc_vehicle_locations')
        .insert(locationRows);
      if (error) throw error;
    }

    return jsonResponse({
      ok: true,
      message: `${vehicleRows.length} Fahrzeug(e) aus AutoAid synchronisiert.`,
      vehicles_synced: vehicleRows.length,
      statuses_synced: statusRows.length,
      locations_synced: locationRows.length,
      endpoint_errors: endpointErrors,
    });
  } catch (error: any) {
    return jsonResponse({ ok: false, message: error?.message || 'AutoAid Pull fehlgeschlagen' }, 500);
  }
};
