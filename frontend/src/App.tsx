import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Mail,
  ArrowRight
} from 'lucide-react';
import { api, token } from './api';
import { User, Application, AlertItem, DashboardMetrics } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewTab } from './components/OverviewTab';
import { ApplicationsTab } from './components/ApplicationsTab';
import { ApplicationDetailModal } from './components/ApplicationDetailModal';
import { DocumentReviewTab } from './components/DocumentReviewTab';
import { EvcTab } from './components/EvcTab';
import { ComplianceTab } from './components/ComplianceTab';
import { AlertsTab } from './components/AlertsTab';
import { ReportsTab } from './components/ReportsTab';
import { RoleMatrixTab } from './components/RoleMatrixTab';

export default function App() {
  const [authToken, setAuthToken] = useState<string>(token());
  const [user, setUser] = useState<User | null>(null);
  const [currentTab, setTab] = useState<string>('Overview');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Core Data
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('officer@demo.local');
  const [loginPassword, setLoginPassword] = useState('DemoPass123!');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  async function loadData() {
    try {
      const [u, m, a, al] = await Promise.all([
        api<User>('/auth/me'),
        api<DashboardMetrics>('/dashboard'),
        api<Application[]>('/applications'),
        api<AlertItem[]>('/alerts')
      ]);
      setUser(u);
      setMetrics(m);
      setApplications(a);
      setAlerts(al);
    } catch (err: any) {
      console.error('Data load error:', err);
      if (err.message && err.message.includes('401')) {
        handleSignOut();
      } else {
        setErrorMsg(err.message);
      }
    }
  }

  useEffect(() => {
    if (authToken) {
      loadData();
    }
  }, [authToken]);

  async function handleLogin(e?: React.FormEvent, customEmail?: string, customPass?: string) {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setErrorMsg('');
    try {
      const email = customEmail || loginEmail;
      const password = customPass || loginPassword;
      const res = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('ps4_token', res.access_token);
      setAuthToken(res.access_token);
      setToastMsg(`Signed in successfully as ${res.name} (${res.role}).`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed.');
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleSignOut() {
    localStorage.removeItem('ps4_token');
    setAuthToken('');
    setUser(null);
    setMetrics(null);
    setApplications([]);
    setAlerts([]);
  }

  async function handleSwitchRole(targetEmail: string) {
    await handleLogin(undefined, targetEmail, 'DemoPass123!');
  }

  async function handleRunEscalation() {
    setIsScanning(true);
    setErrorMsg('');
    try {
      const result = await api('/escalation/run-check', { method: 'POST' });
      setToastMsg(
        `Deadline evaluation complete: ${result.created_alerts} new alerts triggered, ${result.updated_records} records updated.`
      );
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsScanning(false);
    }
  }

  // --- Render Login View ---
  if (!authToken) {
    return (
      <main className="login-wrap">
        <div className="login-card">
          <div className="login-emblem">
            <ShieldCheck size={32} />
          </div>

          <div className="login-header">
            <small style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.12em' }}>
              SIH PROTOTYPE · PROBLEM STATEMENT 4
            </small>
            <h1>AICTE Approval Workflow Hub</h1>
            <p>
              Automated scrutiny transitions, EVC scheduling, AI document review, and real-time compliance monitoring.
            </p>
          </div>

          {errorMsg && <div className="alert-banner danger">{errorMsg}</div>}

          <form onSubmit={(e) => handleLogin(e)}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Official Email</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="e.g. officer@demo.local"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 18 }}>
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              disabled={isLoggingIn}
            >
              <span>{isLoggingIn ? 'Authenticating...' : 'Sign in to Portal'}</span>
              <ArrowRight size={15} />
            </button>
          </form>

          {/* Quick Demo Logins Box */}
          <div className="demo-account-box">
            <b>1-Click Demo Evaluation Accounts (Password: DemoPass123!)</b>
            <div className="demo-account-buttons">
              <button
                type="button"
                className="btn-demo-pill"
                onClick={() => {
                  setLoginEmail('officer@demo.local');
                  handleLogin(undefined, 'officer@demo.local', 'DemoPass123!');
                }}
              >
                1. Regional Officer
              </button>
              <button
                type="button"
                className="btn-demo-pill"
                onClick={() => {
                  setLoginEmail('college@demo.local');
                  handleLogin(undefined, 'college@demo.local', 'DemoPass123!');
                }}
              >
                2. College Applicant
              </button>
              <button
                type="button"
                className="btn-demo-pill"
                onClick={() => {
                  setLoginEmail('bureau@demo.local');
                  handleLogin(undefined, 'bureau@demo.local', 'DemoPass123!');
                }}
              >
                3. Bureau Head (HQ)
              </button>
              <button
                type="button"
                className="btn-demo-pill"
                onClick={() => {
                  setLoginEmail('evc@demo.local');
                  handleLogin(undefined, 'evc@demo.local', 'DemoPass123!');
                }}
              >
                4. EVC Panel Expert
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Unread alerts count for sidebar badge
  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="shell">
      {/* Persistent Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setTab={setTab}
        user={user}
        unreadAlertsCount={unreadCount}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Header
          currentTab={currentTab}
          user={user}
          onRefresh={loadData}
          onRunEscalation={handleRunEscalation}
          onSwitchRole={handleSwitchRole}
          isScanning={isScanning}
        />

        {/* Global Feedback Banners */}
        {errorMsg && (
          <div className="page-container" style={{ paddingBottom: 0 }}>
            <div className="alert-banner danger">
              <span>{errorMsg}</span>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer', fontWeight: 800 }}
                onClick={() => setErrorMsg('')}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {toastMsg && (
          <div className="page-container" style={{ paddingBottom: 0 }}>
            <div className="alert-banner info">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} />
                <span>{toastMsg}</span>
              </div>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer', fontWeight: 800 }}
                onClick={() => setToastMsg('')}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Active View Routing */}
        {currentTab === 'Overview' && (
          <OverviewTab metrics={metrics} user={user} onNavigate={setTab} />
        )}

        {currentTab === 'Applications' && (
          <ApplicationsTab
            applications={applications}
            user={user}
            onSelectApplication={(app) => setSelectedApp(app)}
            onRefresh={loadData}
          />
        )}

        {currentTab === 'AI Assistant' && (
          <DocumentReviewTab user={user} />
        )}

        {currentTab === 'EVC Inspections' && (
          <EvcTab user={user} applications={applications} onRefresh={loadData} />
        )}

        {currentTab === 'Compliance' && (
          <ComplianceTab user={user} onRefresh={loadData} />
        )}

        {currentTab === 'Alerts' && (
          <AlertsTab
            alerts={alerts}
            user={user}
            onRefresh={loadData}
            onRunEscalation={handleRunEscalation}
            isScanning={isScanning}
          />
        )}

        {currentTab === 'Reports' && (
          <ReportsTab metrics={metrics} user={user} />
        )}

        {currentTab === 'Role Matrix' && (
          <RoleMatrixTab onSwitchRole={handleSwitchRole} />
        )}

        {/* Application Details & Workflow Timeline Modal */}
        {selectedApp && (
          <ApplicationDetailModal
            application={selectedApp}
            user={user}
            onClose={() => setSelectedApp(null)}
            onRefresh={loadData}
          />
        )}
      </div>
    </div>
  );
}
