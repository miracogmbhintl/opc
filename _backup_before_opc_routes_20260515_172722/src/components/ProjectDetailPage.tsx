import MirakaDashboardShell from './MirakaDashboardShell';
import ProjectDetail from './ProjectDetail';

interface ProjectDetailPageProps {
  projectId: string;
}

export default function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
  return (
    <MirakaDashboardShell requiredRole={['admin', 'owner', 'client']}>
      <ProjectDetail projectId={projectId} />
    </MirakaDashboardShell>
  );
}
