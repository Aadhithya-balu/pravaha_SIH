import React from 'react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  LogIn,
  Key,
  Users
} from 'lucide-react';

interface RoleMatrixTabProps {
  onSwitchRole: (email: string) => void;
}

export const RoleMatrixTab: React.FC<RoleMatrixTabProps> = ({ onSwitchRole }) => {
  const roles = [
    {
      title: 'Regional Officer / Admin (Combined Role)',
      role: 'officer',
      email: 'officer@demo.local',
      name: 'Dr. Rajesh Verma',
      designation: 'Regional Officer & Systems Administrator',
      scope: 'Unified Scrutiny, Compliance Verification & IT Governance',
      permissions: [
        'Perform primary and re-scrutiny workflow transitions',
        'Return applications with mandatory deficiency justifications',
        'Verify submitted compliance and statutory undertakings',
        'Schedule Expert Visiting Committees (EVC)',
        'Trigger regulatory deadline evaluations and view alerts'
      ]
    },
    {
      title: 'Institution Applicant',
      role: 'institution',
      email: 'college@demo.local',
      name: 'Prof. Anand Deshmukh',
      designation: 'Principal, ABC Engineering College',
      scope: 'Strict Tenant Isolation (Own College records only)',
      permissions: [
        'Register new AICTE applications with academic details',
        'Upload regulatory documents (lease deeds, NOCs, affidavits)',
        'Resubmit returned cases with institutional justifications',
        'Submit documentary evidence for pending undertakings',
        'Restricted from viewing or altering other colleges'
      ]
    },
    {
      title: 'Bureau Officer (HQ)',
      role: 'bureau',
      email: 'bureau@demo.local',
      name: 'Dr. Sunita Rao',
      designation: 'Advisor & Bureau Head (Approval Bureau New Delhi)',
      scope: 'National Regulatory Oversight & Appellate Review',
      permissions: [
        'Conduct Standing Appellate / Hearing Committee (SAC/SHC) determinations',
        'Grant final approval orders for technical institutions',
        'Review comprehensive national and regional throughput dashboards',
        'Export full regulatory CSV registers'
      ]
    },
    {
      title: 'EVC Expert / Coordinator',
      role: 'evc_expert',
      email: 'evc@demo.local',
      name: 'Prof. S. Ramanujan',
      designation: 'Senior EVC Committee Chairperson',
      scope: 'Assigned Physical & Hybrid Inspection Cases',
      permissions: [
        'Access assigned inspection portfolios',
        'Record lab equipment and physical campus observations',
        'Submit official committee recommendations and visit reports'
      ]
    },
    {
      title: 'System Administrator',
      role: 'admin',
      email: 'admin@demo.local',
      name: 'AICTE System Administrator',
      designation: 'Lead IT Systems Administrator',
      scope: 'Global System Configuration & Master Data',
      permissions: [
        'Full administrative access to all entities and workflow steps',
        'Override workflow stage locks in exceptional administrative circumstances',
        'Evaluate system escalation rules and audit integrity'
      ]
    }
  ];

  const permissionsMatrix = [
    { feature: 'Create New Application', inst: true, ro: true, bureau: true, evc: false, admin: true },
    { feature: 'View All Regional Applications', inst: false, ro: true, bureau: true, evc: true, admin: true },
    { feature: 'Scrutiny Stage Transitions', inst: false, ro: true, bureau: true, evc: false, admin: true },
    { feature: 'Return Case for Clarification', inst: false, ro: true, bureau: true, evc: false, admin: true },
    { feature: 'Resubmit Returned Application', inst: true, ro: false, bureau: false, evc: false, admin: true },
    { feature: 'Schedule EVC Committee', inst: false, ro: true, bureau: true, evc: true, admin: true },
    { feature: 'Submit EVC Inspection Report', inst: false, ro: true, bureau: false, evc: true, admin: true },
    { feature: 'Verify Compliance Evidence', inst: false, ro: true, bureau: true, evc: false, admin: true },
    { feature: 'Submit Compliance Evidence', inst: true, ro: false, bureau: false, evc: false, admin: true },
    { feature: 'SAC / SHC Final Approval', inst: false, ro: false, bureau: true, evc: false, admin: true },
    { feature: 'Trigger Deadline Scan', inst: false, ro: true, bureau: true, evc: false, admin: true },
    { feature: 'Export Regulatory CSV', inst: false, ro: true, bureau: true, evc: false, admin: true },
  ];

  return (
    <div className="page-container">
      {/* Demo Credentials Box */}
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Prototype Role Matrix & Evaluator Credentials</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Standard password for all demo accounts: <code style={{ color: 'var(--primary)', fontWeight: 700 }}>DemoPass123!</code>
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {roles.map((r) => (
            <div
              key={r.role}
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="user-role-badge">{r.role}</span>
                <span
                  style={{
                    padding: '3px 8px',
                    fontSize: 10.5,
                    fontWeight: 700,
                    borderRadius: 4,
                    background: '#F1F5F9',
                    color: '#475569',
                    border: '1px solid #CBD5E1'
                  }}
                >
                  Authorized Persona
                </span>
              </div>

              <div>
                <b style={{ fontSize: 14, display: 'block', color: 'var(--text-main)' }}>{r.name}</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.designation}</span>
                <span style={{ fontSize: 11, color: 'var(--primary)', display: 'block', marginTop: 2 }}>{r.email}</span>
              </div>

              <div style={{ fontSize: 11, background: '#f8fafc', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <b style={{ color: '#475569', display: 'block', marginBottom: 2 }}>Scope of Authority:</b>
                <span>{r.scope}</span>
              </div>

              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {r.permissions.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Role-Based Permissions Matrix Table */}
      <div className="panel-card">
        <div className="panel-header">
          <h3>
            <Shield size={18} color="var(--primary)" />
            Server-Enforced Role-Based Access Control (RBAC) Matrix
          </h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            All rules are validated on FastAPI backend endpoints, not merely hidden in the frontend
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
                <th style={{ textAlign: 'center' }}>Admin</th>
              </tr>
            </thead>
            <tbody>
              {permissionsMatrix.map((row) => (
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
    </div>
  );
};
