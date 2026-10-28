import React, { useState } from 'react';
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
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  X
} from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  user: User | null;
  unreadAlertsCount: number;
  onSignOut: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setTab,
  user,
  unreadAlertsCount,
  onSignOut,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const toggleSidebar = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  const isInst = user?.role === 'institution';

  // Structured enterprise GovTech navigation groups
  const navSections = isInst
    ? [
        {
          group: 'Core Operations',
          items: [
            { id: 'Overview', label: 'Command Centre', icon: LayoutDashboard },
            { id: 'Applications', label: 'Application Dossiers', icon: ClipboardList },
          ]
        },
        {
          group: 'Compliance & Evidence',
          items: [
            { id: 'Compliance', label: 'Compliance Proofs', icon: FileCheck2 },
            { id: 'Alerts', label: 'Notifications', icon: Bell, badge: unreadAlertsCount },
          ]
        },
        {
          group: 'System Access',
          items: [
            { id: 'Role Matrix', label: 'Evaluation Roles', icon: Shield },
          ]
        }
      ]
    : [
        {
          group: 'Core Operations',
          items: [
            { id: 'Overview', label: 'Command Centre', icon: LayoutDashboard },
            { id: 'Applications', label: 'Application Register', icon: ClipboardList },
          ]
        },
        {
          group: 'Regulatory Scrutiny',
          items: [
            { id: 'AI Assistant', label: 'Document Scrutiny', icon: Sparkles },
            { id: 'EVC Inspections', label: 'EVC Committee Queue', icon: Calendar },
            { id: 'Compliance', label: 'Compliance & Validity', icon: FileCheck2 },
          ]
        },
        {
          group: 'Governance & Analytics',
          items: [
            { id: 'Alerts', label: 'Alerts & Escalations', icon: Bell, badge: unreadAlertsCount },
            { id: 'Reports', label: 'Reports & Export', icon: BarChart3 },
            { id: 'Role Matrix', label: 'Roles & Access Matrix', icon: Shield },
          ]
        }
      ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Brand Section */}
      <div className="brand-section">
        {!isCollapsed && (
          <div className="brand-wrapper">
            <div className="brand-icon">
              <ShieldCheck size={20} />
            </div>
            <div className="brand-text">
              <h1>PRAVAHA</h1>
              <span>AICTE Regulatory Hub</span>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="brand-icon" title="Pravaha AICTE Regulatory Hub" style={{ margin: '0 auto' }}>
            <ShieldCheck size={20} />
          </div>
        )}

        {/* Desktop Collapse Toggle */}
        <button
          type="button"
          className="btn-collapse-toggle desktop-only-btn"
          onClick={toggleSidebar}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label="Toggle sidebar collapse"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Mobile Close Button */}
        {onCloseMobile && (
          <button
            type="button"
            className="mobile-sidebar-close"
            onClick={onCloseMobile}
            aria-label="Close mobile sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="nav-links">
        {navSections.map((sec, sIdx) => (
          <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="nav-group-label" title={sec.group}>
              {isCollapsed ? '•••' : sec.group}
            </div>
            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  title={isCollapsed ? `${item.label}${item.badge ? ` (${item.badge})` : ''}` : undefined}
                >
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="badge-count">{item.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User Footer Profile */}
      <div className="sidebar-user">
        {!isCollapsed && (
          <div className="user-info">
            <span className="user-name" title={user?.name}>
              {user?.name || 'Authorized Official'}
            </span>
            <div className="user-meta-row">
              <span className="user-role-badge">{user?.role}</span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{user?.region}</span>
            </div>
            {user?.institution_name && (
              <span className="user-inst" title={user.institution_name}>
                <Building2 size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                {user.institution_name}
              </span>
            )}
          </div>
        )}

        <button className="btn-signout" onClick={onSignOut} title="Sign out of official portal">
          <LogOut size={13} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
