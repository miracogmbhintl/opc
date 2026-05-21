/**
 * API Route: Update Notification Preferences
 * Allows users to update their notification settings
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Get Supabase credentials from environment
    const supabaseUrl = locals?.runtime?.env?.SUPABASE_URL || import.meta.env.SUPABASE_URL;
    const supabaseServiceKey = locals?.runtime?.env?.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Server configuration error' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Not authenticated' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify the user's session token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid authentication' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await request.json();
    const { 
      notify_project_updates,
      notify_new_messages,
      notify_file_uploads,
      notify_billing,
      push_notifications_enabled
    } = body;

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (notify_project_updates !== undefined) updateData.notify_project_updates = notify_project_updates;
    if (notify_new_messages !== undefined) updateData.notify_new_messages = notify_new_messages;
    if (notify_file_uploads !== undefined) updateData.notify_file_uploads = notify_file_uploads;
    if (notify_billing !== undefined) updateData.notify_billing = notify_billing;
    if (push_notifications_enabled !== undefined) updateData.push_notifications_enabled = push_notifications_enabled;

    // Update notification preferences in database
    const { data: updatedPreferences, error: updateError } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Notification preferences update error:', updateError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to update notification preferences',
        details: updateError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return success with updated preferences
    return new Response(JSON.stringify({ 
      success: true, 
      preferences: updatedPreferences,
      message: 'Notification preferences updated successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Unexpected error in notification preferences update:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
