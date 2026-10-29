import React, { useState } from 'react';
import {
  X,
  Compass,
  Sparkles,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Users,
  FileCheck2,
  Clock,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Building2,
  Scale,
  Search,
  Key,
  ShieldAlert
} from 'lucide-react';

interface PlatformGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  onSwitchRole: (email: string) => void;
  currentUserRole?: string;
}

export const PlatformGuideModal: React.FC<PlatformGuideModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onSwitchRole,
  currentUserRole
}) => {
  const [activeTab, setActiveTab] = useState<'quickstart' | 'roles' | 'lifecycle' | 'glossary' | 'shortcuts'>('quickstart');

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog"
        style={{
          maxWidth: 780,
          width: '94vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          background: '#FFFFFF'
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
            color: '#FFFFFF',
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Compass size={22} color="#FFFFFF" />
            </div>
            <div>
              <h3 id="guide-modal-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#FFFFFF' }}>
                PRAVAHA — Platform Guide & User Instructions
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#DBEAFE' }}>
                Intelligent Approval Workflow & Statutory Compliance Monitoring Platform
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 6,
              color: '#FFFFFF',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            aria-label="Close guide"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            padding: '0 16px',
            gap: 4,
            overflowX: 'auto'
          }}
        >
          {[
            { id: 'quickstart', label: '⚡ Quick Start Tour', icon: Sparkles },
            { id: 'roles', label: '👥 User Personas & Roles', icon: Users },
            { id: 'lifecycle', label: '🗺️ Approval Lifecycle', icon: CheckCircle2 },
            { id: 'glossary', label: '📖 Regulatory Glossary', icon: BookOpen },
            { id: 'shortcuts', label: '⌨️ Shortcuts & Navigation', icon: Key }
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '11px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2.5px solid ${isActive ? '#2563EB' : 'transparent'}`,
                  color: isActive ? '#2563EB' : '#64748B',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body with Scroll */}
        <div
          className="modal-body"
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            maxHeight: 'calc(90vh - 160px)',
            background: '#FFFFFF',
            fontSize: 13.5,
            color: '#1E293B',
            lineHeight: 1.6
          }}
        >
          {/* TAB 1: QUICK START TOUR */}
          {activeTab === 'quickstart' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div
                style={{
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: 8,
                  padding: '14px 16px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start'
                }}
              >
                <Lightbulb size={20} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <b style={{ color: '#1E40AF', fontSize: 13.5, display: 'block', marginBottom: 2 }}>
                    Welcome to PRAVAHA
                  </b>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#334155' }}>
                    PRAVAHA eliminates paperwork bottlenecks in AICTE technical education approvals. It automates 
                    document scrutiny with AI, coordinates Expert Visiting Committee (EVC) inspections, tracks SLA 
                    compliance, and locks decisions in a tamper-evident cryptographic audit chain.
                  </p>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                  Top 3 Demonstration Journeys for Evaluators
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Journey 1: AI Scrutiny */}
                  <div
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: 8,
                      padding: '14px 16px',
                      background: '#FAFCFF',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 14,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            background: '#EFF6FF',
                            color: '#2563EB',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4
                          }}
                        >
                          JOURNEY 1
                        </span>
                        <b style={{ fontSize: 13.5, color: '#1E293B' }}>AI Document Scrutiny & Rule Validation</b>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                        Select any institution dossier (e.g. Apex School or Sunrise Institute), review automated 
                        OCR clause extraction, verify minimum land & built-up area rules, and observe instant discrepancy detection.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateTab('Document Scrutiny');
                        onClose();
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#2563EB',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 14px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <span>Try AI Scrutiny</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Journey 2: EVC Inspections */}
                  <div
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: 8,
                      padding: '14px 16px',
                      background: '#FAFCFF',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 14,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            background: '#F0FDF4',
                            color: '#16845B',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4
                          }}
                        >
                          JOURNEY 2
                        </span>
                        <b style={{ fontSize: 13.5, color: '#1E293B' }}>EVC Inspection Scheduling & Calendar</b>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                        Browse scheduled physical/virtual campus inspections. Toggle between <b>List View</b> and 
                        <b>Calendar View</b>, inspect committee rosters, or record statutory inspection findings.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateTab('EVC Inspections');
                        onClose();
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#16845B',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 14px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <span>Open EVC Queue</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Journey 3: Compliance & Tamper-Proof Audit */}
                  <div
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: 8,
                      padding: '14px 16px',
                      background: '#FAFCFF',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 14,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            background: '#FEF3C7',
                            color: '#B45309',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4
                          }}
                        >
                          JOURNEY 3
                        </span>
                        <b style={{ fontSize: 13.5, color: '#1E293B' }}>Compliance Proofs & SHA-256 Audit Trail</b>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                        Inspect mandatory legal proofs (30-year lease deeds, Fire NOC, Occupancy certificates) 
                        and verify the tamper-evident cryptographic hash chain that seals every regulatory step.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateTab('Compliance');
                        onClose();
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#D97706',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 14px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <span>Check Compliance</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER PERSONAS & ROLES */}
          {activeTab === 'roles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                PRAVAHA implements Role-Based Access Control (RBAC). Use the buttons below or the top-right 
                <b> Persona Switcher</b> to instantly test how the platform behaves for each stakeholder.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {/* Persona 1: Applicant */}
                <div
                  style={{
                    border: `1.5px solid ${currentUserRole === 'institution' ? '#2563EB' : '#E2E8F0'}`,
                    borderRadius: 8,
                    padding: 14,
                    background: currentUserRole === 'institution' ? '#F8FAFF' : '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building2 size={16} color="#2563EB" />
                      </div>
                      <div>
                        <b style={{ fontSize: 13, color: '#1E293B', display: 'block' }}>1. Institution Applicant</b>
                        <span style={{ fontSize: 11, color: '#64748B' }}>college@demo.local</span>
                      </div>
                    </div>
                    <ul style={{ margin: '8px 0 12px 18px', padding: 0, fontSize: 11.5, color: '#475569' }}>
                      <li>Submit & track approval applications</li>
                      <li>View AI-flagged deficiencies</li>
                      <li>Upload revised compliance proofs</li>
                      <li>Download official Approval Letter (LoA)</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchRole('college@demo.local');
                      onClose();
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 6,
                      background: currentUserRole === 'institution' ? '#2563EB' : '#F1F5F9',
                      color: currentUserRole === 'institution' ? '#FFFFFF' : '#334155',
                      border: '1px solid #CBD5E1',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {currentUserRole === 'institution' ? '✓ Currently Active' : 'Switch to Applicant'}
                  </button>
                </div>

                {/* Persona 2: RO / Admin */}
                <div
                  style={{
                    border: `1.5px solid ${currentUserRole === 'officer' || currentUserRole === 'admin' ? '#2563EB' : '#E2E8F0'}`,
                    borderRadius: 8,
                    padding: 14,
                    background: currentUserRole === 'officer' || currentUserRole === 'admin' ? '#F8FAFF' : '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Scale size={16} color="#2563EB" />
                      </div>
                      <div>
                        <b style={{ fontSize: 13, color: '#1E293B', display: 'block' }}>2. Regional Officer / Admin</b>
                        <span style={{ fontSize: 11, color: '#64748B' }}>officer@demo.local</span>
                      </div>
                    </div>
                    <ul style={{ margin: '8px 0 12px 18px', padding: 0, fontSize: 11.5, color: '#475569' }}>
                      <li>Scrutinize institutional dossiers</li>
                      <li>Inspect AI discrepancy findings</li>
                      <li>Appoint & dispatch EVC panels</li>
                      <li>Scan statutory SLA deadlines</li>
                      <li>Issue final statutory decisions</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchRole('officer@demo.local');
                      onClose();
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 6,
                      background: currentUserRole === 'officer' || currentUserRole === 'admin' ? '#2563EB' : '#F1F5F9',
                      color: currentUserRole === 'officer' || currentUserRole === 'admin' ? '#FFFFFF' : '#334155',
                      border: '1px solid #CBD5E1',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {currentUserRole === 'officer' || currentUserRole === 'admin' ? '✓ Currently Active' : 'Switch to RO / Admin'}
                  </button>
                </div>

                {/* Persona 3: EVC Expert */}
                <div
                  style={{
                    border: `1.5px solid ${currentUserRole === 'evc_expert' ? '#2563EB' : '#E2E8F0'}`,
                    borderRadius: 8,
                    padding: 14,
                    background: currentUserRole === 'evc_expert' ? '#F8FAFF' : '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Calendar size={16} color="#16845B" />
                      </div>
                      <div>
                        <b style={{ fontSize: 13, color: '#1E293B', display: 'block' }}>3. EVC Expert Inspector</b>
                        <span style={{ fontSize: 11, color: '#64748B' }}>evc@demo.local</span>
                      </div>
                    </div>
                    <ul style={{ margin: '8px 0 12px 18px', padding: 0, fontSize: 11.5, color: '#475569' }}>
                      <li>Access assigned technical colleges</li>
                      <li>Conduct on-site physical/virtual visits</li>
                      <li>Record committee findings & ratings</li>
                      <li>Submit formal statutory recommendations</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchRole('evc@demo.local');
                      onClose();
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 6,
                      background: currentUserRole === 'evc_expert' ? '#16845B' : '#F1F5F9',
                      color: currentUserRole === 'evc_expert' ? '#FFFFFF' : '#334155',
                      border: '1px solid #CBD5E1',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {currentUserRole === 'evc_expert' ? '✓ Currently Active' : 'Switch to EVC Expert'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: APPROVAL LIFECYCLE MAP */}
          {activeTab === 'lifecycle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                Every AICTE application moves through strict statutory stages. Below is the automated pipeline:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  {
                    step: '1',
                    title: 'Dossier Submission',
                    desc: 'Institution submits online approval dossier including land documents, building blueprints, faculty lists, and statutory fee receipts.',
                    badge: 'APPLICANT'
                  },
                  {
                    step: '2',
                    title: 'AI Scrutiny & Rule Verification',
                    desc: 'AI Engine extracts clauses from PDFs via OCR, checks land area against AICTE Approval Handbook rules, and flags any shortage or expired NOCs.',
                    badge: 'AUTOMATED AI'
                  },
                  {
                    step: '3',
                    title: 'Clarification / Deficiency Resolution',
                    desc: 'If discrepancies are flagged, application is returned to college for clarification. College uploads revised proof within statutory deadline.',
                    badge: 'OFFICER / COLLEGE'
                  },
                  {
                    step: '4',
                    title: 'Expert Visit Committee (EVC) Inspection',
                    desc: 'A 3-member panel of senior professors conducts physical or virtual inspection to verify campus classrooms, labs, library, and safety equipment.',
                    badge: 'EVC EXPERT'
                  },
                  {
                    step: '5',
                    title: 'Final Council Review & Letter Issuance (LoA)',
                    desc: 'Regional Committee reviews inspection report and issues final approval. Cryptographic SHA-256 seal guarantees decision authenticity.',
                    badge: 'COUNCIL'
                  }
                ].map((s) => (
                  <div
                    key={s.step}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '12px 14px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 8
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: '#2563EB',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 12,
                        flexShrink: 0
                      }}
                    >
                      {s.step}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <b style={{ fontSize: 13, color: '#0F172A' }}>{s.title}</b>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: '#E0E7FF',
                            color: '#3730A3'
                          }}
                        >
                          {s.badge}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: REGULATORY GLOSSARY */}
          {activeTab === 'glossary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                Key regulatory and technical terms used throughout the PRAVAHA platform:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                {[
                  {
                    term: 'AICTE',
                    meaning: 'All India Council for Technical Education — the statutory body and national-level council for technical education under the Department of Higher Education.'
                  },
                  {
                    term: 'EVC (Expert Visit Committee)',
                    meaning: 'An independent inspection panel comprised of university professors and regional nominees appointed to physically verify campus infrastructure, labs, and faculty qualifications.'
                  },
                  {
                    term: 'SLA (Service Level Agreement)',
                    meaning: 'Statutory citizen charter time limits (e.g. 15 days for scrutiny, 21 days for EVC). PRAVAHA automatically monitors these deadlines and escalates overdue cases.'
                  },
                  {
                    term: 'LoA / LoI',
                    meaning: 'Letter of Approval (final official sanction allowing the institution to admit students) or Letter of Intent (in-principle preliminary clearance).'
                  },
                  {
                    term: 'FSR (Faculty Student Ratio)',
                    meaning: 'Mandatory statutory ratio of qualified teaching staff to enrolled students (typically 1:15 or 1:20 for undergraduate engineering programs).'
                  },
                  {
                    term: 'Tamper-Evident SHA-256 Audit Chain',
                    meaning: 'Cryptographic mechanism that hashes every state change, document upload, and regulatory decision with the previous entry hash, mathematically preventing retroactive alterations.'
                  }
                ].map((g, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: 6,
                      padding: '10px 14px'
                    }}
                  >
                    <b style={{ fontSize: 13, color: '#1E40AF', display: 'block', marginBottom: 2 }}>{g.term}</b>
                    <span style={{ fontSize: 12, color: '#475569' }}>{g.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: KEYBOARD SHORTCUTS & NAVIGATION */}
          {activeTab === 'shortcuts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                Quick navigation tricks to move around PRAVAHA effortlessly:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'Ctrl + K  /  Cmd + K', desc: 'Open Global Quick Search & Command Palette (jump to any tab, search application, or switch persona)' },
                  { key: 'Esc', desc: 'Close any open modal, dialog, or drawer immediately' },
                  { key: 'Persona Bar', desc: 'Click "Applicant", "RO / Admin", or "EVC Expert" in the top header anytime to switch user perspective' },
                  { key: 'Breadcrumb Link', desc: 'Click "AICTE PRAVAHA" or the "Back to Dashboard" button in the header to return to the Command Centre' },
                  { key: 'Scan Deadlines', desc: 'Click the "Scan Deadlines" button in the header (as RO/Admin) to test automatic SLA countdown and escalation alerts' }
                ].map((sc, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 6
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: '#334155' }}>{sc.desc}</span>
                    <kbd
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#0F172A',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        whiteSpace: 'nowrap',
                        marginLeft: 12
                      }}
                    >
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '12px 24px',
            background: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span style={{ fontSize: 11.5, color: '#64748B' }}>
            Tip: Press <kbd style={{ background: '#E2E8F0', padding: '1px 5px', borderRadius: 3 }}>Ctrl + K</kbd> anywhere for Quick Search
          </span>
          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
            style={{ padding: '7px 18px', fontSize: 12.5 }}
          >
            Got it, Let's Explore!
          </button>
        </div>
      </div>
    </div>
  );
};
