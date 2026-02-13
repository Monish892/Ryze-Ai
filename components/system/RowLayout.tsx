import React, { ReactNode } from 'react';

interface RowLayoutProps {
  children: ReactNode;
  gap?: number;
  padding?: number;
}

export default function RowLayout({
  children,
  gap = 16,
  padding = 0,
}: RowLayoutProps) {
  const styles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: `${gap}px`,
    padding: `${padding}px`,
    width: '100%',
  };

  return <div style={styles}>{children}</div>;
}
