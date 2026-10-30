import React, { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PlayCircle,
  Check,
  Building2,
  ShieldCheck,
  RotateCcw,
  Info,
  Calendar
} from 'lucide-react';
import { AlertItem, User } from '../types';
import { markNotificationRead } from '../api';

interface AlertsTabProps {
  alerts: AlertItem[];
  user: User | null;
  onRefresh: () => void;
  onRunEscalation: () => void;
  isScanning: boolean;
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
  alerts,
  user,
  onRefresh,
  onRunEscalation,
  isScanning
}) => {
  const [localAlerts, setLocalAlerts] = useState<AlertItem[]>(alerts);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [markingId, setMarkingId] = useState<number | null>(null);

  React.useEffect(() => {
    setLocalAlerts(alerts);
  }, [alerts]);

  const filteredAlerts = localAlerts.filter((al) => {
    if (unreadOnly && al.is_read) return false;
    if (severityFilter !== 'ALL' && al.severity !== severityFilter) return false;
    return true;
  });

  async function handleMarkRead(aid: number) {
    setMarkingId(aid);
    try {
      await markNotificationRead(aid);
      setLocalAlerts((prev) => prev.map((a) => (a.id === aid ? { ...a, is_read: true } : a)));
    } catch (err: any) {
      console.error('Failed to mark alert as read:', err);
    } finally {
      setMarkingId(null);
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="badge badge-overdue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={10} /> Critical SLA Breach
          </span>
        );
      case 'HIGH':
        return (
          <span className="badge badge-overdue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={10} /> High Priority
          </span>
        );
      case 'WARNING':
        return (
          <span className="badge badge-returned" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} /> Approaching Deadline
          </span>
        );
      default:
        return (
          <span className="badge badge-in_progress" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Info size={10} /> Regulatory Notice
          </span>
        );
    }
  };

  const unreadCount = localAlerts.filter((a) => !a.is_read).length;

  return (
    <div className="page-container">
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Regulatory Alerts & Escalation Center</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Automated statutory notifications for approaching deadlines, overdue scrutinies, and pending compliances
            </span>
          </div>

          {user?.role !== 'institution' && (
            <button
              type="button"
              className="btn-primary"
              onClick={onRunEscalation}
              disabled={isScanning}
              id="btn-trigger-scan"
            >
              <PlayCircle size={15} />
              <span>{isScanning ? 'Evaluating Regulatory Timelines...' : 'Trigger Deadline Scan'}</span>
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="filter-bar">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Severity:</span>
            <select
              className="filter-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              aria-label="Filter alerts by severity"
            >
              <option value="ALL">All Severities ({alerts.length})</option>
              <option value="CRITICAL">Critical Breaches</option>
              <option value="HIGH">High Priority</option>
              <option value="WARNING">Warnings</option>
              <option value="INFO">Notices</option>
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            <span>Unread Only ({unreadCount})</span>
          </label>

          {(severityFilter !== 'ALL' || unreadOnly) && (
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={() => {
                setSeverityFilter('ALL');
                setUnreadOnly(false);
              }}
            >
              <RotateCcw size={11} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Alerts List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredAlerts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon success">
                <ShieldCheck size={28} />
              </div>
              <div className="empty-state-title">
                {unreadOnly ? 'No Unread Alerts' : 'All Regulatory Timelines Compliant'}
              </div>
              <div className="empty-state-desc">
                {unreadOnly
                  ? 'All notifications have been reviewed. Switch off the "Unread Only" filter to view past notices.'
                  : severityFilter !== 'ALL'
                  ? `No alerts match severity filter "${severityFilter}".`
                  : 'There are no active regulatory breaches, deadline escalations, or overdue case alerts in the system.'}
              </div>
              <div className="empty-state-actions">
                {(severityFilter !== 'ALL' || unreadOnly) && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setSeverityFilter('ALL');
                      setUnreadOnly(false);
                    }}
                  >
                    View All Notifications
                  </button>
                )}
                {user?.role !== 'institution' && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={onRunEscalation}
                    disabled={isScanning}
                  >
                    <PlayCircle size={14} />
                    <span>{isScanning ? 'Scanning...' : 'Run SLA & Deadline Scan'}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            filteredAlerts.map((al) => {
              const isCrit = al.severity === 'CRITICAL' || al.severity === 'HIGH';
              const isWarning = al.severity === 'WARNING';
              const isItemMarking = markingId === al.id;

              return (
                <div
                  key={al.id}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: al.is_read ? '#f8fafc' : isCrit ? '#fef2f2' : isWarning ? '#fffbeb' : '#f0f9ff',
                    border: `1px solid ${al.is_read ? 'var(--border-subtle)' : isCrit ? '#fecaca' : isWarning ? '#fed7aa' : '#bae6fd'}`,
                    borderLeft: `5px solid ${al.is_read ? '#94a3b8' : isCrit ? '#dc2626' : isWarning ? '#d97706' : '#2563eb'}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: 13.5, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{al.title}</b>
                      {getSeverityBadge(al.severity)}
                      {al.is_read ? (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', background: '#e2e8f0', padding: '1px 6px', borderRadius: 4 }}>
                          Acknowledged
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, background: '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>
                          New
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.45 }}>
                      {al.message}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)', marginTop: 4, flexWrap: 'wrap' }}>
                      <span>
                        Target Role: <b style={{ textTransform: 'uppercase', color: 'var(--color-navy)' }}>{al.target_role}</b>
                      </span>
                      {al.institution_name && (
                        <span>
                          · Institution: <b style={{ color: '#1e293b' }}>{al.institution_name}</b>
                        </span>
                      )}
                      <span>· {new Date(al.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  {!al.is_read && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '6px 11px', fontSize: 11.5, flexShrink: 0 }}
                      disabled={isItemMarking}
                      onClick={() => handleMarkRead(al.id)}
                      title="Acknowledge and mark notification as read"
                    >
                      <Check size={13} color="#059669" />
                      <span>{isItemMarking ? 'Updating...' : 'Mark Read'}</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
