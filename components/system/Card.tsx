import React, { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  padding?: number;
}

export default function Card({ title, children, padding = 16 }: CardProps) {
  const styles: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: `${padding}px`,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  };

  const titleStyles: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '12px',
    margin: 0,
  };

  return (
    <div style={styles}>
      {title && <h2 style={titleStyles}>{title}</h2>}
      <div style={{ color: '#374151' }}>{children}</div>
    </div>
  );
}
