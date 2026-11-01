import React, { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Users,
  Lock,
  AlertTriangle,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { User } from '../types';
import { fetchAdminRoleMatrix } from '../api';

interface RoleMatrixTabProps {
  onSwitchRole: (email: string) => void;
  user?: User | null;
}

export const RoleMatrixTab: React.FC<RoleMatrixTabProps> = ({ onSwitchRole, user }) => {
  const [matrixData, setMatrixData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      loadMatrix();
    }
  }, [isAdmin]);

  async function loadMatrix() {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchAdminRoleMatrix();
      setMatrixData(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load official administrative role matrix.');
    } finally {
      setIsLoading(false);
    }
  }

  // Non-Admin Restricted View
  if (!isAdmin) {
    return (
      <div className="page-container">
        <div className="panel-card" style={{ maxWidth: 640, margin: '40px auto', textAlign: 'center', padding: '36px 24px' }}>
          <div style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: '#FEE2E2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Lock size={26} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}>
            Restricted Administrative Access
          </h2>
          <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.6, marginBottom: 20 }}>
            The <b>Role Matrix & Security Governance</b> module is strictly restricted to certified System Administrators.
            Your current authenticated role is <b>{user?.role?.toUpperCase()}</b>.
          </p>
          <div style={{
            padding: '12px 16px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 6,
            fontSize: 12.5,
            color: '#475569',
            textAlign: 'left'
          }}>
            <strong>Statutory Rule Reference:</strong> In accordance with AICTE e-Governance protocols, role assignments and statutory privilege matrices can only be audited and configured by System Administrators.
          </div>
        </div>
      </div>
    );
  }

  const defaultMatrix = [
    { feature: 'Create New Application', inst: true, ro: true, bureau: true, evc: false, admin: true },
    { feature: 'Application Register Access', inst: true, ro: false, bureau: true, evc: false, admin: true },
    { feature: 'Scrutiny & Re-Scrutiny Transitions', inst: false, ro: true, bureau: true, evc: false, admin: true },
    { feature: 'Return Case for Clarification', inst: false, ro: true, bureau: true, evc: false, admin: true },
    { feature: 'Resubmit Returned Application', inst: true, ro: false, bureau: false, evc: false, admin: true },
    { feature: 'AI & Manual EVC Staff Assignment', inst: false, ro: true, bureau: true, evc: false, admin: true },
    { feature: 'Confirm / Decline EVC Assignment', inst: false, ro: false, bureau: false, evc: true, admin: true },
    { feature: 'Submit EVC Inspection Report & Proof', inst: false, ro: false, bureau: false, evc: true, admin: true },
    { feature: 'Approve Next Stage (EVC Clearance)', inst: false, ro: true, bureau: true, evc: false, admin: true },
    { feature: 'Verify Compliance Evidence', inst: false, ro: true, bureau: true, evc: false, admin: true },
    { feature: 'Submit Compliance Evidence', inst: true, ro: false, bureau: false, evc: false, admin: true },
    { feature: 'SAC / SHC Final Statutory Approval', inst: false, ro: false, bureau: true, evc: false, admin: true },
    { feature: 'Role Matrix & Governance (Admin Only)', inst: false, ro: false, bureau: false, evc: false, admin: true }
  ];

  const displayMatrix = matrixData?.matrix
    ? matrixData.matrix.map((m: any) => ({
        feature: m.feature,
        inst: m.institution,
        ro: m.officer,
        bureau: m.bureau,
        evc: m.evc_expert,
        admin: m.admin
      }))
    : defaultMatrix;

  return (
    <div className="page-container">
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        background: '#EFF6FF',
        border: '1px solid #BFDBFE',
        borderRadius: 8,
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Shield size={24} color="#1D4ED8" />
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1E3A8A' }}>
              System Administrator Security & Role Matrix Governance
            </h3>
            <span style={{ fontSize: 12, color: '#3B82F6' }}>
              Authoritative server-side RBAC validation with endpoint protection (Strict Admin Access)
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={loadMatrix}
          disabled={isLoading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: '#FFFFFF',
            border: '1px solid #93C5FD',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            color: '#1D4ED8',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          <span>Refresh Matrix</span>
        </button>
      </div>

      {errorMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 6,
          background: '#FDF2F2',
          border: '1px solid #FDE2E2',
          color: '#D64545',
          fontSize: 13,
          marginBottom: 16
        }}>
          {errorMsg}
        </div>
      )}

      {/* Role-Based Permissions Matrix Table */}
      <div className="panel-card" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <h3>
            <Shield size={18} color="var(--primary)" />
            Server-Enforced Role-Based Access Control (RBAC) Matrix
          </h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Configured on FastAPI backend dependencies — unauthorized roles receive HTTP 403 Forbidden
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Regulatory Workflow Capability</th>
                <th style={{ textAlign: 'center' }}>Institution</th>
                <th style={{ textAlign: 'center' }}>RO Officer</th>
                <th style={{ textAlign: 'center' }}>Bureau HQ</th>
                <th style={{ textAlign: 'center' }}>EVC Expert</th>
                <th style={{ textAlign: 'center' }}>System Admin</th>
              </tr>
            </thead>
            <tbody>
              {displayMatrix.map((row: any) => (
                <tr key={row.feature}>
                  <td>
                    <b>{row.feature}</b>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {row.inst ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#cbd5e1" />}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {row.ro ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#cbd5e1" />}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {row.bureau ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#cbd5e1" />}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {row.evc ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#cbd5e1" />}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {row.admin ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#cbd5e1" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live System Evaluator Roster */}
      {matrixData?.users && (
        <div className="panel-card">
          <div className="panel-header">
            <h3>
              <Users size={18} color="var(--primary)" />
              Registered Evaluator & Staff Directory ({matrixData.users.length} Active Accounts)
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Live server users and live availability state
            </span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>System Role</th>
                  <th>Region</th>
                  <th>Live Availability</th>
                </tr>
              </thead>
              <tbody>
                {matrixData.users.map((u: any) => (
                  <tr key={u.id}>
                    <td><code>#{u.id}</code></td>
                    <td><b>{u.name}</b></td>
                    <td><span style={{ color: '#2563EB', fontSize: 12 }}>{u.email}</span></td>
                    <td>
                      <span className="user-role-badge" style={{ textTransform: 'uppercase' }}>
                        {u.role}
                      </span>
                    </td>
                    <td>{u.region || 'National'}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        background:
                          u.availability_status === 'AVAILABLE' ? '#DCFCE7' :
                          u.availability_status === 'BUSY' ? '#FEF3C7' : '#FEE2E2',
                        color:
                          u.availability_status === 'AVAILABLE' ? '#166534' :
                          u.availability_status === 'BUSY' ? '#92400E' : '#991B1B'
                      }}>
                        {u.availability_status || 'AVAILABLE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
