/**
 * Auth Check Script
 * 
 * This script should be imported in all protected .astro pages
 * It runs on page load to verify authentication status
 */

import { supabase } from '../lib/supabase';

/**
 * Check auth on protected pages with proper fallback logic
 * Tries user_profiles first, then falls back to users table
 */
export async function checkAuth(requiredRoles?: string[]) {
  try {
    console.log('🔐 Running auth check...');

    const profile = await checkAuthGuard('/miraka-co-portal');

    if (!profile) {
      // checkAuthGuard will handle redirect
      return null;
    }

    console.log('✅ Profile loaded:', profile.role);

    // Check role requirements if specified
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(profile.role)) {
        console.log(`❌ Access denied - required: ${requiredRoles.join(', ')}, has: ${profile.role}`);
        if (typeof window !== 'undefined') {
          window.location.href = '/miraka-co-portal/client-dashboard';
        }
        return null;
      }
    }

    console.log('✅ Auth check passed');

    return profile;
  } catch (err) {
    console.error('❌ Auth check error:', err);
    if (typeof window !== 'undefined') {
      window.location.href = '/miraka-co-portal';
    }
    return null;
  }
}

/**
 * Initialize auth state monitoring and online status
 * Call this once per page to monitor auth changes
 */
export function initAuthMonitoring(baseUrl: string = '/miraka-co-portal') {
  if (typeof window === 'undefined') return;

  console.log('🔄 Initializing auth monitoring...');

  // Listen for auth state changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('🔄 Auth state changed:', event);

    if (event === 'SIGNED_OUT') {
      console.log('→ User signed out, clearing storage');
      localStorage.clear();
      window.location.href = baseUrl;
    }

    if (event === 'TOKEN_REFRESHED') {
      console.log('→ Session token refreshed');
    }
  });

  // Update online status when page loads
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      supabase
        .from('users')
        .update({
          is_online: true,
          last_seen: new Date().toISOString(),
        })
        .eq('id', user.id)
        .then(() => console.log('✅ Online status updated'));
    }
  });

  // Set offline when page unloads
  window.addEventListener('beforeunload', () => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('users')
          .update({
            is_online: false,
            last_seen: new Date().toISOString(),
          })
          .eq('id', user.id);
      }
    });
  });

  console.log('✅ Auth monitoring initialized');
}

/**
 * Test function to verify session and auth token
 * Run this in browser console: testAuthSession()
 */
if (typeof window !== 'undefined') {
  (window as any).testAuthSession = async () => {
    console.log('🧪 Testing auth session...');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Session:', session);
    console.log('Session error:', sessionError);
    
    if (session) {
      console.log('✅ Session exists');
      console.log('→ User ID:', session.user.id);
      console.log('→ Email:', session.user.email);
      console.log('→ Access token present:', !!session.access_token);
      console.log('→ Token expires at:', new Date(session.expires_at! * 1000));
    } else {
      console.log('❌ No session');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('Auth user:', user);
    console.log('User error:', userError);

    if (user) {
      console.log('✅ Auth user verified');
      
      // Test user_profiles query
      console.log('→ Trying user_profiles...');
      const { data: userProfile, error: userProfileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      console.log('User profile (user_profiles):', userProfile);
      console.log('User profile error:', userProfileError);
      
      // Test users query
      console.log('→ Trying users...');
      const { data: usersProfile, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      console.log('User profile (users):', usersProfile);
      console.log('Users error:', usersError);
      
      if (userProfile || usersProfile) {
        console.log('✅ Profile found in:', userProfile ? 'user_profiles' : 'users');
      } else {
        console.log('❌ Profile not found in either table');
      }
    }
  };

  console.log('💡 Tip: Run testAuthSession() in console to debug auth');
}
