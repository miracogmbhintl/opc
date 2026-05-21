import React, { useEffect, useState } from 'react';
import WidgetCard from '../shared/WidgetCard';
import WidgetSkeleton from '../shared/WidgetSkeleton';
import { TrendingUp } from 'lucide-react';

interface ProjectStats {
  totalProjects: number;
  completedProjects: number;
  averageProgress: number;
}

interface TotalProjectProgressProps {
  baseUrl: string;
}

export default function TotalProjectProgress({ baseUrl }: TotalProjectProgressProps) {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for now - replace with actual API call
    setTimeout(() => {
      setStats({
        totalProjects: 12,
        completedProjects: 7,
        averageProgress: 68
      });
      setLoading(false);
    }, 500);
  }, [baseUrl]);

  if (loading) return <WidgetSkeleton />;

  const progress = stats?.averageProgress || 0;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <WidgetCard title="Overall Progress" icon={<TrendingUp size={18} />}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: '16px'
      }}>
        {/* Radial Progress Bar */}
        <div style={{ position: 'relative', width: '140px', height: '140px' }}>
          <svg
            width="140"
            height="140"
            style={{ transform: 'rotate(-90deg)' }}
          >
            {/* Background circle */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke="#F3F4F6"
              strokeWidth="10"
              fill="none"
            />
            {/* Progress circle */}
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
              style={{ 
                transition: 'stroke-dashoffset 0.5s ease',
              }}
            />
          </svg>
          
          {/* Center text */}
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
              {progress}%
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

        {/* Stats */}
        <div style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #E5E7EB'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '36px',
              fontWeight: 600,
              color: '#1A1A1A',
              lineHeight: 1
            }}>
              {stats?.completedProjects}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#6B7280',
              marginTop: '4px'
            }}>
              Completed
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '36px',
              fontWeight: 600,
              color: '#1A1A1A',
              lineHeight: 1
            }}>
              {stats?.totalProjects}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#6B7280',
              marginTop: '4px'
            }}>
              Total
            </div>
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
