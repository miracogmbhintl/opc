import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const type = formData.get('type');
    const project = formData.get('project');
    const message = formData.get('message');
    const file = formData.get('file');

    // In production, this would:
    // 1. Save to database
    // 2. Create support ticket
    // 3. Send email to client
    // 4. Send email to staff

    console.log('Feedback submitted:', { type, project, message, file });

    return new Response(JSON.stringify({
      success: true,
      message: 'Feedback submitted successfully',
      ticketId: `TKT-${Date.now()}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ message: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
