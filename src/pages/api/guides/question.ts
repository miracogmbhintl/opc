import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { name: string; email: string; message: string };
    const { name, email, message } = body;

    // In production, this would:
    // 1. Save to database
    // 2. Create support ticket
    // 3. Send email notification

    console.log('Guide question submitted:', { name, email, message });

    return new Response(JSON.stringify({
      success: true,
      message: 'Question submitted successfully'
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
