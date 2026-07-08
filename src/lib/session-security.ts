/**
 * Session security helpers for Orange Pro Clean.
 *
 * Important production behavior:
 * - No automatic inactivity logout.
 * - No forced logout on temporary network/session validation errors.
 * - Explicit logout still clears Supabase and local browser state.
 *
 * Staff often use the portal on mobile while working on jobs. A strict
 * inactivity timeout can interrupt time tracking, reports and uploads.
 */

import { supabase } from './supabase';

const LOGOUT_FLAG_KEY = 'mco_logged_out';
const LAST_ACTIVITY_KEY = 'mco_last_activity';

let isMonitoring = false;
let visibilityRefreshTimer: number | null = null;

function isBrowser() {
  return typeof window !== 'undefined';
}

function rememberActivity() {
  if (!isBrowser()) return;

  try {
    window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // Ignore storage failures.
  }
}

async function refreshSessionSilently() {
  try {
    if (!supabase) return true;

    const { data } = await supabase.auth.getSession();

    if (!data?.session) {
      return false;
    }

    await supabase.auth.refreshSession();
    return true;
  } catch {
    return true;
  }
}

function handleVisibilityChange() {
  if (document.hidden) return;

  if (visibilityRefreshTimer) {
    window.clearTimeout(visibilityRefreshTimer);
  }

  visibilityRefreshTimer = window.setTimeout(() => {
    void refreshSessionSilently();
  }, 250);
}

function handlePageShow() {
  void refreshSessionSilently();
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

  rememberActivity();

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

    const { data } = await supabase.auth.getSession();

    if (data?.session) return true;

    return Boolean(
      window.localStorage.getItem('opc:auth-profile-cache:v5:persistent') ||
      window.localStorage.getItem('mco_user_data') ||
      window.localStorage.getItem('mco_auth')
    );
  } catch {
    return Boolean(
      window.localStorage.getItem('opc:auth-profile-cache:v5:persistent') ||
      window.localStorage.getItem('mco_user_data') ||
      window.localStorage.getItem('mco_auth')
    );
  }
}

export function getRemainingSessionTime(): number {
  return Number.POSITIVE_INFINITY;
}

export function extendSession() {
  rememberActivity();
  void refreshSessionSilently();
}
