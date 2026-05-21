import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ locals, url }) => {
  try {
    // Get session
    const session = locals?.runtime?.session || locals?.session;
    
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get query parameters
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Get user profile to determine role and client_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, client_id')
      .eq('id', session.user.id)
      .single();

    // Build query
    let query = supabase
      .from('projects')
      .select(`
        id,
        project_title,
        status,
        progress_percent,
        deadline,
        created_at,
        updated_at,
        client:clients(company_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filter by client if user is a client
    if (profile?.role === 'client' && profile?.client_id) {
      query = query.eq('client_id', profile.client_id);
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: projects, error, count } = await query;

    if (error) {
      console.error('Error fetching projects:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch projects' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Transform projects to match expected format
    const transformedProjects = (projects || []).map((p: any) => ({
      id: p.id,
      name: p.project_title,
      status: p.status,
      progress: p.progress_percent || 0,
      deadline: p.deadline,
      updated_at: p.updated_at,
      client: p.client
    }));

    return new Response(JSON.stringify({ 
      projects: transformedProjects,
      total: count,
      limit,
      offset
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Projects list API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
