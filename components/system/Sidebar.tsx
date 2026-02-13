import React, { ReactNode } from 'react';

interface SidebarProps {
  children: ReactNode;
  width?: number;
}

export default function Sidebar({ children, width = 250 }: SidebarProps) {
  const containerStyles: React.CSSProperties = {
    width: `${width}px`,
    minHeight: '100vh',
    backgroundColor: '#1f2937',
    color: '#f3f4f6',
    padding: '16px',
    overflowY: 'auto',
    boxSizing: 'border-box',
  };

  const itemStyles: React.CSSProperties = {
    padding: '12px 16px',
    marginBottom: '8px',
    borderRadius: '4px',
    backgroundColor: '#374151',
    color: '#f3f4f6',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  };

  return (
    <aside style={containerStyles}>
      <div>
        {React.Children.map(children, (child) => {
          if (typeof child === 'string') {
            return <div style={itemStyles}>{child}</div>;
          }
          return child;
        })}
      </div>
    </aside>
  );
}
