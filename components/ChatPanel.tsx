'use client';

import React, { useState } from 'react';
import Button from './system/Button';
import Input from './system/Input';
import Card from './system/Card';

interface ChatPanelProps {
  onGenerate: (intent: string) => void;
  isLoading: boolean;
  explanation: string;
}

export default function ChatPanel({
  onGenerate,
  isLoading,
  explanation,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  const handleSubmit = () => {
    if (!input.trim()) return;

    setHistory([...history, input]);
    onGenerate(input);
    setInput('');
  };

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

  const historyStyles: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    gap: '12px',
    display: 'flex',
    flexDirection: 'column',
  };

  const historyItemStyles: React.CSSProperties = {
    padding: '12px',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    borderLeft: '3px solid #3b82f6',
    fontSize: '14px',
    color: '#374151',
  };

  const explanationStyles: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    fontSize: '13px',
    color: '#4b5563',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  const inputAreaStyles: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    padding: '16px',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  };

  const inputWrapperStyles: React.CSSProperties = {
    flex: 1,
  };

  return (
    <div style={panelStyles}>
      <div style={headerStyles}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
          UI Generator
        </h2>
      </div>

      {explanation ? (
        <div style={explanationStyles}>
          <strong style={{ color: '#1f2937', fontSize: '14px' }}>Plan Explanation:</strong>
          <div style={{ marginTop: '8px' }}>{explanation}</div>
        </div>
      ) : (
        <div style={historyStyles}>
          {history.length === 0 ? (
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>
              Chat history will appear here
            </div>
          ) : (
            history.map((item, idx) => (
              <div key={idx} style={historyItemStyles}>
                {item}
              </div>
            ))
          )}
        </div>
      )}

      <div style={inputAreaStyles}>
        <div style={inputWrapperStyles}>
          <Input
            placeholder="Describe your UI..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isLoading) {
                handleSubmit();
              }
            }}
          />
        </div>
        <Button
          label={isLoading ? 'Loading...' : 'Generate'}
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          variant="primary"
        />
      </div>
    </div>
  );
}
