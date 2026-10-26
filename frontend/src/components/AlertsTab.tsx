import React, { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PlayCircle,
  Check,
  Building2
} from 'lucide-react';
import { AlertItem, User } from '../types';
import { api, markNotificationRead } from '../api';

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
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const filteredAlerts = alerts.filter((al) => {
    if (unreadOnly && al.is_read) return false;
    if (severityFilter !== 'ALL' && al.severity !== severityFilter) return false;
    return true;
  });

  async function handleMarkRead(aid: number) {
    try {
      await markNotificationRead(aid);
      onRefresh();
    } catch (err: any) {
      console.error(err);
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="badge badge-overdue"><AlertTriangle size={10} /> Critical</span>;
      case 'HIGH':
        return <span className="badge badge-overdue">High Priority</span>;
      case 'WARNING':
        return <span className="badge badge-returned">Warning</span>;
      default:
        return <span className="badge badge-in_progress">Notice</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Regulatory Alerts & Escalation Center</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Automated notifications for approaching deadlines, overdue scrutinies, and pending compliances
            </span>
          </div>

          {user?.role !== 'institution' && (
            <button
              className="btn-primary"
              onClick={onRunEscalation}
              disabled={isScanning}
            >
              <PlayCircle size={15} />
              <span>{isScanning ? 'Evaluating Regulatory Timelines...' : 'Trigger Deadline Scan'}</span>
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="filter-bar">
          <select
            className="filter-select"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Notice</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            <span>Show unread notifications only</span>
          </label>
        </div>

        {/* Alerts List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No alerts found for the selected criteria.
            </div>
          ) : (
            filteredAlerts.map((al) => {
              const isCrit = al.severity === 'CRITICAL' || al.severity === 'HIGH';
              return (
                <div
                  key={al.id}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: al.is_read ? '#f8fafc' : (isCrit ? '#fef2f2' : '#fffbeb'),
                    border: `1px solid ${al.is_read ? 'var(--border-subtle)' : (isCrit ? '#fecaca' : '#fed7aa')}`,
                    borderLeft: `5px solid ${isCrit ? '#dc2626' : (al.severity === 'WARNING' ? '#d97706' : '#2563eb')}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ fontSize: 13, color: 'var(--text-main)' }}>{al.title}</b>
                      {getSeverityBadge(al.severity)}
                      {al.is_read && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Read</span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: '#334155', lineHeight: 1.4 }}>
                      {al.message}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      <span>Target Role: <b style={{ textTransform: 'uppercase' }}>{al.target_role}</b></span>
                      {al.institution_name && (
                        <span>· Institution: <b>{al.institution_name}</b></span>
                      )}
                      <span>· {new Date(al.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  {!al.is_read && (
                    <button
                      className="btn-secondary"
                      style={{ padding: '5px 9px', fontSize: 11, flexShrink: 0 }}
                      onClick={() => handleMarkRead(al.id)}
                    >
                      <Check size={12} />
                      <span>Mark Read</span>
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
