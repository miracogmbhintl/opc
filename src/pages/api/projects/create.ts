import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json()

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL
  const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE || import.meta.env.SUPABASE_SERVICE_ROLE

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({ error: 'Supabase configuration missing' }),
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { error } = await supabase
    .from('projects')
    .insert({
      project_title: body.title,
      client_id: body.client_id,
      category: body.category,
      status: body.status,
      deadline: body.deadline,
      progress_percent: body.progress ?? 0,
      description: body.description
    })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 403 }
    )
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200 }
  )
}




