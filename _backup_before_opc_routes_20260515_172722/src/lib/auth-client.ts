/**
 * Client-side auth utilities
 * Use this in React components that need to check auth status
 * All functions properly handle Supabase session tokens
 */

import { supabase } from './supabase';
import { secureLogout } from './session-security';

/**
 * Check if user is authenticated and redirect if not
 * Call this in useEffect on protected pages
 * Properly loads session from storage first
 */
export async function requireAuth(redirectTo: string = '/'): Promise<{ userId: string; role: string } | null> {
  try {
    // First check for session in storage
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      if (typeof window !== 'undefined') {
        window.location.href = redirectTo;
      }
      return null;
    }

    if (!session?.user) {
      console.log('❌ No valid session, redirecting to login');
      if (typeof window !== 'undefined') {
        window.location.href = redirectTo;
      }
      return null;
    }

    // Verify session is still valid
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ Session expired');
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        window.location.href = redirectTo;
      }
      return null;
    }

    // Fetch user profile (auth token automatically included)
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('❌ Could not fetch user profile');
      if (typeof window !== 'undefined') {
        window.location.href = redirectTo;
      }
      return null;
    }

    console.log('✅ Auth check passed:', user.email);

    return {
      userId: user.id,
      role: profile.role,
    };
  } catch (err) {
    console.error('❌ Auth check error:', err);
    if (typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
    return null;
  }
}

/**
 * Logout user and redirect to login page
 */
export async function logout(redirectTo: string = '/'): Promise<void> {
  await secureLogout(redirectTo);
}

/**
 * Get current user info from session
 * Loads session from storage and fetches profile
 */
export async function getCurrentUserInfo() {
  try {
    // Load session from storage
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      return null;
    }

    // Verify session is still valid
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return null;
    }

    // Fetch profile (auth token automatically included)
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role, full_name, email, avatar_url, is_online')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return null;
    }

    return {
      id: user.id,
      email: profile.email || user.email,
      name: profile.full_name,
      role: profile.role,
      avatar: profile.avatar_url,
      isOnline: profile.is_online,
    };
  } catch (err) {
    console.error('❌ Error getting user info:', err);
    return null;
  }
}

/**
 * Check if user has required role
 */
export async function hasRole(requiredRoles: string[]): Promise<boolean> {
  try {
    // Load session from storage
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return false;
    }

    // Fetch profile with auth token
    const { data: profile, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (error || !profile) {
      return false;
    }

    return requiredRoles.includes(profile.role);
  } catch (err) {
    console.error('❌ Error checking role:', err);
    return false;
  }
}

/**
 * Require specific role or redirect
 */
export async function requireRole(
  requiredRoles: string[],
  redirectTo: string = '/client-dashboard'
): Promise<boolean> {
  const hasRequiredRole = await hasRole(requiredRoles);
  
  if (!hasRequiredRole) {
    console.log('❌ Access denied: insufficient permissions');
    if (typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
    return false;
  }

  return true;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔄 Auth state changed:', event);
    callback(event, session);
  });
}

/**
 * Set user online status
 */
export async function setOnlineStatus(isOnline: boolean): Promise<void> {
  try {
    // Load session from storage
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return;
    }

    // Update with auth token automatically included
    await supabase
      .from('users')
      .update({
        is_online: isOnline,
        last_seen: new Date().toISOString(),
      })
      .eq('id', session.user.id);

    console.log(`✅ User status set to: ${isOnline ? 'online' : 'offline'}`);
  } catch (err) {
    console.error('❌ Error setting online status:', err);
  }
}

/**
 * Handle login and redirect based on user role
 */
export async function handleLoginSuccess(baseUrl: string = ''): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      console.error('❌ No session found after login');
      return;
    }

    // Fetch user profile to determine role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const role = profile?.role?.toLowerCase();
    let redirectPath = '/miraka-co-portal/dashboard';

    if (role === 'admin' || role === 'owner') {
      redirectPath = '/miraka-co-portal/admin/dashboard';
    } else if (role === 'client') {
      redirectPath = '/miraka-co-portal/client/dashboard';
    }

    if (typeof window !== 'undefined') {
      window.location.href = baseUrl + redirectPath;
    }
  } catch (err) {
    console.error('❌ Error handling login success:', err);
  }
}

/**
 * Check session and load it if exists
 * Call this on page load for protected pages
 */
export async function loadSession(): Promise<any | null> {
  try {
    console.log('🔄 Loading session from storage...');
    
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('❌ Session load error:', error);
      return null;
    }

    if (!session) {
      console.log('❌ No session found');
      return null;
    }

    console.log('✅ Session loaded:', session.user.email);
    console.log('→ Access token present:', !!session.access_token);
    console.log('→ Token expires:', new Date(session.expires_at! * 1000));

    return session;
  } catch (err) {
    console.error('❌ Session load error:', err);
    return null;
  }
}

