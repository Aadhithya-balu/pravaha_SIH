import React from 'react';
import { PlayCircle, Bell, RefreshCw, Menu, ArrowLeft, Search } from 'lucide-react';
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
  onOpenGuide?: () => void;
  onOpenCommandPalette?: () => void;
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
  onToggleMobileMenu,
  onOpenCommandPalette
}) => {
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
      {/* Left: Mobile Menu Toggle, Breadcrumbs & Title */}
      <div className="topbar-left">
        <div className="topbar-left-inner">
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

          <div className="topbar-heading-block">
            <nav aria-label="Breadcrumb" className="topbar-breadcrumb">
              <button
                type="button"
                className="topbar-agency-tag breadcrumb-link"
                onClick={() => onNavigateTab && onNavigateTab('Overview')}
                title="Navigate to Command Centre"
              >
                AICTE PRAVAHA
              </button>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-category">{currentCategory}</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{currentTab}</span>
            </nav>

            <div className="topbar-title-row">
              <h2 className="topbar-title">{currentTab}</h2>
              <div className="topbar-demo-pill" title="Demonstration environment (SIH26262)">
                <span className="demo-pulse-dot" />
                <span className="topbar-demo-text">SIH26262 DEMO</span>
              </div>
              {currentTab !== 'Overview' && onNavigateTab && (
                <button
                  type="button"
                  className="topbar-back-btn"
                  onClick={() => onNavigateTab('Overview')}
                  title="Return to Command Centre Dashboard"
                >
                  <ArrowLeft size={12} />
                  <span className="topbar-back-text">Dashboard</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Quick Search, Role Chip, Actions */}
      <div className="topbar-actions">
        {/* Global Quick Search / Command Palette Shortcut */}
        {onOpenCommandPalette && (
          <button
            type="button"
            className="topbar-search-trigger"
            onClick={onOpenCommandPalette}
            title="Search applications, dossiers, or personas (Ctrl + K)"
          >
            <Search size={14} color="#2563EB" />
            <span className="topbar-search-text">Quick Search...</span>
            <kbd className="topbar-search-kbd">Ctrl K</kbd>
          </button>
        )}

        {/* Verified User Identity Chip */}
        {user && (
          <div
            className="topbar-user-chip"
            title={`${user.name} (${user.email}) — ${user.designation || user.role}`}
          >
            <div
              className="topbar-user-status-dot"
              style={{
                background:
                  user.role === 'admin'
                    ? '#7C3AED'
                    : user.role === 'officer'
                    ? '#2563EB'
                    : user.role === 'evc_expert'
                    ? '#059669'
                    : '#D97706'
              }}
            />
            <span className="topbar-user-name">
              {user.name}
            </span>
            <span className="topbar-user-role-badge">
              {user.role === 'institution'
                ? 'Applicant'
                : user.role === 'officer'
                ? 'Scrutiny Officer'
                : user.role === 'evc_expert'
                ? 'EVC Inspector'
                : user.role}
            </span>
          </div>
        )}

        {/* Manual Deadline Scan Trigger (Officer / Bureau / Admin) */}
        {user?.role !== 'institution' && (
          <button
            type="button"
            className="btn-secondary btn-nav-action topbar-scan-btn"
            onClick={onRunEscalation}
            disabled={isScanning}
            title="Scan active case deadlines and auto-trigger SLA escalation alerts"
          >
            <PlayCircle size={13} color="#D97706" />
            <span className="topbar-btn-text">{isScanning ? 'Scanning...' : 'Scan Deadlines'}</span>
          </button>
        )}

        {/* Notification Bell with Badge */}
        {onNavigateTab && (
          <button
            type="button"
            className="btn-icon btn-nav-action topbar-bell-btn"
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
          className="btn-secondary btn-nav-action topbar-refresh-btn"
          onClick={onRefresh}
          title="Reload live database records"
        >
          <RefreshCw size={12} />
          <span className="topbar-btn-text">Refresh</span>
        </button>
      </div>
    </header>
  );
};
