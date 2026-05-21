import type { APIRoute } from 'astro';

// Mock project data - in production, this would come from a database
const projects: Record<string, any> = {
  '1': {
    id: '1',
    title: 'Brand Identity Redesign',
    category: 'Branding',
    status: 'active',
    progress: 65,
    deadline: 'Dec 20, 2025',
    nextStep: 'Client review of logo variations',
    client: {
      name: 'John Client',
      company: 'Demo Corp',
      email: 'client@demo.com'
    },
    budget: {
      total: 25000,
      paid: 15000,
      balance: 10000,
      currency: 'USD'
    },
    communications: [
      {
        date: '2025-01-15',
        type: 'Email',
        from: 'Jane Designer',
        to: 'John Client',
        subject: 'Logo Concepts Ready',
        summary: 'Sent initial logo concepts for review. Awaiting feedback on color preferences.'
      },
      {
        date: '2025-01-10',
        type: 'Call',
        from: 'John Client',
        to: 'Jane Designer',
        subject: 'Brand Discussion',
        summary: 'Discussed brand values and target audience. Client emphasized modern and professional feel.'
      },
      {
        date: '2025-01-05',
        type: 'Meeting',
        from: 'M&CO Team',
        to: 'John Client',
        subject: 'Kickoff Meeting',
        summary: 'Project kickoff. Discussed timeline, deliverables, and established communication channels.'
      }
    ],
    assignedEmployees: [
      { name: 'Jane Designer', initials: 'JD' },
      { name: 'Mike Creative', initials: 'MC' }
    ]
  },
  '2': {
    id: '2',
    title: 'Website Development',
    category: 'Web Design',
    status: 'pending',
    progress: 30,
    deadline: 'Jan 15, 2026',
    nextStep: 'Approve wireframes',
    client: {
      name: 'John Client',
      company: 'Demo Corp',
      email: 'client@demo.com'
    },
    budget: {
      total: 45000,
      paid: 15000,
      balance: 30000,
      currency: 'USD'
    },
    communications: [
      {
        date: '2025-01-12',
        type: 'Email',
        from: 'Tom Developer',
        to: 'John Client',
        subject: 'Wireframes Complete',
        summary: 'Completed wireframes for all main pages. Ready for client review and approval.'
      },
      {
        date: '2025-01-08',
        type: 'Call',
        from: 'John Client',
        to: 'Tom Developer',
        subject: 'Feature Clarification',
        summary: 'Clarified requirements for contact form and newsletter integration.'
      }
    ],
    assignedEmployees: [
      { name: 'Tom Developer', initials: 'TD' },
      { name: 'Sarah UX', initials: 'SU' }
    ]
  },
  '3': {
    id: '3',
    title: 'Social Media Campaign',
    category: 'Marketing',
    status: 'completed',
    progress: 100,
    deadline: 'Dec 1, 2025',
    nextStep: 'Final report delivery',
    client: {
      name: 'John Client',
      company: 'Demo Corp',
      email: 'client@demo.com'
    },
    budget: {
      total: 8000,
      paid: 8000,
      balance: 0,
      currency: 'USD'
    },
    communications: [
      {
        date: '2025-01-18',
        type: 'Email',
        from: 'Lisa Marketing',
        to: 'John Client',
        subject: 'Campaign Report',
        summary: 'Delivered final campaign report. Achieved 150% of target engagement.'
      },
      {
        date: '2025-01-01',
        type: 'Meeting',
        from: 'Lisa Marketing',
        to: 'John Client',
        subject: 'Campaign Wrap-up',
        summary: 'Reviewed campaign performance. Discussed learnings for future campaigns.'
      }
    ],
    assignedEmployees: [
      { name: 'Lisa Marketing', initials: 'LM' }
    ]
  },
  '4': {
    id: '4',
    title: 'Product Photography',
    category: 'Photography',
    status: 'at-risk',
    progress: 45,
    deadline: 'Nov 30, 2025',
    nextStep: 'Schedule reshoot',
    client: {
      name: 'John Client',
      company: 'Demo Corp',
      email: 'client@demo.com'
    },
    budget: {
      total: 12000,
      paid: 6000,
      balance: 6000,
      currency: 'USD'
    },
    communications: [
      {
        date: '2025-01-16',
        type: 'Call',
        from: 'John Client',
        to: 'Paul Photographer',
        subject: 'Urgent: Product Changes',
        summary: 'Client requested reshoot due to product updates. Scheduling new session for next week.'
      },
      {
        date: '2025-01-14',
        type: 'Email',
        from: 'Paul Photographer',
        to: 'John Client',
        subject: 'Initial Shots',
        summary: 'Delivered first batch of product photos. Client requested adjustments to lighting.'
      }
    ],
    assignedEmployees: [
      { name: 'Paul Photographer', initials: 'PP' }
    ]
  }
};

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  
  const project = projects[id as string];
  
  if (!project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ project }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
