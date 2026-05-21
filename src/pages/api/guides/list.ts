import type { APIRoute } from 'astro';

// Mock guides data
const guides = [
  {
    id: '1',
    title: 'Getting Started with Your Client Portal',
    category: 'getting-started',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Learn the basics of navigating your M&CO client portal and accessing your projects.',
    instructions: `
      <ol>
        <li>Log in to your client portal using your credentials</li>
        <li>Review your dashboard to see active projects and pending actions</li>
        <li>Click on any project card to view detailed information</li>
        <li>Use the search bar to quickly find projects, files, or tasks</li>
        <li>Check the notification bell regularly for important updates</li>
      </ol>
    `
  },
  {
    id: '2',
    title: 'How to Submit Feedback on Projects',
    category: 'feedback',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'A step-by-step guide to submitting feedback, questions, and approvals for your projects.',
    instructions: `
      <ol>
        <li>Navigate to the Feedback section on your dashboard</li>
        <li>Select the type of feedback (question, issue, suggestion, or approval)</li>
        <li>Choose the project you want to provide feedback for</li>
        <li>Upload any relevant files (images, documents, etc.)</li>
        <li>Write your detailed feedback in the message box</li>
        <li>Click Submit to create a support ticket</li>
        <li>You'll receive email confirmation and our team will respond within 24 hours</li>
      </ol>
    `
  },
  {
    id: '3',
    title: 'Understanding Project Milestones',
    category: 'projects',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Learn how to track project progress through milestones and timelines.',
    instructions: `
      <ol>
        <li>Open any project from your dashboard</li>
        <li>View the milestone panel to see project stages</li>
        <li>Check the status colors:
          <ul>
            <li>Green = Completed</li>
            <li>Orange = Pending/Approaching</li>
            <li>Black = Active</li>
            <li>Red = At Risk</li>
          </ul>
        </li>
        <li>Click on individual milestones to see files, comments, and changelog</li>
        <li>Review assigned team members for each milestone</li>
        <li>Sort milestones by status or date for better overview</li>
      </ol>
    `
  },
  {
    id: '4',
    title: 'Customizing Your Profile Settings',
    category: 'settings',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Personalize your portal experience by updating profile information and preferences.',
    instructions: `
      <ol>
        <li>Click on your profile icon in the top-right corner</li>
        <li>Select "Profile Settings" from the dropdown menu</li>
        <li>Update your company information, contact details, and address</li>
        <li>Toggle dark mode for better viewing experience</li>
        <li>Upload and crop your company logo</li>
        <li>Choose your preferred theme colors</li>
        <li>Click "Save Profile" to apply changes</li>
        <li>Use "Discard Changes" if you want to reset</li>
      </ol>
    `
  },
  {
    id: '5',
    title: 'Using the Timeline View',
    category: 'projects',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Navigate project stages using the interactive timeline feature.',
    instructions: `
      <ol>
        <li>Open any active project</li>
        <li>Click on "Timeline View" tab</li>
        <li>Select your preferred view mode (Timeline / List / Calendar)</li>
        <li>Click on stages to see detailed information</li>
        <li>View the project journey from onboarding to completion</li>
        <li>See current stage, next steps, and projected finish date</li>
        <li>Export timeline to PDF or CSV if needed</li>
      </ol>
    `
  },
  {
    id: '6',
    title: 'Advanced Search Techniques',
    category: 'advanced',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Master the global search to quickly find projects, files, tasks, and guides.',
    instructions: `
      <ol>
        <li>Click on the search bar in the top navigation</li>
        <li>Type keywords related to what you're looking for</li>
        <li>Use specific terms like project names, file types, or task descriptions</li>
        <li>Filter results by category using the dropdown</li>
        <li>Click on any result to navigate directly to that item</li>
        <li>Save frequent searches for quick access</li>
      </ol>
    `
  }
];

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ guides }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
