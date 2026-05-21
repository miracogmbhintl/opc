import type { APIRoute } from 'astro';

// Mock milestones data
const milestonesData: Record<string, any[]> = {
  '1': [
    {
      id: 'm1',
      title: 'Brand Discovery & Research',
      status: 'complete',
      description: 'Initial research and discovery phase completed',
      date: 'January 15, 2024',
      category: 'Research',
      assignedPerson: { name: 'Sarah Designer', initials: 'SD' },
      files: [
        { name: 'brand-research.pdf', url: '#', type: 'pdf' },
        { name: 'competitor-analysis.xlsx', url: '#', type: 'excel' }
      ],
      comments: [
        { author: 'Client', message: 'Great insights!', date: 'Jan 16, 2024' },
        { author: 'Sarah Designer', message: 'Thank you! Moving to next phase.', date: 'Jan 17, 2024' }
      ],
      changelog: [
        { action: 'Milestone completed', date: 'Jan 15, 2024', user: 'Sarah Designer' },
        { action: 'Files uploaded', date: 'Jan 15, 2024', user: 'Sarah Designer' },
        { action: 'Milestone created', date: 'Jan 1, 2024', user: 'System' }
      ]
    },
    {
      id: 'm2',
      title: 'Logo Concept Development',
      status: 'active',
      description: 'Creating initial logo concepts based on brand research',
      date: 'February 20, 2024',
      category: 'Design',
      assignedPerson: { name: 'Mike Creative', initials: 'MC' },
      files: [
        { name: 'logo-concepts-v1.ai', url: '#', type: 'illustrator' },
        { name: 'logo-presentation.pdf', url: '#', type: 'pdf' }
      ],
      comments: [
        { author: 'Mike Creative', message: 'First concepts ready for review', date: 'Feb 20, 2024' }
      ],
      changelog: [
        { action: 'Files uploaded', date: 'Feb 20, 2024', user: 'Mike Creative' },
        { action: 'Work started', date: 'Feb 1, 2024', user: 'Mike Creative' },
        { action: 'Milestone created', date: 'Jan 20, 2024', user: 'System' }
      ]
    },
    {
      id: 'm3',
      title: 'Brand Guidelines Creation',
      status: 'pending',
      description: 'Develop comprehensive brand guidelines document',
      date: 'March 10, 2024',
      category: 'Documentation',
      assignedPerson: { name: 'Sarah Designer', initials: 'SD' },
      files: [],
      comments: [],
      changelog: [
        { action: 'Milestone created', date: 'Jan 1, 2024', user: 'System' }
      ]
    }
  ],
  '2': [
    {
      id: 'm4',
      title: 'Website Wireframes',
      status: 'complete',
      description: 'Initial wireframes for all pages',
      date: 'February 1, 2024',
      category: 'UX Design',
      assignedPerson: { name: 'Jane UX', initials: 'JU' },
      files: [
        { name: 'wireframes.fig', url: '#', type: 'figma' }
      ],
      comments: [
        { author: 'Client', message: 'Wireframes approved!', date: 'Feb 5, 2024' }
      ],
      changelog: [
        { action: 'Approved by client', date: 'Feb 5, 2024', user: 'Client' },
        { action: 'Milestone completed', date: 'Feb 1, 2024', user: 'Jane UX' }
      ]
    },
    {
      id: 'm5',
      title: 'Homepage Design',
      status: 'pending',
      description: 'High-fidelity homepage design needs client approval',
      date: 'February 25, 2024',
      category: 'UI Design',
      assignedPerson: { name: 'Tom Developer', initials: 'TD' },
      files: [
        { name: 'homepage-design.fig', url: '#', type: 'figma' }
      ],
      comments: [
        { author: 'Tom Developer', message: 'Homepage design ready for review', date: 'Feb 25, 2024' }
      ],
      changelog: [
        { action: 'Files uploaded', date: 'Feb 25, 2024', user: 'Tom Developer' },
        { action: 'Work started', date: 'Feb 10, 2024', user: 'Tom Developer' }
      ]
    }
  ],
  '3': [
    {
      id: 'm6',
      title: 'Marketing Strategy',
      status: 'at-risk',
      description: 'Waiting for marketing materials from client',
      date: 'March 1, 2024',
      category: 'Strategy',
      assignedPerson: { name: 'Alex Marketing', initials: 'AM' },
      files: [],
      comments: [
        { author: 'Alex Marketing', message: 'Need client materials to proceed', date: 'Mar 1, 2024' }
      ],
      changelog: [
        { action: 'Marked as at-risk', date: 'Mar 5, 2024', user: 'Alex Marketing' },
        { action: 'Work started', date: 'Feb 15, 2024', user: 'Alex Marketing' }
      ]
    }
  ]
};

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  const milestones = milestonesData[id || ''] || [];

  return new Response(JSON.stringify({ milestones }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
