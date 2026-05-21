import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    console.log('[invite-user] Starting user invitation process');

    // Get the auth token from the request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[invite-user] Missing or invalid authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);

    // Get Supabase credentials from environment
    const supabaseUrl = locals?.runtime?.env?.SUPABASE_URL || import.meta.env.SUPABASE_URL;
    const supabaseServiceKey = locals?.runtime?.env?.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('[invite-user] Supabase URL available:', !!supabaseUrl);
    console.log('[invite-user] Service key available:', !!supabaseServiceKey);

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the user making the request
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[invite-user] Invalid user token:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is an owner
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'owner') {
      console.error('[invite-user] User is not an owner');
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get request body
    const body = await request.json();
    const { email, clientId, clientName, companyName } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[invite-user] Inviting user:', email);

    // Check if user already exists
    const { data: existingUserData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('[invite-user] Error checking existing users:', listError);
    }

    const existingUser = existingUserData?.users?.find(u => u.email === email);

    if (existingUser) {
      console.log('[invite-user] User already exists:', existingUser.id);
      console.log('[invite-user] Sending password reset instead');
      
      // If user exists, send a password reset email
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${new URL(request.url).origin}/miraka-co-portal/reset-password`
      });

      if (resetError) {
        console.error('[invite-user] Error sending password reset:', resetError);
        return new Response(JSON.stringify({ 
          error: 'User already exists but failed to send password reset: ' + resetError.message
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'User already exists. Password reset email sent.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create new user with invitation
    console.log('[invite-user] Creating new user invitation for:', email);
    
    const redirectUrl = `${new URL(request.url).origin}/miraka-co-portal/set-password`;
    console.log('[invite-user] Redirect URL:', redirectUrl);

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        client_id: clientId,
        client_name: clientName,
        company_name: companyName,
        role: 'client'
      },
      redirectTo: redirectUrl
    });

    if (createError) {
      console.error('[invite-user] Error creating user:', createError);
      return new Response(JSON.stringify({ 
        error: 'Failed to send invitation: ' + createError.message
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[invite-user] User invited successfully:', newUser?.user?.email);
    console.log('[invite-user] User ID:', newUser?.user?.id);

    // Create user profile
    if (newUser?.user?.id) {
      console.log('[invite-user] Creating user profile for:', newUser.user.id);
      
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: newUser.user.id,
          email: email,
          full_name: clientName || email.split('@')[0],
          role: 'client',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.error('[invite-user] Error creating profile:', profileError);
        // Don't fail the whole operation, profile can be created later
      } else {
        console.log('[invite-user] Profile created successfully');
      }

      // Link to client record if clientId provided
      if (clientId) {
        console.log('[invite-user] Linking user to client:', clientId);
        
        const { error: linkError } = await supabaseAdmin
          .from('clients')
          .update({ 
            user_id: newUser.user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', clientId);

        if (linkError) {
          console.error('[invite-user] Error linking client:', linkError);
          // Don't fail the whole operation, can be linked later
        } else {
          console.log('[invite-user] Client linked successfully');
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Invitation email sent successfully',
      userId: newUser?.user?.id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[invite-user] Unexpected error:', error);
    console.error('[invite-user] Error stack:', error.stack);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to send invitation'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};



