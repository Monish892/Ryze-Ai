'use client';

import React, { useState, useCallback, Suspense } from 'react';
import ChatPanel from '@/components/ChatPanel';
import CodePanel from '@/components/CodePanel';
import PreviewPanel from '@/components/PreviewPanel';
import { UIPlan } from '@/agent/schema';

export default function Home() {
  const [currentPlan, setCurrentPlan] = useState<UIPlan | null>(null);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [previousPlan, setPreviousPlan] = useState<UIPlan | null>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async (intent: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Plan
      const planResponse = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, previousPlan: currentPlan }),
      });

      if (!planResponse.ok) {
        const error = await planResponse.json();
        throw new Error(error.error || 'Failed to plan');
      }

      const { plan } = await planResponse.json();
      setPreviousPlan(currentPlan);
      setCurrentPlan(plan);

      // Step 2: Generate
      const genResponse = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, previousPlan: currentPlan }),
      });

      if (!genResponse.ok) {
        const error = await genResponse.json();
        throw new Error(error.error || 'Failed to generate');
      }

      const { code } = await genResponse.json();
      setCurrentCode(code);

      // Step 3: Explain
      const expResponse = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, previousPlan }),
      });

      if (!expResponse.ok) {
        const error = await expResponse.json();
        throw new Error(error.error || 'Failed to explain');
      }

      const { explanation } = await expResponse.json();
      setExplanation(explanation);

      // Save version
      await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          plan,
          code,
          explanation,
        }),
      });

      // Refresh versions list
      await fetchVersions();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [currentPlan]);

  const fetchVersions = useCallback(async () => {
    try {
      const response = await fetch('/api/versions');
      if (response.ok) {
        const { versions } = await response.json();
        setVersions(versions);
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    }
  }, []);

  const handleRollback = useCallback(async (versionId: string) => {
    try {
      const response = await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', versionId }),
      });

      if (response.ok) {
        const { version } = await response.json();
        setPreviousPlan(currentPlan);
        setCurrentPlan(version.plan);
        setCurrentCode(version.code);
        setExplanation(version.explanation);
      }
    } catch (err) {
      setError(String(err));
    }
  }, [currentPlan]);

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  };

  const headerStyles: React.CSSProperties = {
    padding: '16px 24px',
    backgroundColor: '#1f2937',
    color: '#ffffff',
    borderBottom: '2px solid #3b82f6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const contentStyles: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    gap: '0',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  };

  const panelStyles: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #e5e7eb',
    overflow: 'hidden',
  };

  const lastPanelStyles: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderRight: 'none',
    overflow: 'hidden',
  };

  React.useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  return (
    <div style={containerStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>
          🚀 Ryze AI - Deterministic UI Generator
        </h1>
        {error && (
          <div style={{ color: '#fca5a5', fontSize: '14px' }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={contentStyles}>
        {/* Left Panel: Chat */}
        <div style={panelStyles}>
          <ChatPanel
            onGenerate={handleGenerate}
            isLoading={isLoading}
            explanation={explanation}
          />
        </div>

        {/* Middle Panel: Code */}
        <div style={panelStyles}>
          <CodePanel
            code={currentCode}
            versions={versions}
            onRollback={handleRollback}
            onCodeChange={setCurrentCode}
          />
        </div>

        {/* Right Panel: Preview */}
        <div style={lastPanelStyles}>
          <Suspense fallback={<div style={{ padding: '16px' }}>Loading preview...</div>}>
            <PreviewPanel plan={currentPlan} code={currentCode} error={error} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
