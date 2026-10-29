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
  X,
  Compass
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
  onOpenGuide?: () => void;
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
  onCloseMobile,
  onOpenGuide
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
              <h1>AICTE PRAVAHA</h1>
              <span>Regulatory Platform</span>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="brand-icon" title="PRAVAHA – Regulatory Platform" style={{ margin: '0 auto' }}>
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
          {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
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

      {/* Platform Guide & Instructions */}
      {onOpenGuide && (
        <div style={{ padding: '0 12px 8px 12px' }}>
          <button
            type="button"
            className="nav-item"
            onClick={onOpenGuide}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 8,
              background: '#EFF6FF',
              color: '#163A63',
              fontWeight: 600,
              fontSize: 12.5,
              border: '1px solid #BFDBFE',
              cursor: 'pointer'
            }}
            title="Open PRAVAHA Platform Guide and User Instructions"
          >
            <Compass size={16} color="#2563EB" style={{ flexShrink: 0 }} />
            {!isCollapsed && <span>How to Use Guide</span>}
          </button>
        </div>
      )}

      {/* User Footer Profile */}
      <div className="sidebar-user">
        {!isCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: '#EFF6FF',
              color: '#163A63',
              border: '1px solid #BFDBFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 12,
              flexShrink: 0
            }}>
              {user?.name ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'AO'}
            </div>
            <div className="user-info" style={{ minWidth: 0, flex: 1 }}>
              <span className="user-name" title={user?.name}>
                {user?.name || 'Authorized Official'}
              </span>
              <div className="user-meta-row">
                <span className="user-role-badge">{user?.role}</span>
                <span style={{ fontSize: 10, color: '#64748B' }}>{user?.region}</span>
              </div>
              {user?.institution_name && (
                <span className="user-inst" title={user.institution_name}>
                  <Building2 size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                  {user.institution_name}
                </span>
              )}
            </div>
          </div>
        )}

        {isCollapsed && (
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#EFF6FF',
            color: '#163A63',
            border: '1px solid #BFDBFE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 11,
            margin: '0 auto 6px auto'
          }} title={user?.name || 'Authorized Official'}>
            {user?.name ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'AO'}
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
