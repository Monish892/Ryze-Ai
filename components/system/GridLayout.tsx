import React, { ReactNode } from 'react';

interface GridLayoutProps {
  children: ReactNode;
  columns?: number;
  gap?: number;
  padding?: number;
}

export default function GridLayout({
  children,
  columns = 3,
  gap = 16,
  padding = 0,
}: GridLayoutProps) {
  const styles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: `${gap}px`,
    padding: `${padding}px`,
    width: '100%',
  };

  return <div style={styles}>{children}</div>;
}
