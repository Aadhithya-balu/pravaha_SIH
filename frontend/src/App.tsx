import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
  Info,
  Shield,
  Building2,
  Menu,
  X,
  Compass
} from 'lucide-react';
import { api, token, fetchApplications, fetchNotifications, showToast, ToastItem, registerInstitution } from './api';
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
import { PlatformGuideModal } from './components/PlatformGuideModal';
import { CommandPalette } from './components/CommandPalette';

export default function App() {
  const [authToken, setAuthToken] = useState<string>(token());
  const [user, setUser] = useState<User | null>(null);
  const [currentTab, setTab] = useState<string>('Overview');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [appStageFilter, setAppStageFilter] = useState<string>('ALL');
  const [appStatusFilter, setAppStatusFilter] = useState<string>('ALL');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);

  // Global Keyboard Shortcuts (Ctrl+K for Quick Search, ? for Guide)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
      if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsGuideOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleNavigateWithFilter(tab: string, stageFilter: string = 'ALL', statusFilter: string = 'ALL') {
    setAppStageFilter(stageFilter);
    setAppStatusFilter(statusFilter);
    setTab(tab);
    setMobileDrawerOpen(false);
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

  // Authentication Mode: Login vs Official Institutional Registration
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Registration Fields
  const [regInstName, setRegInstName] = useState('');
  const [regContactName, setRegContactName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRegion, setRegRegion] = useState('Northern');
  const [regState, setRegState] = useState('Delhi');
  const [regCity, setRegCity] = useState('New Delhi');
  const [regInstType, setRegInstType] = useState('Engineering & Technology');
  const [regInstCode, setRegInstCode] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regTerms, setRegTerms] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    if (!regTerms) {
      setErrorMsg('You must attest to the official AICTE statutory declaration before proceeding.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter identical passwords.');
      return;
    }
    if (regPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters in length.');
      return;
    }
    setIsRegistering(true);
    try {
      const data = await registerInstitution({
        institution_name: regInstName,
        contact_name: regContactName,
        email: regEmail,
        phone: regPhone,
        region: regRegion,
        state: regState,
        city: regCity,
        institution_type: regInstType,
        institution_code: regInstCode || undefined,
        password: regPassword
      });
      localStorage.setItem('ps4_token', data.access_token);
      setAuthToken(data.access_token);
      setLoginEmail(regEmail.trim().toLowerCase());
      showToast('Registration successful! Welcome to the PRAVAHA Institutional Portal.', 'success');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please review your entries.');
      showToast(err.message || 'Registration failed.', 'error');
    } finally {
      setIsRegistering(false);
    }
  }

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
        setErrorMsg(err.message || 'Failed to retrieve operational data.');
      }
    }
  }

  useEffect(() => {
    function onAuthExpired() {
      handleSignOut();
      setErrorMsg('Your session has expired or the access token was invalid. Please sign in below.');
      showToast('Session expired. Please sign in again.', 'warning');
    }
    function onAppToast(e: any) {
      const detail = e.detail;
      if (!detail) return;
      const newToast: ToastItem = {
        id: detail.id || Math.random().toString(36).substring(2, 9),
        message: detail.message || 'Operation completed.',
        type: detail.type || 'success'
      };
      setToasts((prev) => [...prev.slice(-4), newToast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 4500);
    }

    window.addEventListener('auth:expired', onAuthExpired);
    window.addEventListener('app:toast', onAppToast);
    return () => {
      window.removeEventListener('auth:expired', onAuthExpired);
      window.removeEventListener('app:toast', onAppToast);
    };
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
      const email = (customEmail || loginEmail).trim().toLowerCase();
      const password = customPass || loginPassword;
      const res = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('ps4_token', res.access_token);
      setAuthToken(res.access_token);
      showToast(`Authenticated as ${res.name} (${res.role.toUpperCase()}).`, 'success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check credentials.');
      showToast(err.message || 'Authentication failed.', 'error');
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
    showToast('Signed out of regulatory portal.', 'info');
  }

  async function handleSwitchRole(targetEmail: string) {
    await handleLogin(undefined, targetEmail, 'DemoPass123!');
  }

  async function handleRunEscalation() {
    setIsScanning(true);
    setErrorMsg('');
    try {
      const result = await api('/escalation/run-check', { method: 'POST' });
      showToast(
        `Regulatory scan complete: ${result.created_alerts} alert(s) triggered, ${result.updated_records} record(s) escalated.`,
        'success'
      );
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Deadline scan failed.');
      showToast(err.message || 'Deadline scan failed.', 'error');
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
            <h1>PRAVAHA</h1>
            <p>
              AICTE Approval Workflow Automation, Compliance Monitoring, and AI Scrutiny System
            </p>
          </div>

          {errorMsg && <div className="alert-banner danger">{errorMsg}</div>}

          {authMode === 'login' ? (
            <>
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
                      autoComplete="email"
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
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '12px 14px', minHeight: 44 }}
                  disabled={isLoggingIn}
                >
                  <span>{isLoggingIn ? 'Authenticating with Secure Session...' : 'Sign in to Regulatory Portal'}</span>
                  <ArrowRight size={14} />
                </button>
              </form>

              {/* Link to Registration */}
              <div style={{ textAlign: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: 12.5, color: '#64748B' }}>New Technical Institution? </span>
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setErrorMsg(''); }}
                  style={{ background: 'transparent', border: 'none', color: '#2563EB', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Register Institutional Account →
                </button>
              </div>

              {/* Evaluation Quick-Fill for Reviewers */}
              <div className="demo-account-box" style={{ marginTop: 16 }}>
                <b>Evaluation Quick-Fill (Password: DemoPass123!)</b>
                <div className="demo-account-buttons-3col">
                  <button
                    type="button"
                    className="btn-demo-pill-clean"
                    onClick={() => {
                      setLoginEmail('college@demo.local');
                      handleLogin(undefined, 'college@demo.local', 'DemoPass123!');
                    }}
                  >
                    <div className="demo-pill-title">🏢 1. Applicant</div>
                    <div className="demo-pill-desc">college@demo.local</div>
                  </button>
                  <button
                    type="button"
                    className="btn-demo-pill-clean"
                    onClick={() => {
                      setLoginEmail('officer@demo.local');
                      handleLogin(undefined, 'officer@demo.local', 'DemoPass123!');
                    }}
                  >
                    <div className="demo-pill-title">⚖️ 2. Scrutiny Officer</div>
                    <div className="demo-pill-desc">officer@demo.local</div>
                  </button>
                  <button
                    type="button"
                    className="btn-demo-pill-clean"
                    onClick={() => {
                      setLoginEmail('evc@demo.local');
                      handleLogin(undefined, 'evc@demo.local', 'DemoPass123!');
                    }}
                  >
                    <div className="demo-pill-title">🔍 3. EVC Inspector</div>
                    <div className="demo-pill-desc">evc@demo.local</div>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Institutional Registration Form */
            <form onSubmit={handleRegister}>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#1E40AF' }}>
                <b>Official Institutional Registration</b>: Register your technical college or polytechnic to submit Extension of Approval (EoA) or New Programme dossiers.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
                <div className="form-group">
                  <label style={{ fontSize: 11.5 }}>Institution Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={regInstName}
                    onChange={(e) => setRegInstName(e.target.value)}
                    placeholder="e.g. Sunrise Institute of Technology"
                    style={{ fontSize: 12.5 }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 11.5 }}>Institution Discipline / Type *</label>
                  <select
                    value={regInstType}
                    onChange={(e) => setRegInstType(e.target.value)}
                    style={{ fontSize: 12.5 }}
                  >
                    <option value="Engineering & Technology">Engineering & Technology</option>
                    <option value="Management (MBA/PGDM)">Management (MBA/PGDM)</option>
                    <option value="Pharmacy">Pharmacy</option>
                    <option value="MCA / Computer Applications">MCA / Computer Applications</option>
                    <option value="Polytechnic Diploma">Polytechnic Diploma</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 10 }}>
                <div className="form-group">
                  <label style={{ fontSize: 11.5 }}>AICTE Region *</label>
                  <select
                    value={regRegion}
                    onChange={(e) => setRegRegion(e.target.value)}
                    style={{ fontSize: 12.5 }}
                  >
                    <option value="Northern">Northern</option>
                    <option value="Western">Western</option>
                    <option value="Southern">Southern</option>
                    <option value="Eastern">Eastern</option>
                    <option value="Central">Central</option>
                    <option value="South-Western">South-Western</option>
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 11.5 }}>State / UT *</label>
                  <input
                    type="text"
                    required
                    value={regState}
                    onChange={(e) => setRegState(e.target.value)}
                    placeholder="e.g. Maharashtra"
                    style={{ fontSize: 12.5 }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 11.5 }}>City / District *</label>
                  <input
                    type="text"
                    required
                    value={regCity}
                    onChange={(e) => setRegCity(e.target.value)}
                    placeholder="e.g. Pune"
                    style={{ fontSize: 12.5 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
                <div className="form-group">
                  <label style={{ fontSize: 11.5 }}>Authorized Signatory Name *</label>
                  <input
                    type="text"
                    required
                    value={regContactName}
                    onChange={(e) => setRegContactName(e.target.value)}
                    placeholder="e.g. Prof. Anand Deshmukh"
                    style={{ fontSize: 12.5 }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 11.5 }}>Official Institution Email *</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="e.g. principal@sunrise.edu"
                    style={{ fontSize: 12.5 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
                <div className="form-group">
                  <label style={{ fontSize: 11.5 }}>Mobile Contact Number *</label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91-9876543210"
                    style={{ fontSize: 12.5 }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 11.5 }}>AICTE Permanent Institute ID</label>
                  <input
                    type="text"
                    value={regInstCode}
                    onChange={(e) => setRegInstCode(e.target.value)}
                    placeholder="e.g. 1-8401920 (optional if new)"
                    style={{ fontSize: 12.5 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
                <div className="form-group">
                  <label style={{ fontSize: 11.5 }}>Portal Security Password *</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    style={{ fontSize: 12.5 }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 11.5 }}>Confirm Password *</label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    style={{ fontSize: 12.5 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
                <input
                  type="checkbox"
                  id="regTerms"
                  checked={regTerms}
                  onChange={(e) => setRegTerms(e.target.checked)}
                  style={{ marginTop: 3 }}
                  required
                />
                <label htmlFor="regTerms" style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.4 }}>
                  I solemnly declare that I am the authorized representative of the institution and that all details provided comply with AICTE Approval Process Handbook statutory norms.
                </label>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '11px 14px' }}
                disabled={isRegistering}
              >
                <span>{isRegistering ? 'Registering Institution...' : 'Complete Registration & Access Portal'}</span>
                <ArrowRight size={14} />
              </button>

              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setErrorMsg(''); }}
                  style={{ background: 'transparent', border: 'none', color: '#2563EB', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  ← Already registered? Return to Official Login
                </button>
              </div>
            </form>
          )}
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

      {/* Persistent Left Sidebar with Mobile Drawer support */}
      <Sidebar
        currentTab={currentTab}
        setTab={(t) => {
          setTab(t);
          setMobileDrawerOpen(false);
        }}
        user={user}
        unreadAlertsCount={unreadCount}
        onSignOut={handleSignOut}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileDrawerOpen}
        onCloseMobile={() => setMobileDrawerOpen(false)}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content Area */}
      <div className="main-content">
        <Header
          currentTab={currentTab}
          user={user}
          onRefresh={loadData}
          onRunEscalation={handleRunEscalation}
          onSwitchRole={handleSwitchRole}
          isScanning={isScanning}
          onNavigateTab={(t) => {
            setTab(t);
            setMobileDrawerOpen(false);
          }}
          unreadCount={unreadCount}
          onToggleMobileMenu={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          onOpenGuide={() => setIsGuideOpen(true)}
          onOpenCommandPalette={() => setIsPaletteOpen(true)}
        />

        {/* Scrollable Viewport - Pinned Navbar Remains Fixed Above */}
        <div className="main-scrollable-body">
        {/* Floating Toast Notification Stack (Phase 6) */}
        <div className="toast-container" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast-card toast-${t.type}`}>
              <div className="toast-icon">
                {t.type === 'success' && <CheckCircle2 size={16} color="#16845B" />}
                {t.type === 'error' && <AlertTriangle size={16} color="#D64545" />}
                {t.type === 'warning' && <AlertTriangle size={16} color="#D98B16" />}
                {t.type === 'info' && <Info size={16} color="#2864E8" />}
              </div>
              <span className="toast-message">{t.message}</span>
              <button
                type="button"
                className="toast-close"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                aria-label="Close notification"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Global Feedback Banner */}
        {errorMsg && (
          <div className="page-container" style={{ paddingBottom: 0 }}>
            <div className="alert-banner danger">
              <span>{errorMsg}</span>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer', fontWeight: 800 }}
                onClick={() => setErrorMsg('')}
                aria-label="Dismiss alert"
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
            onOpenGuide={() => setIsGuideOpen(true)}
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

        {(currentTab === 'Document Scrutiny' || currentTab === 'AI Assistant') && (
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
        </div>

        {/* Platform Guide & Interactive User Manual Modal */}
        <PlatformGuideModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
          onNavigateTab={(tab) => {
            setTab(tab);
            setMobileDrawerOpen(false);
          }}
          onSwitchRole={handleSwitchRole}
          currentUserRole={user?.role}
        />

        {/* Global Quick Search & Command Palette (Ctrl + K) */}
        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          applications={applications}
          onNavigateTab={(tab) => {
            setTab(tab);
            setMobileDrawerOpen(false);
          }}
          onSelectApplication={(app) => setSelectedApp(app)}
          onSwitchRole={handleSwitchRole}
          onOpenGuide={() => setIsGuideOpen(true)}
          onRunEscalation={handleRunEscalation}
        />

        {/* Floating Quick Guide Button */}
        <button
          type="button"
          onClick={() => setIsGuideOpen(true)}
          className="floating-help-btn"
          title="Open Platform Guide and User Instructions (or press ?)"
          style={{
            position: 'fixed',
            bottom: 22,
            right: 22,
            zIndex: 990,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '9px 16px',
            borderRadius: 30,
            background: '#1E3A8A',
            color: '#FFFFFF',
            border: '1.5px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 4px 14px rgba(30, 58, 138, 0.35)',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <Compass size={16} color="#93C5FD" />
          <span>How to Use</span>
        </button>

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
