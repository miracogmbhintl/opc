import React, { useEffect, useState } from 'react';
import WidgetCard from '../shared/WidgetCard';
import WidgetSkeleton from '../shared/WidgetSkeleton';
import { TrendingUp } from 'lucide-react';

interface ProjectProgress {
  total_projects: number;
  completed: number;
  in_progress: number;
  overall_completion: number;
}

interface MyProjectProgressProps {
  baseUrl: string;
}

export default function MyProjectProgress({ baseUrl }: MyProjectProgressProps) {
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${baseUrl}/api/client/project-progress`, {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) {
          return {
            total_projects: 0,
            completed: 0,
            in_progress: 0,
            overall_completion: 0
          };
        }
        return res.json();
      })
      .then(data => {
        setProgress(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching project progress:', err);
        setProgress({
          total_projects: 0,
          completed: 0,
          in_progress: 0,
          overall_completion: 0
        });
        setLoading(false);
      });
  }, [baseUrl]);

  if (loading) return <WidgetSkeleton />;

  const percentage = progress?.overall_completion || 0;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <WidgetCard title="Project Progress" icon={<TrendingUp size={18} />}>
      {!progress || progress.total_projects === 0 ? (
        <p style={{ fontSize: '13px', color: '#6B7280', textAlign: 'center', padding: '20px 0', margin: 0 }}>
          No projects yet
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Radial Progress */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '140px', height: '140px' }}>
              <svg
                width="140"
                height="140"
                style={{ transform: 'rotate(-90deg)' }}
              >
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  stroke="#F3F4F6"
                  strokeWidth="10"
                  fill="none"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  stroke="#1A1A1A"
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '36px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  lineHeight: 1
                }}>
                  {percentage}%
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#6B7280',
                  marginTop: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Complete
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #E5E7EB'
          }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{
                fontSize: '36px',
                fontWeight: 600,
                color: '#1A1A1A',
                margin: 0,
                lineHeight: 1
              }}>
                {progress.total_projects}
              </p>
              <p style={{
                fontSize: '13px',
                color: '#6B7280',
                marginTop: '4px',
                margin: 0
              }}>
                Total
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{
                fontSize: '36px',
                fontWeight: 600,
                color: '#F59E0B',
                margin: 0,
                lineHeight: 1
              }}>
                {progress.in_progress}
              </p>
              <p style={{
                fontSize: '13px',
                color: '#6B7280',
                marginTop: '4px',
                margin: 0
              }}>
                Active
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{
                fontSize: '36px',
                fontWeight: 600,
                color: '#22C55E',
                margin: 0,
                lineHeight: 1
              }}>
                {progress.completed}
              </p>
              <p style={{
                fontSize: '13px',
                color: '#6B7280',
                marginTop: '4px',
                margin: 0
              }}>
                Done
              </p>
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
