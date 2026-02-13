'use client';

import React, { useState } from 'react';
import Button from './system/Button';
import Card from './system/Card';

interface CodePanelProps {
  code: string;
  versions: any[];
  onRollback: (versionId: string) => void;
  onCodeChange: (code: string) => void;
}

export default function CodePanel({
  code,
  versions,
  onRollback,
  onCodeChange,
}: CodePanelProps) {
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [isEditable, setIsEditable] = useState(false);

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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const controlsStyles: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  };

  const selectStyles: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    fontFamily: 'inherit',
    backgroundColor: '#ffffff',
  };

  const editorStyles: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'Monaco, Courier New, monospace',
    fontSize: '12px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  const textareaStyles: React.CSSProperties = {
    ...editorStyles,
    border: '2px solid #3b82f6',
    overflow: 'auto',
  };

  const emptyStyles: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontSize: '14px',
  };

  const handleRollback = () => {
    if (selectedVersion) {
      onRollback(selectedVersion);
      setSelectedVersion('');
    }
  };

  return (
    <div style={panelStyles}>
      <div style={headerStyles}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
          Generated Code
        </h2>
        <div style={controlsStyles}>
          {versions.length > 0 && (
            <>
              <select
                style={selectStyles}
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
              >
                <option value="">Select version...</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {new Date(v.timestamp).toLocaleTimeString()}
                  </option>
                ))}
              </select>
              <Button
                label="Rollback"
                onClick={handleRollback}
                disabled={!selectedVersion}
                variant="secondary"
              />
            </>
          )}
          <Button
            label={isEditable ? 'Done' : 'Edit'}
            onClick={() => setIsEditable(!isEditable)}
            variant="secondary"
          />
        </div>
      </div>

      {code ? (
        isEditable ? (
          <textarea
            style={textareaStyles}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
          />
        ) : (
          <pre style={editorStyles}>{code}</pre>
        )
      ) : (
        <div style={emptyStyles}>No code generated yet. Start by describing a UI.</div>
      )}
    </div>
  );
}
