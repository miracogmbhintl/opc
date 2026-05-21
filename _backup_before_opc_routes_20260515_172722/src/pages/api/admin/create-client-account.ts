import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, locals }) => {
  const requestId = Date.now().toString(36);
  console.log(`🔵 [${requestId}] create-client-account: Request received`);
  console.log(`🔵 [${requestId}] Request origin:`, request.url);
  console.log(`🔵 [${requestId}] Runtime env available:`, !!locals?.runtime?.env);

  try {
    // Get Supabase service role credentials - check all possible sources
    const supabaseUrl = 
      locals?.runtime?.env?.PUBLIC_SUPABASE_URL || 
      import.meta.env.PUBLIC_SUPABASE_URL;
    
    const serviceRoleKey = 
      locals?.runtime?.env?.SUPABASE_SERVICE_ROLE_KEY || 
      locals?.runtime?.env?.SUPABASE_SERVICE_ROLE ||
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
      import.meta.env.SUPABASE_SERVICE_ROLE;

    console.log(`🔍 [${requestId}] Environment check:`, {
      supabaseUrl: supabaseUrl ? '✓ SET' : '✗ MISSING',
      serviceRoleKey: serviceRoleKey ? '✓ SET (length: ' + serviceRoleKey?.length + ')' : '✗ MISSING',
      hasRuntimeEnv: !!locals?.runtime?.env,
      hasImportMetaEnv: !!import.meta.env.PUBLIC_SUPABASE_URL
    });

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`❌ [${requestId}] Missing Supabase credentials`);
      console.error(`❌ [${requestId}] URL: ${supabaseUrl ? 'SET' : 'MISSING'}`);
      console.error(`❌ [${requestId}] Key: ${serviceRoleKey ? 'SET' : 'MISSING'}`);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error - Missing Supabase credentials',
        debug: {
          hasUrl: !!supabaseUrl,
          hasKey: !!serviceRoleKey,
          hasRuntimeEnv: !!locals?.runtime?.env,
          requestId
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create admin client with service role
    console.log(`🔧 [${requestId}] Creating Supabase admin client...`);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the requesting user is admin/owner
    const authHeader = request.headers.get('Authorization');
    console.log(`🔐 [${requestId}] Auth header present:`, !!authHeader);
    
    if (!authHeader) {
      console.error(`❌ [${requestId}] No authorization header`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized - No authentication provided',
        requestId
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log(`🔑 [${requestId}] Verifying token...`);
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error(`❌ [${requestId}] Invalid token:`, userError?.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid authentication',
        requestId
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`✓ [${requestId}] Token verified for user:`, user.id);

    // Check user role
    console.log(`👤 [${requestId}] Checking user role...`);
    const { data: profile, error: profileFetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileFetchError) {
      console.error(`❌ [${requestId}] Failed to fetch user profile:`, profileFetchError);
    }

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      console.error(`❌ [${requestId}] User lacks admin privileges. Role:`, profile?.role);
      return new Response(JSON.stringify({
        success: false,
        error: 'Insufficient permissions - Admin or Owner role required',
        requestId
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`✓ [${requestId}] Admin authorization confirmed. Role:`, profile.role);

    // Parse request body
    const body = await request.json();
    const { 
      companyName, 
      fullName, 
      email, 
      phone,
      website,
      industry,
      taxId,
      preferredContact,
      address,
      internalNotes
    } = body;

    console.log(`📋 [${requestId}] Creating client account:`, { 
      companyName, 
      fullName, 
      email: email?.substring(0, 3) + '***'  // Partial email for privacy
    });

    // Validate required fields
    if (!companyName || !fullName || !email) {
      console.error(`❌ [${requestId}] Missing required fields`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Company name, full name, and email are required',
        requestId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error(`❌ [${requestId}] Invalid email format`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email address format',
        requestId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 1: Create auth user
    console.log(`👤 [${requestId}] Step 1: Creating auth user...`);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      email_confirm: false,
      user_metadata: {
        full_name: fullName.trim(),
        company_name: companyName.trim(),
        role: 'client'
      }
    });

    if (authError) {
      console.error(`❌ [${requestId}] Auth creation failed:`, authError.message);
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to create user account: ${authError.message}`,
        requestId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!authData.user) {
      console.error(`❌ [${requestId}] No user returned from auth creation`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to create user account - no user returned',
        requestId
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = authData.user.id;
    console.log(`✓ [${requestId}] Auth user created:`, userId);

    // Step 2: Create user profile
    console.log(`📝 [${requestId}] Step 2: Creating user profile...`);
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: userId,
        email: email.toLowerCase().trim(),
        full_name: fullName.trim(),
        role: 'client',
        created_at: new Date().toISOString()
      });

    if (profileError) {
      console.error(`❌ [${requestId}] Profile creation failed:`, profileError.message);
      console.log(`🔄 [${requestId}] Rolling back: Deleting auth user...`);
      
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.log(`✓ [${requestId}] Rollback complete`);
      } catch (rollbackError) {
        console.error(`❌ [${requestId}] Rollback failed:`, rollbackError);
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to create user profile: ${profileError.message}`,
        requestId
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`✓ [${requestId}] User profile created`);

    // Step 3: Create client record
    console.log(`🏢 [${requestId}] Step 3: Creating client record...`);
    const clientData: any = {
      user_id: userId,
      company_name: companyName.trim(),
      client_name: fullName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      industry: industry || null,
      tax_id: taxId?.trim() || null,
      preferred_contact: preferredContact || 'email',
      street: address?.street?.trim() || null,
      street_number: address?.streetNumber?.trim() || null,
      city: address?.city?.trim() || null,
      state: address?.state?.trim() || null,
      zip_code: address?.zipCode?.trim() || null,
      country: address?.country || null,
      internal_notes: internalNotes?.trim() || null,
      status: 'active',
      created_at: new Date().toISOString()
    };

    const { error: clientError } = await supabaseAdmin
      .from('clients')
      .insert(clientData);

    if (clientError) {
      console.error(`❌ [${requestId}] Client creation failed:`, clientError.message);
      console.log(`🔄 [${requestId}] Rolling back: Deleting profile and auth user...`);
      
      try {
        await supabaseAdmin.from('user_profiles').delete().eq('id', userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.log(`✓ [${requestId}] Rollback complete`);
      } catch (rollbackError) {
        console.error(`❌ [${requestId}] Rollback failed:`, rollbackError);
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to create client record: ${clientError.message}`,
        requestId
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`✓ [${requestId}] Client record created`);

    // Step 4: Send password setup email
    console.log(`📧 [${requestId}] Step 4: Sending password setup email...`);
    const origin = new URL(request.url).origin;
    const redirectUrl = `${origin}/miraka-co-portal/set-password`;
    
    console.log(`📧 [${requestId}] Redirect URL:`, redirectUrl);
    
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim(),
      {
        redirectTo: redirectUrl
      }
    );

    if (inviteError) {
      console.warn(`⚠️ [${requestId}] Failed to send invite email:`, inviteError.message);
      // Don't fail the request, user was created successfully
    } else {
      console.log(`✓ [${requestId}] Password setup email sent`);
    }

    // Success!
    console.log(`🎉 [${requestId}] Client account created successfully`);
    console.log(`✅ [${requestId}] Summary: User ID: ${userId}, Email: ${email}`);
    
    return new Response(JSON.stringify({
      success: true,
      userId: userId,
      message: 'Client account created successfully. Password setup email sent.',
      requestId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    console.error(`❌ [${requestId}] Error stack:`, error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'An unexpected error occurred',
      errorType: error.constructor.name,
      requestId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
