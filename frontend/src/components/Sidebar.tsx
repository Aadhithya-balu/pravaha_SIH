import React from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Sparkles,
  Calendar,
  FileCheck2,
  Bell,
  BarChart3,
  Shield,
  LogOut,
  Building2,
  ShieldCheck
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
  const navItems = [
    { id: 'Overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'Applications', label: 'Applications', icon: ClipboardList },
    { id: 'AI Assistant', label: 'AI Document Review', icon: Sparkles },
    { id: 'EVC Inspections', label: 'EVC Inspections', icon: Calendar },
    { id: 'Compliance', label: 'Compliance & Expiry', icon: FileCheck2 },
    { id: 'Alerts', label: 'Alerts & Escalations', icon: Bell, badge: unreadAlertsCount },
    { id: 'Reports', label: 'Reports & Export', icon: BarChart3 },
    { id: 'Role Matrix', label: 'Roles & Access Guide', icon: Shield },
  ];

  return (
    <aside className="sidebar">
      <div className="brand-section">
        <div className="brand-icon">
          <ShieldCheck size={22} />
        </div>
        <div className="brand-text">
          <h1>AICTE Hub</h1>
          <span>SIH Prototype · PS4</span>
        </div>
      </div>

      <div className="nav-group-label">Operations</div>
      <nav className="nav-links">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <Icon size={17} />
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="badge-count">{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-user">
        <div className="user-info">
          <span className="user-name">{user?.name || 'Authorized User'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="user-role-badge">{user?.role}</span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{user?.region}</span>
          </div>
          {user?.institution_name && (
            <span className="user-inst" title={user.institution_name}>
              <Building2 size={11} style={{ display: 'inline', marginRight: 3 }} />
              {user.institution_name}
            </span>
          )}
        </div>
        <button className="btn-signout" onClick={onSignOut}>
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};
