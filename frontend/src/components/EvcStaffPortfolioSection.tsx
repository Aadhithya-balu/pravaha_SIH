import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  MapPin,
  Clock,
  UserCheck,
  ShieldAlert,
  Send,
  Info,
  X
} from 'lucide-react';
import { EVCVisit, User } from '../types';
import { respondToEvcAssignment, updateEvcStaffAvailability } from '../api';

interface EvcStaffPortfolioSectionProps {
  user: User | null;
  visits: EVCVisit[];
  onRefresh: () => void;
}

export const EvcStaffPortfolioSection: React.FC<EvcStaffPortfolioSectionProps> = ({
  user,
  visits,
  onRefresh
}) => {
  const [currentAvailability, setCurrentAvailability] = useState(
    user?.availability_status || 'AVAILABLE'
  );
  const [isUpdatingAvail, setIsUpdatingAvail] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Decline Modal State
  const [declineModalVisit, setDeclineModalVisit] = useState<EVCVisit | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [isDeclining, setIsDeclining] = useState(false);

  // Self availability toggle handler
  async function handleUpdateAvailability(newStatus: string) {
    setIsUpdatingAvail(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await updateEvcStaffAvailability(newStatus);
      setCurrentAvailability(newStatus);
      setSuccessMsg(`Availability updated to ${newStatus}. AI allocation roster synchronized.`);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update availability status.');
    } finally {
      setIsUpdatingAvail(false);
    }
  }

  // Accept Handler
  async function handleAccept(v: EVCVisit) {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await respondToEvcAssignment(v.id, 'ACCEPT');
      setSuccessMsg(`Assignment accepted for ${v.institution_name}. Inspection marked as SCHEDULED.`);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to accept assignment.');
    }
  }

  // Open Decline Modal
  function handleOpenDecline(v: EVCVisit) {
    setDeclineModalVisit(v);
    setDeclineReason('');
    setErrorMsg('');
  }

  // Submit Decline
  async function submitDecline() {
    if (!declineModalVisit) return;
    if (!declineReason.trim() || declineReason.trim().length < 5) {
      setErrorMsg('Mandatory justification required: Please provide a substantive reason (minimum 5 characters).');
      return;
    }
    setIsDeclining(true);
    setErrorMsg('');
    try {
      await respondToEvcAssignment(declineModalVisit.id, 'DECLINE', declineReason.trim());
      setSuccessMsg(`Assignment declined. Case returned to Regional Officer allocation queue.`);
      setDeclineModalVisit(null);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to decline assignment.');
    } finally {
      setIsDeclining(false);
    }
  }

  // Filter pending assignments for this staff member
  const pendingAssignments = visits.filter(
    (v) => v.assignment_status === 'ASSIGNMENT_PENDING'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. SELF-SERVICE AVAILABILITY BAR */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 10,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background:
              currentAvailability === 'AVAILABLE' ? '#DCFCE7' :
              currentAvailability === 'BUSY' ? '#FEF3C7' : '#FEE2E2',
            color:
              currentAvailability === 'AVAILABLE' ? '#166534' :
              currentAvailability === 'BUSY' ? '#92400E' : '#991B1B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <UserCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
              EVC Expert Roster & Live Availability Status
            </div>
            <div style={{ fontSize: 12, color: '#64748B' }}>
              Your availability status is checked live by Regional Officers and the AI Auto-Allocation Engine
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
            Current Status:
          </span>
          <select
            value={currentAvailability}
            onChange={(e) => handleUpdateAvailability(e.target.value)}
            disabled={isUpdatingAvail}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              fontSize: 12.5,
              fontWeight: 700,
              background:
                currentAvailability === 'AVAILABLE' ? '#F0FDF4' :
                currentAvailability === 'BUSY' ? '#FFFBEB' : '#FEF2F2',
              color:
                currentAvailability === 'AVAILABLE' ? '#15803D' :
                currentAvailability === 'BUSY' ? '#B45309' : '#B91C1C',
              cursor: isUpdatingAvail ? 'not-allowed' : 'pointer'
            }}
          >
            <option value="AVAILABLE">AVAILABLE (Accepting Inspections)</option>
            <option value="BUSY">BUSY (Active Inspection Underway)</option>
            <option value="ON_LEAVE">ON_LEAVE (Not Available)</option>
            <option value="UNAVAILABLE">UNAVAILABLE (Paused)</option>
          </select>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {errorMsg && !declineModalVisit && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 6,
          background: '#FEF2F2',
          border: '1px solid #FCA5A5',
          color: '#B91C1C',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontWeight: 700 }}>×</button>
        </div>
      )}

      {successMsg && !declineModalVisit && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 6,
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#047857',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#047857', fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* 2. PENDING INSPECTION ASSIGNMENT CONFIRMATIONS (HIGH PRIORITY) */}
      {pendingAssignments.length > 0 && (
        <div style={{
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: 10,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 1px 3px rgba(217, 119, 6, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400E' }}>
            <AlertTriangle size={18} color="#D97706" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              Action Required: Pending EVC Inspection Assignment Confirmation ({pendingAssignments.length})
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: '#78350F' }}>
            You have been assigned to conduct physical/hybrid regulatory inspection(s). Please confirm your availability or decline with an official justification.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingAssignments.map((v) => (
              <div
                key={v.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #FCD34D',
                  borderRadius: 8,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: '#FEF3C7',
                      color: '#92400E',
                      border: '1px solid #FDE68A'
                    }}>
                      ASSIGNMENT_PENDING
                    </span>
                    <span style={{ fontSize: 11, color: '#64748B' }}>
                      Method: <b>{v.assignment_method || 'AI_AUTO'}</b> • Visit #{v.id}
                    </span>
                  </div>

                  <b style={{ fontSize: 14, color: '#0F172A', marginTop: 2 }}>
                    {v.institution_name}
                  </b>

                  <div style={{ fontSize: 12, color: '#475569' }}>
                    Scheduled Date: <b>{v.scheduled_date}</b> • Mode: <b>{v.visit_mode || 'PHYSICAL'}</b>
                  </div>

                  {v.assignment_reason && (
                    <div style={{
                      fontSize: 11.5,
                      color: '#1E3A8A',
                      background: '#EFF6FF',
                      padding: '6px 8px',
                      borderRadius: 4,
                      marginTop: 2
                    }}>
                      <b>Allocation Rationale:</b> {v.assignment_reason}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Accept Button */}
                  <button
                    type="button"
                    onClick={() => handleAccept(v)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '8px 16px',
                      borderRadius: 6,
                      background: '#16845B',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(22, 132, 91, 0.25)'
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Accept Assignment</span>
                  </button>

                  {/* Decline Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenDecline(v)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '8px 14px',
                      borderRadius: 6,
                      background: '#FFFFFF',
                      border: '1px solid #DC2626',
                      color: '#DC2626',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <XCircle size={14} />
                    <span>Decline Assignment</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: DECLINE INSPECTION JUSTIFICATION
          ==================================================================== */}
      {declineModalVisit && (
        <div className="modal-backdrop" onClick={() => !isDeclining && setDeclineModalVisit(null)}>
          <div
            className="modal-container"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#DC2626' }}>
                <XCircle size={18} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  Decline Inspection Assignment
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isDeclining && setDeclineModalVisit(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                padding: '10px 12px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 6,
                fontSize: 12,
                color: '#991B1B'
              }}>
                <strong>Regulatory Notice:</strong> Declining an assigned inspection requires an official, traceable justification. This justification will be logged in the permanent audit chain and transmitted to the Regional Officer for immediate reassignment.
              </div>

              <div>
                <span style={{ fontSize: 12, color: '#64748B' }}>Institution:</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                  {declineModalVisit.institution_name} (Visit #{declineModalVisit.id})
                </div>
                <div style={{ fontSize: 12, color: '#475569' }}>
                  Scheduled Date: {declineModalVisit.scheduled_date}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Mandatory Decline Reason (Minimum 5 characters) *
                </label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="e.g. Prior academic conflict; university semester examination duties on scheduled date."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #CBD5E1',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {errorMsg && (
                <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: 6, fontSize: 12 }}>
                  {errorMsg}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setDeclineModalVisit(null)}
                disabled={isDeclining}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDecline}
                disabled={isDeclining || declineReason.trim().length < 5}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '7px 16px',
                  borderRadius: 6,
                  background: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: isDeclining || declineReason.trim().length < 5 ? 'not-allowed' : 'pointer'
                }}
              >
                <Send size={13} />
                <span>{isDeclining ? 'Submitting...' : 'Confirm Decline'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

