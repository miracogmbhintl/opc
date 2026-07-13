/**
 * Session security helpers for Orange Pro Clean.
 *
 * Important production behavior:
 * - Supabase sessions remain persisted on the device.
 * - A session expires after seven complete days without portal activity.
 * - Temporary network and refresh errors do not immediately log the user out.
 * - Explicit logout still clears Supabase and local browser state.
 */

import { supabase } from './supabase';

const LOGOUT_FLAG_KEY = 'mco_logged_out';
const LAST_ACTIVITY_KEY = 'mco_last_activity';
const SESSION_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVITY_WRITE_THROTTLE_MS = 60 * 1000;

let isMonitoring = false;
let visibilityRefreshTimer: number | null = null;
let lastActivityWriteAt = 0;

function isBrowser() {
  return typeof window !== 'undefined';
}

function readLastActivityAt() {
  if (!isBrowser()) return 0;
  try {
    const value = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function inactivityExpired() {
  const lastActivityAt = readLastActivityAt();
  return lastActivityAt > 0 && Date.now() - lastActivityAt >= SESSION_INACTIVITY_MS;
}

function rememberActivity(force = false) {
  if (!isBrowser()) return;
  const now = Date.now();
  if (!force && now - lastActivityWriteAt < ACTIVITY_WRITE_THROTTLE_MS) return;
  lastActivityWriteAt = now;
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  } catch {
    // Ignore storage failures.
  }
}

async function refreshSessionSilently() {
  try {
    if (inactivityExpired()) {
      await secureLogout('/');
      return false;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) return true;
    if (!data?.session) return false;

    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) {
      return typeof navigator !== 'undefined' && navigator.onLine === false;
    }

    return Boolean(refreshed.data.session || data.session);
  } catch {
    return true;
  }
}

async function refreshOrRedirect() {
  const valid = await refreshSessionSilently();
  if (!valid && isBrowser()) window.location.replace('/');
}

function handleVisibilityChange() {
  if (document.hidden) return;

  if (visibilityRefreshTimer) {
    window.clearTimeout(visibilityRefreshTimer);
  }

  visibilityRefreshTimer = window.setTimeout(() => {
    void refreshOrRedirect();
  }, 250);
}

function handlePageShow() {
  void refreshOrRedirect();
}

export function startSessionMonitoring() {
  if (!isBrowser()) return;
  if (isMonitoring) return;

  try {
    window.sessionStorage.removeItem(LOGOUT_FLAG_KEY);
    window.localStorage.removeItem(LOGOUT_FLAG_KEY);
  } catch {
    // Ignore storage failures.
  }

  rememberActivity(true);

  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

  activityEvents.forEach((event) => {
    window.addEventListener(event, rememberActivity, { passive: true });
  });

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pageshow', handlePageShow);

  isMonitoring = true;
}

export function stopMonitoring() {
  if (!isBrowser()) return;

  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

  activityEvents.forEach((event) => {
    window.removeEventListener(event, rememberActivity);
  });

  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('pageshow', handlePageShow);

  if (visibilityRefreshTimer) {
    window.clearTimeout(visibilityRefreshTimer);
    visibilityRefreshTimer = null;
  }

  isMonitoring = false;
}

export async function secureLogout(redirectTo: string = '/') {
  stopMonitoring();

  try {
    window.sessionStorage.setItem(LOGOUT_FLAG_KEY, 'true');
    window.localStorage.setItem(LOGOUT_FLAG_KEY, 'true');
  } catch {
    // Ignore storage failures.
  }

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Ignore logout network failures and clear local state anyway.
  }

  if (isBrowser()) {
    const theme = window.localStorage.getItem('mco_theme');

    window.sessionStorage.clear();
    window.localStorage.clear();

    if (theme) {
      window.localStorage.setItem('mco_theme', theme);
    }

    window.sessionStorage.setItem(LOGOUT_FLAG_KEY, 'true');
    window.localStorage.setItem(LOGOUT_FLAG_KEY, 'true');

    window.history.replaceState(null, '', redirectTo);
    window.location.replace(redirectTo);
  }
}

export async function checkSessionBeforeRender(): Promise<boolean> {
  if (!isBrowser()) return false;

  try {
    const wasLoggedOut =
      window.sessionStorage.getItem(LOGOUT_FLAG_KEY) === 'true' ||
      window.localStorage.getItem(LOGOUT_FLAG_KEY) === 'true';

    if (wasLoggedOut) return false;

    if (inactivityExpired()) {
      await secureLogout('/');
      return false;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session) return false;

    rememberActivity(true);
    return true;
  } catch {
    return false;
  }
}

export function getRemainingSessionTime(): number {
  const lastActivityAt = readLastActivityAt();
  if (!lastActivityAt) return Math.floor(SESSION_INACTIVITY_MS / 1000);
  return Math.max(
    0,
    Math.ceil((SESSION_INACTIVITY_MS - (Date.now() - lastActivityAt)) / 1000),
  );
}

export function extendSession() {
  rememberActivity(true);
  void refreshOrRedirect();
}
