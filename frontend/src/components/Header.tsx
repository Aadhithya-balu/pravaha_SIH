import React from 'react';
import { PlayCircle, Bell, RefreshCw, Menu } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  currentTab: string;
  user: User | null;
  onRefresh: () => void;
  onRunEscalation: () => void;
  onSwitchRole: (email: string) => void;
  isScanning: boolean;
  onNavigateTab?: (tab: string) => void;
  unreadCount?: number;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  user,
  onRefresh,
  onRunEscalation,
  onSwitchRole,
  isScanning,
  onNavigateTab,
  unreadCount = 0,
  onToggleMobileMenu
}) => {
  // Phase 4: 3 Canonical Demo Accounts (Institution, Combined RO/Admin, EVC Expert)
  const demoAccounts = [
    { label: 'Applicant', email: 'college@demo.local', role: 'institution', title: 'Institution Applicant' },
    { label: 'RO / Admin', email: 'officer@demo.local', role: 'officer', title: 'Regional Officer & Administrator' },
    { label: 'EVC Expert', email: 'evc@demo.local', role: 'evc_expert', title: 'Expert Visit Committee Inspector' },
  ];

  const pageSubtitles: Record<string, string> = {
    Overview: 'Executive operations summary & regulatory pipeline',
    Applications: 'Centralized dossier register & lifecycle management',
    'AI Assistant': 'Statutory scrutiny, candidate extraction & discrepancy review',
    'Document Scrutiny': 'Statutory scrutiny, candidate extraction & discrepancy review',
    'EVC Inspections': 'Expert Visit Committee roster & compliance reports',
    Compliance: 'Statutory clearances, 30-year lease & undertakings',
    Alerts: 'SLA countdowns & regulatory escalations',
    Reports: 'Official regulatory registers & data export',
    'Role Matrix': 'Governance model, permissions & evaluation personas',
  };

  const tabCategories: Record<string, string> = {
    Overview: 'Operations',
    Applications: 'Operations',
    'AI Assistant': 'Scrutiny',
    'Document Scrutiny': 'Scrutiny',
    'EVC Inspections': 'Scrutiny',
    Compliance: 'Compliance',
    Alerts: 'Governance',
    Reports: 'Governance',
    'Role Matrix': 'Access'
  };

  const currentCategory = tabCategories[currentTab] || 'Operations';

  return (
    <header className="topbar">
      {/* Left: Mobile Menu Toggle & Official GovTech Header & Breadcrumb */}
      <div className="topbar-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onToggleMobileMenu && (
            <button
              type="button"
              className="mobile-hamburger-btn"
              onClick={onToggleMobileMenu}
              aria-label="Open navigation menu"
              title="Open navigation menu"
            >
              <Menu size={18} />
            </button>
          )}

          <div>
            <nav aria-label="Breadcrumb" className="topbar-breadcrumb">
              <button
                type="button"
                className="topbar-agency-tag breadcrumb-link"
                onClick={() => onNavigateTab && onNavigateTab('Overview')}
                title="Navigate to Command Centre"
              >
                AICTE PRAVAHA
              </button>
              <span>/</span>
              <span>{currentCategory}</span>
              <span>/</span>
              <span className="breadcrumb-current">{currentTab}</span>
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 1 }}>
              <h2 className="topbar-title">{currentTab}</h2>
              <div className="topbar-demo-pill" title="Demonstration environment (SIH26262)">
                <span className="demo-pulse-dot" />
                <span>SIH26262 DEMO</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="topbar-actions">
        {/* Quick Demo Role Switcher for SIH Evaluators (Phase 4) */}
        <div className="quick-role-bar" title="Switch persona to evaluate role-based permissions">
          <span className="quick-role-label">Persona:</span>
          {demoAccounts.map((acc) => {
            const isCurrent = user?.role === acc.role;
            return (
              <button
                key={acc.email}
                type="button"
                className={`role-pill ${isCurrent ? 'active' : ''}`}
                onClick={() => onSwitchRole(acc.email)}
                title={acc.title}
              >
                {acc.label}
              </button>
            );
          })}
        </div>

        {/* Manual Deadline Scan Trigger (Officer / Bureau / Admin) */}
        {user?.role !== 'institution' && (
          <button
            type="button"
            className="btn-secondary btn-nav-action"
            onClick={onRunEscalation}
            disabled={isScanning}
            title="Scan active case deadlines and auto-trigger SLA escalation alerts"
          >
            <PlayCircle size={13} color="#D97706" />
            <span>{isScanning ? 'Scanning...' : 'Scan Deadlines'}</span>
          </button>
        )}

        {/* Notification Bell with Badge */}
        {onNavigateTab && (
          <button
            type="button"
            className="btn-icon btn-nav-action"
            onClick={() => onNavigateTab('Alerts')}
            title={`View notifications (${unreadCount} unread)`}
            style={{ position: 'relative' }}
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#DC2626',
                  boxShadow: '0 0 0 1.5px #FFFFFF'
                }}
              />
            )}
          </button>
        )}

        {/* Refresh Live Database Records */}
        <button
          type="button"
          className="btn-secondary btn-nav-action"
          onClick={onRefresh}
          title="Reload live database records"
        >
          <RefreshCw size={12} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
};
