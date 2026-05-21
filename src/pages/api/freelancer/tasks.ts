import type { APIRoute } from 'astro';

// Mock freelancer data
const freelancerData = {
  tasks: [
    {
      id: 1,
      title: 'Logo Concept Design',
      project: 'Brand Identity',
      priority: 'high',
      status: 'in-progress',
      due: 'Mar 10',
      progress: 60
    },
    {
      id: 2,
      title: 'Homepage Mockup',
      project: 'Website Development',
      priority: 'medium',
      status: 'pending',
      due: 'Mar 15',
      progress: 0
    }
  ],
  projects: [
    {
      id: 1,
      title: 'Brand Identity Redesign',
      client: 'Demo Corp',
      progress: 75,
      deadline: 'March 15'
    }
  ]
};

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(freelancerData), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
