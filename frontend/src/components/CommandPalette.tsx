import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  LayoutDashboard,
  ClipboardList,
  Sparkles,
  Calendar,
  FileCheck2,
  Bell,
  BarChart3,
  Shield,
  Building2,
  Scale,
  Users,
  Compass,
  ArrowRight,
  PlayCircle,
  CornerDownLeft
} from 'lucide-react';
import { Application } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  applications: Application[];
  onNavigateTab: (tab: string) => void;
  onSelectApplication: (app: Application) => void;
  onSwitchRole: (email: string) => void;
  onOpenGuide: () => void;
  onRunEscalation?: () => void;
  currentUserRole?: string;
}

interface PaletteItem {
  id: string;
  category: 'Navigation' | 'Personas' | 'Applications' | 'Actions';
  title: string;
  subtitle?: string;
  icon: any;
  action: () => void;
  badge?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  applications,
  onNavigateTab,
  onSelectApplication,
  onSwitchRole,
  onOpenGuide,
  onRunEscalation,
  currentUserRole
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Build searchable items
  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [
      // Quick Actions
      {
        id: 'action-guide',
        category: 'Actions',
        title: 'Open Platform User Guide',
        subtitle: 'Interactive walkthrough, statutory workflows & glossary',
        icon: Compass,
        action: () => {
          onClose();
          onOpenGuide();
        },
        badge: 'Help'
      },
      // Navigation Tabs
      {
        id: 'nav-overview',
        category: 'Navigation',
        title: 'Command Centre (Overview)',
        subtitle: 'Regulatory pipeline & principal operations metrics',
        icon: LayoutDashboard,
        action: () => {
          onClose();
          onNavigateTab('Overview');
        }
      },
      ...((currentUserRole !== 'officer' && currentUserRole !== 'evc' && currentUserRole !== 'evc_expert') ? [{
        id: 'nav-applications',
        category: 'Navigation' as const,
        title: 'Application Register',
        subtitle: 'All technical institution approval dossiers',
        icon: ClipboardList,
        action: () => {
          onClose();
          onNavigateTab('Applications');
        }
      }] : []),
      ...((currentUserRole !== 'evc' && currentUserRole !== 'evc_expert') ? [{
        id: 'nav-scrutiny',
        category: 'Navigation' as const,
        title: 'AI Document Scrutiny Workspace',
        subtitle: 'Automated OCR extraction & clause discrepancy checks',
        icon: Sparkles,
        action: () => {
          onClose();
          onNavigateTab('Document Scrutiny');
        }
      }] : []),
      {
        id: 'nav-evc',
        category: 'Navigation',
        title: 'EVC Inspections & Committee Queue',
        subtitle: 'Inspection roster, calendar view & findings verification',
        icon: Calendar,
        action: () => {
          onClose();
          onNavigateTab('EVC Inspections');
        }
      },
      {
        id: 'nav-compliance',
        category: 'Navigation',
        title: 'Compliance & Cryptographic Validity',
        subtitle: '30-year lease deeds, fire safety & SHA-256 audit chain',
        icon: FileCheck2,
        action: () => {
          onClose();
          onNavigateTab('Compliance');
        }
      },
      {
        id: 'nav-alerts',
        category: 'Navigation',
        title: 'Alerts & Statutory Escalations',
        subtitle: 'SLA countdowns, notifications & deadline warnings',
        icon: Bell,
        action: () => {
          onClose();
          onNavigateTab('Alerts');
        }
      },
      {
        id: 'nav-reports',
        category: 'Navigation',
        title: 'Reports & Data Exports',
        subtitle: 'Official AICTE approval logs & registry downloads',
        icon: BarChart3,
        action: () => {
          onClose();
          onNavigateTab('Reports');
        }
      },
      ...(currentUserRole === 'admin' ? [{
        id: 'nav-roles',
        category: 'Navigation' as const,
        title: 'Role Matrix & Governance',
        subtitle: 'Inspect evaluation persona permissions',
        icon: Shield,
        action: () => {
          onClose();
          onNavigateTab('Role Matrix');
        }
      }] : []),
    ];

