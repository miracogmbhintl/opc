import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
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

    const body = await request.json();
    const { userId, message, senderType } = body;

    if (!userId || !message || !senderType) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required fields'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create new message
    const newMessage = {
      id: Date.now().toString(),
      sender_type: senderType,
      message: message,
      timestamp: new Date().toISOString(),
      sender_name: senderType === 'admin' ? 'Support Team' : 'You',
      sender_avatar: null
    };

    // TODO: Save to Supabase
    // const { data, error } = await supabase
    //   .from('chat_messages')
    //   .insert({
    //     thread_id: userId,
    //     sender_type: senderType,
    //     message: message,
    //     timestamp: new Date().toISOString()
    //   })
    //   .select()
    //   .single();

    return new Response(JSON.stringify({
      success: true,
      message: newMessage
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
