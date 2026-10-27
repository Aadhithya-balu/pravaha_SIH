import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Mail,
  ArrowRight,
  Info
} from 'lucide-react';
import { api, token, fetchApplications, fetchNotifications } from './api';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [appStageFilter, setAppStageFilter] = useState<string>('ALL');
  const [appStatusFilter, setAppStatusFilter] = useState<string>('ALL');

  function handleNavigateWithFilter(tab: string, stageFilter: string = 'ALL', statusFilter: string = 'ALL') {
    setAppStageFilter(stageFilter);
    setAppStatusFilter(statusFilter);
    setTab(tab);
  }

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
        fetchApplications(),
        fetchNotifications()
      ]);
      setUser(u);
      setMetrics(m);
      setApplications(a);
      setAlerts(al);
    } catch (err: any) {
      console.error('Data load error:', err);
      const isAuthErr =
        err?.status === 401 ||
        err?.message?.includes('401') ||
        err?.message?.toLowerCase().includes('token') ||
        err?.message?.toLowerCase().includes('unauthorized') ||
        err?.message?.toLowerCase().includes('authentication required');

      if (isAuthErr) {
        handleSignOut();
        setErrorMsg('Your session has expired or the access token was invalid. Please sign in below.');
      } else {
        setErrorMsg(err.message || 'Failed to load platform data.');
      }
    }
  }

  useEffect(() => {
    function onAuthExpired() {
      handleSignOut();
      setErrorMsg('Your session has expired or the access token was invalid. Please sign in below.');
    }
    window.addEventListener('auth:expired', onAuthExpired);
    return () => window.removeEventListener('auth:expired', onAuthExpired);
  }, []);

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
        <div className="gov-tricolor-bar" />
        <div className="login-card">
          {/* Official Agency Emblem Header */}
          <div className="login-header-emblem">
            <div className="login-emblem-badge">
              <ShieldCheck size={26} />
            </div>
            <div className="login-header-emblem-text">
              <h4>Government of India</h4>
              <span>All India Council for Technical Education</span>
            </div>
          </div>

          <div className="login-title-block">
            <h1>Pravaha Regulatory Hub</h1>
            <p>
              Integrated Approval Workflow Automation, Compliance Monitoring, and Alert Management System (SIH26262)
            </p>
          </div>

          {/* Prototype Demonstration Disclaimer */}
          <div className="prototype-notice-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={14} style={{ flexShrink: 0 }} />
              <span>
                <b>SIH Evaluation Prototype:</b> Official testbed demonstration for Smart India Hackathon jury review.
              </span>
            </div>
          </div>

          {errorMsg && <div className="alert-banner danger">{errorMsg}</div>}

          <form onSubmit={(e) => handleLogin(e)}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Official Institutional / Officer Email *</label>
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

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Security Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your security password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 14px' }}
              disabled={isLoggingIn}
            >
              <span>{isLoggingIn ? 'Authenticating with Secure Session...' : 'Sign in to Regulatory Portal'}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          {/* 1-Click Demo Evaluation Personas */}
          <div className="demo-account-box">
            <b>Evaluation Personas (Common Password: DemoPass123!)</b>
            <div className="demo-account-buttons">
              <button
                type="button"
                className="btn-demo-pill"
                onClick={() => {
                  setLoginEmail('officer@demo.local');
                  handleLogin(undefined, 'officer@demo.local', 'DemoPass123!');
                }}
              >
                <b>1. Regional Officer</b>
                <span>Regional Scrutiny Officer</span>
              </button>
              <button
                type="button"
                className="btn-demo-pill"
                onClick={() => {
                  setLoginEmail('college@demo.local');
                  handleLogin(undefined, 'college@demo.local', 'DemoPass123!');
                }}
              >
                <b>2. College Applicant</b>
                <span>Sri Sairam Institute</span>
              </button>
              <button
                type="button"
                className="btn-demo-pill"
                onClick={() => {
                  setLoginEmail('bureau@demo.local');
                  handleLogin(undefined, 'bureau@demo.local', 'DemoPass123!');
                }}
              >
                <b>3. Bureau Head (HQ)</b>
                <span>Director (Approval Bureau)</span>
              </button>
              <button
                type="button"
                className="btn-demo-pill"
                onClick={() => {
                  setLoginEmail('evc@demo.local');
                  handleLogin(undefined, 'evc@demo.local', 'DemoPass123!');
                }}
              >
                <b>4. EVC Panel Expert</b>
                <span>Senior Committee Inspector</span>
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
      {/* National Tricolor Top Ribbon */}
      <div className="gov-tricolor-bar" />

      {/* Persistent Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setTab={setTab}
        user={user}
        unreadAlertsCount={unreadCount}
        onSignOut={handleSignOut}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
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
          onNavigateTab={setTab}
          unreadCount={unreadCount}
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
          <OverviewTab
            metrics={metrics}
            user={user}
            applications={applications}
            alerts={alerts}
            onNavigate={setTab}
            onNavigateWithFilter={handleNavigateWithFilter}
            onSelectApplication={(app) => setSelectedApp(app)}
            onRefresh={loadData}
          />
        )}

        {currentTab === 'Applications' && (
          <ApplicationsTab
            applications={applications}
            user={user}
            onSelectApplication={(app) => setSelectedApp(app)}
            onRefresh={loadData}
            initialStageFilter={appStageFilter}
            initialStatusFilter={appStatusFilter}
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
