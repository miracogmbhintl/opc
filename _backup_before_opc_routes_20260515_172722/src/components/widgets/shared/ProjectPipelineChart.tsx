import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface ChartDataItem {
  name: string;
  value: number;
  color: string;
}

interface ProjectPipelineChartProps {
  data: ChartDataItem[];
  totalProjects: number;
}

export default function ProjectPipelineChart({ data, totalProjects }: ProjectPipelineChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
        <p style={{ fontSize: '15px', margin: 0, fontWeight: 600 }}>
          No project data available
        </p>
      </div>
    );
  }

  return (
    <>
      <div style={{ position: 'relative', width: '100%', maxWidth: '280px', height: '280px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center Text */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '52px',
            fontWeight: 800,
            color: '#1A1A1A',
            lineHeight: 1,
            marginBottom: '6px'
          }}>
            {totalProjects}
          </div>
          <div style={{
            fontSize: '14px',
            color: '#6B7280',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Total Projects
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .pipeline-chart-container > div:first-child {
            max-width: 240px !important;
            height: 240px !important;
          }
        }
      `}</style>
    </>
  );
}
