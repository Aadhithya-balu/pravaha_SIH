import React from 'react';
import { RefreshCw, PlayCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  currentTab: string;
  user: User | null;
  onRefresh: () => void;
  onRunEscalation: () => void;
  onSwitchRole: (email: string) => void;
  isScanning: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  user,
  onRefresh,
  onRunEscalation,
  onSwitchRole,
  isScanning
}) => {
  const demoAccounts = [
    { label: 'RO Officer', email: 'officer@demo.local', role: 'officer' },
    { label: 'College', email: 'college@demo.local', role: 'institution' },
    { label: 'Bureau HQ', email: 'bureau@demo.local', role: 'bureau' },
    { label: 'EVC Expert', email: 'evc@demo.local', role: 'evc_expert' },
    { label: 'Admin', email: 'admin@demo.local', role: 'admin' },
  ];

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2>{currentTab === 'AI Assistant' ? 'Document Scrutiny' : currentTab}</h2>
        <span>
          AICTE Regulatory Operations · {user?.designation || user?.role?.toUpperCase()} ({user?.region || 'HQ'})
        </span>
      </div>

      <div className="topbar-actions">
        {/* Status chip */}
        <div className="gov-status-chip" title="Live connection to backend regulatory workflow engine">
          <span className="gov-status-dot" />
          <span>System Live</span>
        </div>

        {/* Quick Demo Switcher */}
        <div className="quick-role-bar" title="1-Click Evaluation Persona Switcher">
          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', padding: '0 4px' }}>
            DEMO PERSONA:
          </span>
          {demoAccounts.map((acc) => {
            const isCurrent = user?.role === acc.role;
            return (
              <button
                key={acc.email}
                className={`role-pill ${isCurrent ? 'active' : ''}`}
                onClick={() => onSwitchRole(acc.email)}
                title={`Switch to ${acc.label} (${acc.email})`}
              >
                {acc.label}
              </button>
            );
          })}
        </div>

        {/* Escalation scanner for officials */}
        {user?.role !== 'institution' && (
          <button
            className="btn-secondary"
            onClick={onRunEscalation}
            disabled={isScanning}
            title="Scan application and compliance due dates against regulatory SLAs"
          >
            <PlayCircle size={14} color="#ea580c" />
            <span>{isScanning ? 'Evaluating SLAs...' : 'Scan Deadlines'}</span>
          </button>
        )}

        <button className="btn-secondary" onClick={onRefresh} title="Reload live database records">
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
};
