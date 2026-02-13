import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export default function Modal({ isOpen, title, children, onClose }: ModalProps) {
  if (!isOpen) return null;

  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalStyles: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
  };

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
  };

  const titleStyles: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1f2937',
    margin: 0,
  };

  const closeButtonStyles: React.CSSProperties = {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6b7280',
    padding: 0,
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const contentStyles: React.CSSProperties = {
    padding: '20px',
    color: '#374151',
  };

  return (
    <div style={overlayStyles}>
      <div style={modalStyles}>
        <div style={headerStyles}>
          <h2 style={titleStyles}>{title}</h2>
          <button style={closeButtonStyles} onClick={onClose}>
            ×
          </button>
        </div>
        <div style={contentStyles}>{children}</div>
      </div>
    </div>
  );
}
