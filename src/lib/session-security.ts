/**
 * Session Security Manager
 * Handles:
 * 1. Auto logout after 15 minutes of inactivity
 * 2. Prevents back button bypass after logout
 * 3. Session validation and expiry
 */

import { supabase } from './supabase';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check every minute
const SESSION_STORAGE_KEY = 'mco_last_activity';
const LOGOUT_FLAG_KEY = 'mco_logged_out';

let inactivityTimer: NodeJS.Timeout | null = null;
let activityCheckInterval: NodeJS.Timeout | null = null;
let isMonitoring = false;

/**
 * Activity events to monitor
 */
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keypress',
  'scroll',
  'touchstart',
  'click',
];

/**
 * Update last activity timestamp
 */
function updateLastActivity() {
  if (typeof window === 'undefined') return;
  
  const now = Date.now();
  sessionStorage.setItem(SESSION_STORAGE_KEY, now.toString());
  
  // Reset inactivity timer
  resetInactivityTimer();
}

/**
 * Reset the inactivity timer
 */
function resetInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  
  inactivityTimer = setTimeout(() => {
    handleInactivityLogout();
  }, INACTIVITY_TIMEOUT);
}

/**
 * Handle automatic logout due to inactivity
 */
async function handleInactivityLogout() {
  console.log('🚨 Session expired due to inactivity');
  
  // Stop monitoring
  stopMonitoring();
  
  // Clear session
  await forceLogout('Session expired due to inactivity. Please log in again.');
}

/**
 * Force logout and redirect
 */
async function forceLogout(message?: string) {
  try {
    // Mark as logged out
    sessionStorage.setItem(LOGOUT_FLAG_KEY, 'true');
    localStorage.setItem(LOGOUT_FLAG_KEY, 'true');
    
    // Clear all session data
    sessionStorage.clear();
    
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Clear any cached credentials
    if (typeof window !== 'undefined') {
      // Clear all localStorage except theme preference
      const theme = localStorage.getItem('mco_theme');
      localStorage.clear();
      if (theme) {
        localStorage.setItem('mco_theme', theme);
      }
      
      // Show message if provided
      if (message) {
        // Store message to show on login page
        sessionStorage.setItem('mco_logout_message', message);
      }
      
      // Prevent back button from accessing cached pages
      window.history.replaceState(null, '', '/');
      
      // Redirect to login
      window.location.replace('/');
    }
  } catch (error) {
    console.error('Error during force logout:', error);
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  }
}

/**
 * Start monitoring user activity
 */
export function startSessionMonitoring() {
  if (typeof window === 'undefined') return;
  if (isMonitoring) return;
  
  console.log('🔒 Starting session security monitoring');
  
  // Clear logout flag when starting new session
  sessionStorage.removeItem(LOGOUT_FLAG_KEY);
  localStorage.removeItem(LOGOUT_FLAG_KEY);
  
  // Set initial activity timestamp
  updateLastActivity();
  
  // Add event listeners for user activity
  ACTIVITY_EVENTS.forEach(event => {
    window.addEventListener(event, updateLastActivity, { passive: true });
  });
  
  // Start periodic session validation
  activityCheckInterval = setInterval(async () => {
    await validateSession();
  }, ACTIVITY_CHECK_INTERVAL);
  
  // Start inactivity timer
  resetInactivityTimer();
  
  // Monitor page visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Prevent back button after logout
  window.addEventListener('pageshow', handlePageShow);
  
  isMonitoring = true;
}

/**
 * Stop monitoring user activity
 */
export function stopMonitoring() {
  if (typeof window === 'undefined') return;
  
  console.log('🔓 Stopping session security monitoring');
  
  // Remove event listeners
  ACTIVITY_EVENTS.forEach(event => {
    window.removeEventListener(event, updateLastActivity);
  });
  
  // Clear timers
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  
  if (activityCheckInterval) {
    clearInterval(activityCheckInterval);
    activityCheckInterval = null;
  }
  
  // Remove other listeners
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('pageshow', handlePageShow);
  
  isMonitoring = false;
}

/**
 * Handle page visibility changes (tab switching)
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // Page is hidden - user switched tab
    // Keep timer running
  } else {
    // Page is visible again - check if session is still valid
    validateSession();
  }
}

/**
 * Handle pageshow event (including back/forward navigation)
 */
