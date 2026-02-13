import React, { ReactNode } from 'react';

interface NavbarProps {
  title: string;
  children?: ReactNode;
}

export default function Navbar({ title, children }: NavbarProps) {
  const navStyles: React.CSSProperties = {
    backgroundColor: '#1f2937',
    color: '#f3f4f6',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  };

  const titleStyles: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: '700',
    margin: 0,
    color: '#f3f4f6',
  };

  const contentStyles: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  };

  return (
    <nav style={navStyles}>
      <h1 style={titleStyles}>{title}</h1>
      {children && <div style={contentStyles}>{children}</div>}
    </nav>
  );
}