    if (onRunEscalation) {
      items.push({
        id: 'action-escalation',
        category: 'Actions',
        title: 'Scan Statutory Deadlines (SLA Check)',
        subtitle: 'Auto-detect overdue applications & raise alerts',
        icon: PlayCircle,
        action: () => {
          onClose();
          onRunEscalation();
        },
        badge: 'SLA'
      });
    }

    // Applications dynamically from props
    applications.forEach((app) => {
      items.push({
        id: `app-${app.id}`,
        category: 'Applications',
        title: app.institution_name,
        subtitle: `${app.reference || `APP-${app.id}`} • ${app.application_type} • Stage: ${app.current_stage || app.status}`,
        icon: Building2,
        action: () => {
          onClose();
          onSelectApplication(app);
        },
        badge: app.status
      });
    });

    return items;
  }, [applications, onNavigateTab, onSelectApplication, onSwitchRole, onOpenGuide, onRunEscalation, onClose, currentUserRole]);

  // Filtered by query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  // Keep selected index in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Auto-scroll selected into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
      style={{
        zIndex: 10000,
        alignItems: 'flex-start',
        paddingTop: '10vh'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog"
        style={{
          maxWidth: 620,
          width: '92vw',
          maxHeight: '75vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          background: '#FFFFFF',
          border: '1px solid #CBD5E1',
          padding: 0
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderBottom: '1px solid #E2E8F0',
            background: '#FFFFFF'
          }}
        >
          <Search size={18} color="#2563EB" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            id="command-palette-title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search applications, jump to tab, or switch personas..."
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: 14.5,
              color: '#0F172A',
              background: 'transparent'
            }}
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 2
              }}
              aria-label="Clear query"
            >
              <X size={16} />
            </button>
          ) : (
            <kbd
              style={{
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 11,
                color: '#64748B',
                whiteSpace: 'nowrap'
              }}
            >
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={{
            overflowY: 'auto',
            maxHeight: '420px',
            padding: '8px 6px',
            background: '#FFFFFF'
          }}
        >
          {filteredItems.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748B' }}>
              <Search size={28} color="#CBD5E1" style={{ margin: '0 auto 8px auto', display: 'block' }} />
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500 }}>No results found for "{query}"</p>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>Try searching by college name, application ID, or section.</span>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: isSelected ? '#EFF6FF' : 'transparent',
                    border: `1px solid ${isSelected ? '#BFDBFE' : 'transparent'}`,
                    transition: 'all 0.1s ease',
                    marginBottom: 2
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 6,
                        background: isSelected ? '#2563EB' : '#F1F5F9',
                        color: isSelected ? '#FFFFFF' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.1s ease'
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 13.5,
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? '#1E40AF' : '#1E293B',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {item.title}
                        </span>
                        {item.badge && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: isSelected ? '#DBEAFE' : '#F1F5F9',
                              color: isSelected ? '#1E40AF' : '#64748B',
                              flexShrink: 0
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <span
                          style={{
                            fontSize: 11.5,
                            color: '#64748B',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'block'
                          }}
                        >
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{item.category}</span>
                    {isSelected && <CornerDownLeft size={13} color="#2563EB" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div
          style={{
            padding: '8px 16px',
            background: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11.5,
            color: '#64748B'
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            <span>Navigate: <kbd style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', padding: '1px 4px', borderRadius: 3 }}>↑</kbd> <kbd style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', padding: '1px 4px', borderRadius: 3 }}>↓</kbd></span>
            <span>Select: <kbd style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', padding: '1px 4px', borderRadius: 3 }}>↵ Enter</kbd></span>
          </div>
          <span>PRAVAHA Quick Jump</span>
        </div>
      </div>
    </div>
  );
};
