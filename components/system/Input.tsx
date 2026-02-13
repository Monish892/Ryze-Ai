import React, { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  placeholder?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function Input({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  ...props
}: InputProps) {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const labelStyles: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  };

  const inputStyles: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={containerStyles}>
      {label && <label style={labelStyles}>{label}</label>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={inputStyles}
        {...props}
      />
    </div>
  );
}
