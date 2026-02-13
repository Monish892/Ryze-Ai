import React, { ReactNode } from 'react';

interface ColumnLayoutProps {
  children: ReactNode;
  gap?: number;
  padding?: number;
}

export default function ColumnLayout({
  children,
  gap = 16,
  padding = 0,
}: ColumnLayoutProps) {
  const styles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: `${gap}px`,
    padding: `${padding}px`,
    width: '100%',
  };

  return <div style={styles}>{children}</div>;
}
