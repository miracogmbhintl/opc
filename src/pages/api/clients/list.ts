import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const GET: APIRoute = async () => {
  try {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase credentials' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: clients, error } = await supabase
      .from('clients')
      .select(`
        id, 
        client_name, 
        company_name, 
        contact_person,
        status, 
        email, 
        phone, 
        last_activity_at
      `)
      .order('last_activity_at', { ascending: false });

    if (error) {
      console.error('Error fetching clients:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch project counts for each client
    const clientsWithProjectCount = await Promise.all(
      (clients || []).map(async (client) => {
        const { count } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('status', 'active');
        
        return {
          ...client,
          project_count: count || 0
        };
      })
    );

    return new Response(JSON.stringify({ clients: clientsWithProjectCount }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Failed to fetch clients:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
