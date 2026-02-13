import React from 'react';

interface ChartProps {
  title?: string;
  data: Array<{ label: string; value: number }>;
  type?: 'bar' | 'line';
}

export default function Chart({ title, data, type = 'bar' }: ChartProps) {
  const containerStyles: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    minHeight: '300px',
  };

  const titleStyles: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '16px',
    margin: '0 0 16px 0',
  };

  const chartContainerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '16px',
    justifyContent: 'center',
    height: '240px',
  };

  const maxValue = Math.max(...data.map((d) => d.value), 100);

  return (
    <div style={containerStyles}>
      {title && <h3 style={titleStyles}>{title}</h3>}
      <div style={chartContainerStyles}>
        {data.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              flex: 1,
            }}
          >
            <div
              style={{
                width: '100%',
                height: `${(item.value / maxValue) * 200}px`,
                backgroundColor: '#3b82f6',
                borderRadius: '4px',
                transition: 'background-color 0.2s',
              }}
            />
            <span
              style={{
                fontSize: '12px',
                color: '#6b7280',
                textAlign: 'center',
                wordBreak: 'break-word',
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#374151',
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
