import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, locals }) => {
  console.log('[export-archive] Request received');
  
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[export-archive] Missing authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Get Supabase credentials - check all possible locations
    const supabaseUrl = 
      locals?.runtime?.env?.PUBLIC_SUPABASE_URL || 
      import.meta.env.PUBLIC_SUPABASE_URL;
    
    const supabaseKey = 
      locals?.runtime?.env?.SUPABASE_SERVICE_ROLE_KEY || 
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
      locals?.runtime?.env?.SUPABASE_SERVICE_ROLE || 
      import.meta.env.SUPABASE_SERVICE_ROLE;

    console.log('[export-archive] Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlSource: supabaseUrl ? (locals?.runtime?.env?.PUBLIC_SUPABASE_URL ? 'runtime' : 'import.meta') : 'none',
      keySource: supabaseKey ? 
        (locals?.runtime?.env?.SUPABASE_SERVICE_ROLE_KEY ? 'runtime.SERVICE_ROLE_KEY' :
         import.meta.env.SUPABASE_SERVICE_ROLE_KEY ? 'meta.SERVICE_ROLE_KEY' :
         locals?.runtime?.env?.SUPABASE_SERVICE_ROLE ? 'runtime.SERVICE_ROLE' : 'meta.SERVICE_ROLE') : 'none'
    });

    if (!supabaseUrl || !supabaseKey) {
      console.error('[export-archive] Missing Supabase credentials');
      return new Response(JSON.stringify({ 
        error: 'Server configuration error - missing Supabase credentials',
        details: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey
        }
      }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('[export-archive] Verifying user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[export-archive] User verification failed:', userError);
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
    }

    console.log('[export-archive] User verified:', user.id);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('[export-archive] User role:', profile?.role);

    if (profile?.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Permission denied: Owner access required' }), { status: 403 });
    }

    // Get client ID from request
    const { clientId } = await request.json();
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'Client ID required' }), { status: 400 });
    }

    console.log('[export-archive] Fetching client data for:', clientId);

    // Fetch complete client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('[export-archive] Client not found:', clientError);
      return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 });
    }

    console.log('[export-archive] Client found:', client.company_name);

    // Fetch related data with error handling
    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .then(res => res)
      .catch(() => ({ data: [] }));

    const { data: tickets } = await supabase
      .from('tickets')
      .select('*')
      .eq('client_id', clientId)
      .then(res => res)
      .catch(() => ({ data: [] }));

    // Chat messages - handle if table doesn't exist
    let chatMessages = [];
    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('client_id', clientId);
      chatMessages = data || [];
    } catch (err) {
      console.log('[export-archive] chat_messages table not found, skipping');
      chatMessages = [];
    }

    // Files - handle if table doesn't exist
    let files = [];
    try {
      const { data } = await supabase
        .from('files')
        .select('*')
        .eq('client_id', clientId);
      files = data || [];
    } catch (err) {
      console.log('[export-archive] files table not found, skipping');
      files = [];
    }

    // Activity logs - handle if table doesn't exist
    let activityLogs = [];
    try {
      const projectIds = (projects || []).map((p: any) => p.id);
      const ticketIds = (tickets || []).map((t: any) => t.id);
      
      let query = supabase.from('activity_log').select('*');
      
      // Build OR conditions safely
      const conditions = [
        `and(resource_type.eq.client,resource_id.eq.${clientId})`
      ];
      
      if (projectIds.length > 0) {
        conditions.push(`and(resource_type.eq.project,resource_id.in.(${projectIds.join(',')}))`);
      }
      
      if (ticketIds.length > 0) {
        conditions.push(`and(resource_type.eq.ticket,resource_id.in.(${ticketIds.join(',')}))`);
      }
      
      const { data } = await query.or(conditions.join(','));
      activityLogs = data || [];
    } catch (err) {
      console.log('[export-archive] activity_log table not found or query failed, skipping');
      activityLogs = [];
    }

    // Get project-related data
    const projectIds = (projects || []).map((p: any) => p.id);
    let projectNotes: any[] = [];
    let projectMilestones: any[] = [];
    let projectChecklist: any[] = [];
    let projectTimeline: any[] = [];
    let projectFiles: any[] = [];

    if (projectIds.length > 0) {
      // Project notes
      try {
        const { data } = await supabase.from('project_notes').select('*').in('project_id', projectIds);
        projectNotes = data || [];
      } catch (err) {
        console.log('[export-archive] project_notes table not found, skipping');
      }

      // Project milestones
      try {
        const { data } = await supabase.from('project_milestones').select('*').in('project_id', projectIds);
        projectMilestones = data || [];
      } catch (err) {
        console.log('[export-archive] project_milestones table not found, skipping');
      }

      // Project checklist
      try {
        const { data } = await supabase.from('project_checklist').select('*').in('project_id', projectIds);
        projectChecklist = data || [];
      } catch (err) {
        console.log('[export-archive] project_checklist table not found, skipping');
      }

      // Project timeline
      try {
        const { data } = await supabase.from('project_timeline').select('*').in('project_id', projectIds);
        projectTimeline = data || [];
      } catch (err) {
        console.log('[export-archive] project_timeline table not found, skipping');
      }

      // Project files
      try {
        const { data } = await supabase.from('project_files').select('*').in('project_id', projectIds);
        projectFiles = data || [];
      } catch (err) {
        console.log('[export-archive] project_files table not found, skipping');
      }
    }

    console.log('[export-archive] Data collected successfully');

    // Build comprehensive archive
    const archiveData = {
      export_info: {
        exported_at: new Date().toISOString(),
        exported_by: user.email,
        client_id: clientId,
        version: '1.0'
      },
      client: {
        ...client,
        archived_at: new Date().toISOString()
      },
      projects: projects || [],
      project_notes: projectNotes,
      project_milestones: projectMilestones,
      project_checklist: projectChecklist,
      project_timeline: projectTimeline,
      project_files: projectFiles,
      tickets: tickets || [],
      chat_messages: chatMessages,
      files: files,
      activity_logs: activityLogs,
      summary: {
        total_projects: (projects || []).length,
        total_tickets: (tickets || []).length,
        total_files: files.length,
        total_chat_messages: chatMessages.length,
        total_activity_logs: activityLogs.length,
        total_project_notes: projectNotes.length,
        total_project_milestones: projectMilestones.length,
        total_project_checklist: projectChecklist.length,
        total_project_timeline: projectTimeline.length,
        total_project_files: projectFiles.length
      }
    };

    console.log('[export-archive] Returning archive data');

    // Return JSON
    return new Response(JSON.stringify(archiveData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${client.company_name.replace(/\s+/g, '_')}_archive_${new Date().toISOString().split('T')[0]}.json"`
      }
    });

  } catch (err: any) {
    console.error('[export-client-archive] Unexpected error:', err);
    return new Response(JSON.stringify({ 
      error: err.message || 'Export failed',
      stack: err.stack
    }), { status: 500 });
  }
};
