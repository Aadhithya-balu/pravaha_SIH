import React from 'react';
import { Activity, PlayCircle, Bell, Search, ShieldCheck, RefreshCw, Menu } from 'lucide-react';
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
    Overview: 'Executive operations summary, stage pipeline, and regional workload metrics',
    Applications: 'Centralized case register with Next Best Action triggers and full lifecycle routing',
    'AI Assistant': 'Explainable document verification, candidate field extraction, and discrepancy drafting',
    'EVC Inspections': 'Expert Visit Committee scheduling, committee roster allocation, and visit reports',
    Compliance: 'Time-bound undertakings, 30-year lease verification, and statutory safety clearances',
    Alerts: 'SLA countdowns, regulatory notifications, and automated escalation logs',
    Reports: 'Official regulatory registers, bottleneck intelligence, and formula-safe CSV exports',
    'Role Matrix': 'SIH26262 statutory governance model, access boundaries, and evaluation accounts',
  };

  const tabCategories: Record<string, string> = {
    Overview: 'Core Operations',
    Applications: 'Core Operations',
    'AI Assistant': 'Regulatory Scrutiny',
    'EVC Inspections': 'Regulatory Scrutiny',
    Compliance: 'Compliance & Evidence',
    Alerts: 'Governance & Analytics',
    Reports: 'Governance & Analytics',
    'Role Matrix': 'System Access'
  };

  const currentCategory = tabCategories[currentTab] || 'Operations';

  return (
    <header className="topbar">
      {/* Left: Mobile Menu Toggle & Official GovTech Header & Breadcrumb */}
      <div className="topbar-left">
        {onToggleMobileMenu && (
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={onToggleMobileMenu}
            aria-label="Open mobile navigation"
            title="Open navigation menu"
          >
            <Menu size={20} />
          </button>
        )}

        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--text-muted)' }}>
          <button
            type="button"
            className="topbar-agency-tag breadcrumb-link"
            style={{ margin: 0, cursor: onNavigateTab ? 'pointer' : 'default' }}
            onClick={() => onNavigateTab && onNavigateTab('Overview')}
            title="Navigate to Command Centre"
          >
            AICTE WORKFLOW HUB
          </button>
          <span>/</span>
          <span style={{ fontWeight: 600 }}>{currentCategory}</span>
          <span>/</span>
          <span style={{ color: 'var(--color-navy)', fontWeight: 700 }}>{currentTab}</span>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--color-navy)', fontWeight: 800 }}>{currentTab}</h2>
          {/* Phase 4: Restrained Header Demo Badge */}
          <div className="topbar-demo-pill" title="Demonstration environment. Uses synthetic institutional data. Not connected to official AICTE production systems.">
            <span className="demo-pulse-dot" />
            <span>PRAVAHA | SIH26262 DEMO MODE</span>
          </div>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {pageSubtitles[currentTab] || `AICTE Regulatory Console · ${user?.designation || user?.role}`}
        </span>
      </div>

      {/* Right Actions */}
      <div className="topbar-actions">
        {/* Quick Demo Role Switcher for SIH Evaluators (Phase 4) */}
        <div className="quick-role-bar" title="Switch persona to evaluate role-based permissions">
          <span className="quick-role-label">
            Demo Persona:
          </span>
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
            className="btn-secondary"
            onClick={onRunEscalation}
            disabled={isScanning}
            title="Scan active case deadlines and auto-trigger SLA escalation alerts"
          >
            <PlayCircle size={14} color="#D97706" />
            <span>{isScanning ? 'Evaluating...' : 'Scan Deadlines'}</span>
          </button>
        )}

        {/* Notification Bell with Badge */}
        {onNavigateTab && (
          <button
            type="button"
            className="btn-icon"
            onClick={() => onNavigateTab('Alerts')}
            title={`View notifications (${unreadCount} unread)`}
            style={{ position: 'relative' }}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#DC2626'
              }} />
            )}
          </button>
        )}

        {/* Refresh Live Database Records */}
        <button
          type="button"
          className="btn-secondary"
          onClick={onRefresh}
          title="Reload live database records"
        >
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
};
