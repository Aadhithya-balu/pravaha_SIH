import React from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  FileSearch,
  Calendar,
  FileCheck2,
  Bell,
  BarChart3,
  Shield,
  LogOut,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  user: User | null;
  unreadAlertsCount: number;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setTab,
  user,
  unreadAlertsCount,
  onSignOut
}) => {
  const role = user?.role || 'officer';

  // Base navigation definition
  const allNavItems = [
    {
      id: 'Overview',
      label: role === 'institution' ? 'Institution Overview' : 'Overview',
      icon: LayoutDashboard,
      roles: ['officer', 'bureau', 'institution', 'evc_expert', 'admin']
    },
    {
      id: 'Applications',
      label: role === 'institution' ? 'My Applications' : 'Applications',
      icon: ClipboardList,
      roles: ['officer', 'bureau', 'institution', 'evc_expert', 'admin']
    },
    {
      id: 'Document Scrutiny',
      alias: 'AI Assistant',
      label: 'Document Scrutiny',
      icon: FileSearch,
      roles: ['officer', 'bureau', 'institution', 'evc_expert', 'admin']
    },
    {
      id: 'EVC Inspections',
      label: 'EVC Inspections',
      icon: Calendar,
      roles: ['officer', 'bureau', 'evc_expert', 'admin']
    },
    {
      id: 'Compliance',
      label: role === 'institution' ? 'Compliance Evidence' : 'Compliance & Expiry',
      icon: FileCheck2,
      roles: ['officer', 'bureau', 'institution', 'admin']
    },
    {
      id: 'Alerts',
      label: role === 'institution' ? 'Notifications' : 'Alerts & Escalations',
      icon: Bell,
      badge: unreadAlertsCount,
      roles: ['officer', 'bureau', 'institution', 'evc_expert', 'admin']
    },
    {
      id: 'Reports',
      label: 'Reports & Export',
      icon: BarChart3,
      roles: ['officer', 'bureau', 'admin']
    }
  ];

  const visibleNav = allNavItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="sidebar" aria-label="Regulatory Operations Navigation">
      <div className="brand-section">
        <div className="brand-icon">
          <Shield size={20} />
        </div>
        <div className="brand-text">
          <h1>AICTE Pravaha</h1>
          <span>Regulatory Operations Console</span>
        </div>
      </div>

      <div className="nav-group-label">Regulatory Modules</div>
      <nav className="nav-links">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id || (item.alias && currentTab === item.alias);
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="badge-count" title={`${item.badge} unread alerts`}>{item.badge}</span>
              )}
            </button>
          );
        })}

        <div style={{ margin: '14px 0 6px', borderTop: '1px solid var(--sidebar-border)' }} />
        <div className="nav-group-label" style={{ padding: '4px 6px 6px' }}>Evaluation Tools</div>

        <button
          className={`nav-item ${currentTab === 'Role Matrix' ? 'active' : ''}`}
          onClick={() => setTab('Role Matrix')}
        >
          <Shield size={16} />
          <span>Role Matrix & Access Guide</span>
        </button>
      </nav>

      <div className="sidebar-user">
        <div className="user-info">
          <span className="user-name">{user?.name || 'Authorized Official'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="user-role-badge">{user?.role}</span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{user?.region || 'HQ'}</span>
          </div>
          {user?.institution_name && (
            <span className="user-inst" title={user.institution_name}>
              <Building2 size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              {user.institution_name}
            </span>
          )}
        </div>
        <button className="btn-signout" onClick={onSignOut} title="Sign out from session">
          <LogOut size={13} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};
