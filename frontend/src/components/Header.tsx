import React from 'react';
import { Activity, PlayCircle } from 'lucide-react';
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
        <h2>{currentTab}</h2>
        <span>AICTE Regulatory Operations Dashboard · {user?.designation || user?.role}</span>
      </div>

      <div className="topbar-actions">
        {/* Quick Role Switcher for SIH evaluators */}
        <div className="quick-role-bar" title="Switch between prototype demo roles with 1 click">
          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', padding: '0 4px' }}>
            DEMO ROLE:
          </span>
          {demoAccounts.map((acc) => {
            const isCurrent = user?.role === acc.role;
            return (
              <button
                key={acc.email}
                className={`role-pill ${isCurrent ? 'active' : ''}`}
                onClick={() => onSwitchRole(acc.email)}
              >
                {acc.label}
              </button>
            );
          })}
        </div>

        {/* Manual Deadline Scan trigger for SIH demo */}
        {user?.role !== 'institution' && (
          <button
            className="btn-secondary"
            onClick={onRunEscalation}
            disabled={isScanning}
            title="Evaluate application and compliance deadlines, auto-triggering overdue alerts"
          >
            <PlayCircle size={15} color="#ea580c" />
            <span>{isScanning ? 'Scanning...' : 'Scan Deadlines'}</span>
          </button>
        )}

        <button className="btn-secondary" onClick={onRefresh} title="Reload live database records">
          <Activity size={15} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
};
