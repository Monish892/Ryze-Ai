import React, { ReactNode } from 'react';

interface ButtonProps {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export default function Button({
  label,
  onClick,
  variant = 'primary',
  disabled = false,
}: ButtonProps) {
  const baseStyles: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '4px',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s',
    opacity: disabled ? 0.6 : 1,
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      ...baseStyles,
      backgroundColor: '#3b82f6',
      color: '#ffffff',
    },
    secondary: {
      ...baseStyles,
      backgroundColor: '#e5e7eb',
      color: '#1f2937',
    },
    danger: {
      ...baseStyles,
      backgroundColor: '#ef4444',
      color: '#ffffff',
    },
  };

  return (
    <button
      style={variantStyles[variant]}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
