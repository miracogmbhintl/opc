import type { APIRoute } from 'astro';

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    const body = await request.json();
    const { description } = body as { description: string };

    // Validate inputs
    if (!id) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Project ID is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!description || description.trim().length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Description cannot be empty' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // TODO: Replace with actual database update
    // Example:
    // await db.projects.update({
    //   where: { id },
    //   data: { description }
    // });

    console.log(`✅ Project ${id} description updated:`, description.substring(0, 50) + '...');

    // Return success response
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Project description updated successfully',
      data: {
        id,
        description
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Error updating project description:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
