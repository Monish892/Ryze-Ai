'use client';

import React, { useState } from 'react';
import { UIPlan } from '@/agent/schema';
import { PlanRenderer } from './PlanRenderer';

interface PreviewPanelProps {
  plan?: UIPlan | null;
  code?: string;
  error?: string | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Preview error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '16px',
            color: '#dc2626',
            backgroundColor: '#fee2e2',
            borderRadius: '4px',
          }}
        >
          <strong>Preview Error:</strong>
          <div style={{ marginTop: '8px', fontSize: '13px' }}>
            {this.state.error?.message}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function PreviewPanel({ plan, code, error }: PreviewPanelProps) {
  const panelStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#ffffff',
  };

  const headerStyles: React.CSSProperties = {
    padding: '16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  };

  const contentStyles: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
    backgroundColor: '#ffffff',
  };

  const emptyStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#9ca3af',
    fontSize: '14px',
  };

  const errorStyles: React.CSSProperties = {
    padding: '16px',
    backgroundColor: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: '4px',
    color: '#dc2626',
  };

  if (error) {
    return (
      <div style={panelStyles}>
        <div style={headerStyles}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
            Preview
          </h2>
        </div>
        <div style={contentStyles}>
          <div style={errorStyles}>
            <strong>Error:</strong>
            <div style={{ marginTop: '8px', fontSize: '13px' }}>{error}</div>
            {code && (
              <div style={{ marginTop: '12px' }}>
                <details style={{ cursor: 'pointer' }}>
                  <summary style={{ fontWeight: '500', marginBottom: '8px' }}>
                    View Generated Code
                  </summary>
                  <pre
                    style={{
                      backgroundColor: '#1e1e1e',
                      color: '#d4d4d4',
                      padding: '12px',
                      borderRadius: '4px',
                      overflow: 'auto',
                      fontSize: '11px',
                      lineHeight: '1.4',
                      marginTop: '8px',
                    }}
                  >
                    {code}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={panelStyles}>
        <div style={headerStyles}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
            Live Preview
          </h2>
        </div>
        <div style={{ ...contentStyles, display: 'flex' }}>
          <div style={emptyStyles}>
            Generated UI will appear here
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyles}>
      <div style={headerStyles}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
          Live Preview
        </h2>
      </div>
      <div style={contentStyles}>
        <ErrorBoundary>
          <PlanRenderer plan={plan} />
        </ErrorBoundary>
      </div>
    </div>
  );
}


