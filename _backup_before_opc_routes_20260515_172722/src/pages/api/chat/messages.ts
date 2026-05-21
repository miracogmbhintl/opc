import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get userId from query params
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'User ID required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mock messages for now - you'll replace this with Supabase queries
    const mockMessages = [
      {
        id: '1',
        sender_type: 'admin',
        message: 'Willkommen bei Miraka & Co. Wie können wir Ihnen helfen?',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        sender_name: 'Support Team',
        sender_avatar: null
      },
      {
        id: '2',
        sender_type: 'client',
        message: 'Hallo, ich hätte eine Frage zu meinem Projekt.',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        sender_name: 'Client',
        sender_avatar: null
      },
      {
        id: '3',
        sender_type: 'admin',
        message: 'Natürlich, gerne! Was möchten Sie wissen?',
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        sender_name: 'Support Team',
        sender_avatar: null
      }
    ];

    return new Response(JSON.stringify({
      success: true,
      messages: mockMessages
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
