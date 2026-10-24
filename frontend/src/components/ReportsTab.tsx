import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Building2,
  PieChart
} from 'lucide-react';
import { DashboardMetrics, User } from '../types';
import { downloadCsv } from '../api';

interface ReportsTabProps {
  metrics: DashboardMetrics | null;
  user: User | null;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ metrics, user }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState('');
  const [downloadError, setDownloadError] = useState('');

  async function handleExport(type: 'applications' | 'compliance') {
    setIsExporting(true);
    setDownloadSuccess('');
    setDownloadError('');
    try {
      await downloadCsv(type);
      setDownloadSuccess(`Successfully generated and downloaded ${type} CSV report.`);
    } catch (err: any) {
      setDownloadError(err.message || 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="page-container">
      {/* CSV Export Panel */}
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Official Regulatory Reports & Data Export</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Generate RFC-4180 compliant CSV reports sanitized against formula injection vulnerabilities
            </span>
          </div>
        </div>

        {downloadSuccess && (
          <div className="alert-banner info" style={{ marginBottom: 14 }}>
            <CheckCircle2 size={16} />
            <span>{downloadSuccess}</span>
          </div>
        )}
        {downloadError && (
          <div className="alert-banner danger" style={{ marginBottom: 14 }}>
            <AlertTriangle size={16} />
            <span>{downloadError}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{
            padding: '18px',
            borderRadius: 'var(--radius-md)',
            background: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileSpreadsheet size={22} color="#059669" />
              <div>
                <b style={{ fontSize: 13, display: 'block' }}>All Applications Register</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Complete registry with reference, stage, status, due dates and regions
                </span>
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ marginTop: 'auto', justifyContent: 'center' }}
              disabled={isExporting}
              onClick={() => handleExport('applications')}
            >
              <Download size={14} />
              <span>Export Applications CSV</span>
            </button>
          </div>

          <div style={{
            padding: '18px',
            borderRadius: 'var(--radius-md)',
            background: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileSpreadsheet size={22} color="#2563eb" />
              <div>
                <b style={{ fontSize: 13, display: 'block' }}>Compliance & Expiry Register</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Statutory undertakings, lease validity, and safety NOC verifications
                </span>
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ marginTop: 'auto', justifyContent: 'center', background: '#059669', borderColor: '#059669' }}
              disabled={isExporting}
              onClick={() => handleExport('compliance')}
            >
              <Download size={14} />
              <span>Export Compliance CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Aggregate Visuals */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Applications by Type */}
          <div className="panel-card">
            <div className="panel-header">
              <h3>
                <PieChart size={17} color="var(--primary)" />
                Distribution by Application Type
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(metrics.by_type || {}).map(([type, count]) => {
                const pct = Math.round((count / Math.max(1, metrics.total_applications)) * 100);
                return (
                  <div key={type} style={{ fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{type}</span>
                      <b>{count} ({pct}%)</b>
                    </div>
                    <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#2563eb', borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Regulatory Throughput Overview */}
          <div className="panel-card">
            <div className="panel-header">
              <h3>
                <BarChart3 size={17} color="var(--primary)" />
                Regulatory Operations Throughput
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span>Active In Scrutiny Cases</span>
                <b>{metrics.in_progress}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span>Overdue Cases Requiring Escalation</span>
                <b style={{ color: '#dc2626' }}>{metrics.overdue}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span>Cases Awaiting Applicant Clarification</span>
                <b style={{ color: '#d97706' }}>{metrics.returned}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                <span>Formal Approvals Issued</span>
                <b style={{ color: '#059669' }}>{metrics.completed}</b>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
