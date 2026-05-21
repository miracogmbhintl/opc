import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ locals }) => {
  try {
    // Get session
    const session = locals?.runtime?.session || locals?.session;
    
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user profile to find client_id
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('client_id, role')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile || profile.role !== 'client') {
      return new Response(JSON.stringify({ error: 'Not a client user' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all projects for this client
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, status, progress_percent')
      .eq('client_id', profile.client_id);

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch projects' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate statistics
    const total_projects = projects?.length || 0;
    const completed = projects?.filter(p => p.status === 'completed').length || 0;
    const in_progress = projects?.filter(p => 
      p.status === 'active' || p.status === 'in_progress'
    ).length || 0;

    // Calculate overall completion (average progress of all projects)
    const overall_completion = total_projects > 0
      ? Math.round(
          projects.reduce((sum, p) => sum + (p.progress_percent || 0), 0) / total_projects
        )
      : 0;

    return new Response(JSON.stringify({
      total_projects,
      completed,
      in_progress,
      overall_completion
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Project progress API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
