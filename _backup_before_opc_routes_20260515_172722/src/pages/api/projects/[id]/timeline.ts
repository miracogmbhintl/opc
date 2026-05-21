import type { APIRoute } from 'astro';

// Mock timeline data
const timelineData: Record<string, any[]> = {
  '1': [
    { id: 't1', name: 'Onboarding', status: 'completed', date: 'January 5, 2024' },
    { id: 't2', name: 'Discovery & Research', status: 'completed', date: 'January 15, 2024' },
    { id: 't3', name: 'Concept Development', status: 'current', date: 'February 20, 2024' },
    { id: 't4', name: 'Refinement', status: 'upcoming', date: 'March 5, 2024' },
    { id: 't5', name: 'Final Delivery', status: 'upcoming', date: 'March 15, 2024' }
  ],
  '2': [
    { id: 't6', name: 'Project Kickoff', status: 'completed', date: 'January 10, 2024' },
    { id: 't7', name: 'UX Research', status: 'completed', date: 'January 25, 2024' },
    { id: 't8', name: 'Design Phase', status: 'current', date: 'February 25, 2024' },
    { id: 't9', name: 'Development', status: 'upcoming', date: 'March 15, 2024' },
    { id: 't10', name: 'Testing & Launch', status: 'upcoming', date: 'April 1, 2024' }
  ],
  '3': [
    { id: 't11', name: 'Strategy Planning', status: 'completed', date: 'February 10, 2024' },
    { id: 't12', name: 'Content Creation', status: 'current', date: 'March 1, 2024' },
    { id: 't13', name: 'Campaign Launch', status: 'upcoming', date: 'March 20, 2024' }
  ]
};

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  const timeline = timelineData[id || ''] || [];

  return new Response(JSON.stringify({ timeline }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