function handlePageShow(event: PageTransitionEvent) {
  // Check if page was loaded from cache (bfcache)
  if (event.persisted) {
    console.log('⚠️ Page loaded from cache, validating session...');
    validateSession();
  }
  
  // Check if user was logged out
  const wasLoggedOut = sessionStorage.getItem(LOGOUT_FLAG_KEY) === 'true' ||
                       localStorage.getItem(LOGOUT_FLAG_KEY) === 'true';
  
  if (wasLoggedOut) {
    console.log('🚫 User was logged out, preventing back navigation');
    forceLogout('You have been logged out. Please log in again.');
  }
}

/**
 * Validate current session
 */
async function validateSession() {
  try {
    // Check if marked as logged out
    const wasLoggedOut = sessionStorage.getItem(LOGOUT_FLAG_KEY) === 'true' ||
                         localStorage.getItem(LOGOUT_FLAG_KEY) === 'true';
    
    if (wasLoggedOut) {
      await forceLogout('Session invalidated');
      return;
    }
    
    // Check Supabase session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.log('❌ Invalid session detected');
      await forceLogout('Your session has expired');
      return;
    }
    
    // Check if session token is expired
    if (session.expires_at) {
      const expiresAt = session.expires_at * 1000; // Convert to milliseconds
      if (Date.now() >= expiresAt) {
        console.log('❌ Session token expired');
        await forceLogout('Your session has expired');
        return;
      }
    }
    
    // Check last activity
    const lastActivityStr = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (lastActivityStr) {
      const lastActivity = parseInt(lastActivityStr, 10);
      const timeSinceActivity = Date.now() - lastActivity;
      
      if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
        console.log('❌ Inactivity timeout exceeded');
        await handleInactivityLogout();
        return;
      }
    }
    
    // Session is valid
    console.log('✅ Session validated');
  } catch (error) {
    console.error('Error validating session:', error);
    // Don't logout on validation errors - could be network issue
  }
}

/**
 * Secure logout function
 * Prevents back button bypass
 */
export async function secureLogout(redirectTo: string = '/') {
  console.log('🔒 Performing secure logout...');
  
  // Stop monitoring
  stopMonitoring();
  
  // Set logout flags
  sessionStorage.setItem(LOGOUT_FLAG_KEY, 'true');
  localStorage.setItem(LOGOUT_FLAG_KEY, 'true');
  
  try {
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Supabase logout error:', error);
    }
  } catch (error) {
    console.error('Error during logout:', error);
  }
  
  // Clear all session storage
  const theme = localStorage.getItem('mco_theme');
  sessionStorage.clear();
  localStorage.clear();
  
  // Restore theme
  if (theme) {
    localStorage.setItem('mco_theme', theme);
  }
  
  // Restore logout flags
  sessionStorage.setItem(LOGOUT_FLAG_KEY, 'true');
  localStorage.setItem(LOGOUT_FLAG_KEY, 'true');
  
  if (typeof window !== 'undefined') {
    // Clear browser history to prevent back navigation
    window.history.replaceState(null, '', redirectTo);
    
    // Force reload to clear any cached state
    window.location.replace(redirectTo);
  }
}

/**
 * Check if session is valid before rendering protected content
 */
export async function checkSessionBeforeRender(): Promise<boolean> {
  try {
    // Check logout flags first
    const wasLoggedOut = sessionStorage.getItem(LOGOUT_FLAG_KEY) === 'true' ||
                         localStorage.getItem(LOGOUT_FLAG_KEY) === 'true';
    
    if (wasLoggedOut) {
      console.log('🚫 Logout flag detected');
      return false;
    }
    
    // Check Supabase session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.log('❌ No valid session found');
      return false;
    }
    
    // Verify session is not expired
    if (session.expires_at && Date.now() >= session.expires_at * 1000) {
      console.log('❌ Session token expired');
      return false;
    }
    
    console.log('✅ Session valid for render');
    return true;
  } catch (error) {
    console.error('Error checking session:', error);
    return false;
  }
}

/**
 * Get remaining session time in seconds
 */
export function getRemainingSessionTime(): number {
  const lastActivityStr = sessionStorage.getItem(SESSION_STORAGE_KEY);
  
  if (!lastActivityStr) {
    return INACTIVITY_TIMEOUT / 1000;
  }
  
  const lastActivity = parseInt(lastActivityStr, 10);
  const timeSinceActivity = Date.now() - lastActivity;
  const remaining = INACTIVITY_TIMEOUT - timeSinceActivity;
  
  return Math.max(0, Math.floor(remaining / 1000));
}

/**
 * Extend session (manual activity trigger)
 */
export function extendSession() {
  updateLastActivity();
  console.log('✅ Session extended');
}
