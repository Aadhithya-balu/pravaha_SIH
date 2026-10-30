import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileCheck2,
  Trash2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Building2,
  Clock,
  Compass,
  FileText,
  Copy,
  Check,
  Eye,
  Info,
  RotateCcw,
  FlipHorizontal,
  Download,
  Maximize2
} from 'lucide-react';
import { User, EVCVisit, InspectionEvidence, EVCVisitProofDossier } from '../types';
import {
  fetchVisitProofDossier,
  uploadEvcPhotoEvidence,
  analyzeEvcEvidence,
  captureEvcLocation,
  submitEvcVisitProof,
  verifyEvcVisitProof,
  deleteEvcEvidence,
  getEvidenceImageUrl
} from '../api';

interface EvcVisitProofModalProps {
  visitId: number;
  user: User | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export const EVIDENCE_CATEGORIES = [
  { value: 'ENTRANCE_SIGNBOARD', label: '1. Institution Main Entrance / Signboard' },
  { value: 'CAMPUS_BUILDINGS', label: '2. Campus Buildings' },
  { value: 'CLASSROOMS', label: '3. Classrooms' },
  { value: 'LABORATORIES_WORKSHOPS', label: '4. Laboratories / Workshops' },
  { value: 'LIBRARY', label: '5. Library' },
  { value: 'OTHER_FACILITIES', label: '6. Other Institutional Facilities' },
];

export const EvcVisitProofModal: React.FC<EvcVisitProofModalProps> = ({
  visitId,
  user,
  onClose,
  onUpdated
}) => {
  const [dossier, setDossier] = useState<EVCVisitProofDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Upload & File Picker state
  const [selectedCategory, setSelectedCategory] = useState('CAMPUS_BUILDINGS');
  const [photoRemarks, setPhotoRemarks] = useState('');
  const [uploadProgress, setUploadProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Camera Viewfinder state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isCapturingLive, setIsCapturingLive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Location capture state
  const [locating, setLocating] = useState(false);

  // EVC Declaration state
  const [declarationAgreed, setDeclarationAgreed] = useState(false);

  // RO/Admin Review state
  const [officerRemarks, setOfficerRemarks] = useState('');
  const [previewImage, setPreviewImage] = useState<InspectionEvidence | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const isOfficerOrAdmin = user?.role === 'officer' || user?.role === 'admin' || user?.role === 'bureau';
  const isEvc = user?.role === 'evc_expert';

  async function loadData() {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchVisitProofDossier(visitId);
      setDossier(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load inspection proof dossier.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [visitId]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  }

  // =========================================================================
  // Live Camera Functions (Webcam & Mobile Camera)
  // =========================================================================

  async function startCamera(facing: 'environment' | 'user' = cameraFacingMode) {
    stopCamera();
    setIsCameraActive(true);
    setCameraError(null);
    setCapturedSnapshot(null);
    setCapturedBlob(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera device access is not supported by this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      let msg = err.message || 'Unable to open camera stream.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please allow camera permissions in your browser address bar.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device detected on this system. You can choose saved images from your files.';
      }
      setCameraError(msg);
    }
  }

  function stopCamera() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCapturedSnapshot(null);
    setCapturedBlob(null);
    setCameraError(null);
  }

  function toggleCameraFacing() {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacing);
    startCamera(nextFacing);
  }

  function takeSnapshot() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (cameraFacingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob);
        setCapturedSnapshot(URL.createObjectURL(blob));
      }
    }, 'image/jpeg', 0.92);
  }

  function retakeSnapshot() {
    if (capturedSnapshot) {
      URL.revokeObjectURL(capturedSnapshot);
    }
    setCapturedSnapshot(null);
    setCapturedBlob(null);
  }

  async function uploadCapturedSnapshot() {
    if (!capturedBlob) return;
    setIsCapturingLive(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const filename = `camera_${selectedCategory.toLowerCase()}_${Date.now()}.jpg`;
      const file = new File([capturedBlob], filename, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('evidence_type', selectedCategory);
      if (photoRemarks) formData.append('remarks', photoRemarks);

      if (dossier?.visit.gps_latitude && dossier?.visit.gps_longitude) {
        formData.append('latitude', String(dossier.visit.gps_latitude));
        formData.append('longitude', String(dossier.visit.gps_longitude));
        if (dossier.visit.gps_accuracy) {
          formData.append('accuracy', String(dossier.visit.gps_accuracy));
        }
      }

      await uploadEvcPhotoEvidence(visitId, formData);
      setSuccessMsg(`Live camera photograph uploaded successfully under ${selectedCategory.replace(/_/g, ' ')}!`);
      setPhotoRemarks('');
      stopCamera();
      await loadData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload captured photograph.');
    } finally {
      setIsCapturingLive(false);
    }
  }

  // =========================================================================
  // File Explorer Photo Upload
  // =========================================================================

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadProgress(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File '${file.name}' exceeds the 10MB limit.`);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('evidence_type', selectedCategory);
        if (photoRemarks) formData.append('remarks', photoRemarks);

        if (dossier?.visit.gps_latitude && dossier?.visit.gps_longitude) {
          formData.append('latitude', String(dossier.visit.gps_latitude));
          formData.append('longitude', String(dossier.visit.gps_longitude));
          if (dossier.visit.gps_accuracy) {
            formData.append('accuracy', String(dossier.visit.gps_accuracy));
          }
        }

        await uploadEvcPhotoEvidence(visitId, formData);
      }

      setSuccessMsg(`Successfully uploaded ${files.length} photograph(s).`);
      setPhotoRemarks('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      await loadData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload inspection photograph.');
    } finally {
      setUploadProgress(false);
    }
  }

  // =========================================================================
  // Geolocation Capture
  // =========================================================================

  async function handleCaptureLocation() {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setErrorMsg('');
    setSuccessMsg('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const acc = pos.coords.accuracy;

          await captureEvcLocation(visitId, {
            latitude: lat,
            longitude: lon,
            accuracy: acc,
            captured_at: new Date().toISOString()
          });

          setSuccessMsg(`Location captured successfully: ${lat.toFixed(4)}°, ${lon.toFixed(4)}° (±${Math.round(acc)}m)`);
          await loadData();
          if (onUpdated) onUpdated();
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to save captured location.');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setErrorMsg(`Location permission denied or unavailable (${err.message}). Please allow browser location access.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // =========================================================================
  // AI Vision Analysis Triggers
  // =========================================================================

  async function handleAnalyzeEvidence(eid: number) {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await analyzeEvcEvidence(eid);
      await loadData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'AI vision analysis failed.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAnalyzeAll() {
    if (!dossier) return;
    const pending = dossier.evidences.filter((e) => e.ai_analysis_status === 'PENDING');
    if (pending.length === 0) return;

    setActionLoading(true);
    setErrorMsg('');
    try {
      for (const ev of pending) {
        await analyzeEvcEvidence(ev.id);
      }
      setSuccessMsg(`Completed AI vision screening on ${pending.length} photographs.`);
      await loadData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'AI screening encountered errors on some items.');
    } finally {
      setActionLoading(false);
    }
  }

  // =========================================================================
  // Evidence Deletion
  // =========================================================================

  async function handleDeleteEvidence(eid: number) {
    if (!window.confirm('Are you sure you want to remove this photograph before submission?')) {
      return;
    }
    setActionLoading(true);
    setErrorMsg('');
    try {
      await deleteEvcEvidence(eid);
      await loadData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete photograph.');
    } finally {
      setActionLoading(false);
    }
  }

  // =========================================================================
  // EVC Final Submission
  // =========================================================================

  async function handleSubmitProof() {
    if (!declarationAgreed) {
      setErrorMsg('You must check the mandatory EVC declaration box before submitting.');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const declaration =
        'I confirm that I am submitting these photographs and supporting records in connection with the assigned institutional inspection. The information provided is accurate to the best of my knowledge.';
      await submitEvcVisitProof(visitId, declaration);
      setSuccessMsg('Visit proof submitted successfully for Regional Officer / Admin verification.');
      await loadData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit visit proof.');
    } finally {
      setActionLoading(false);
    }
  }

  // =========================================================================
  // RO / Admin Verification Decision
  // =========================================================================

  async function handleVerifyDecision(action: 'ACCEPT' | 'REQUEST_ADDITIONAL_EVIDENCE' | 'REJECT') {
    if ((action === 'REQUEST_ADDITIONAL_EVIDENCE' || action === 'REJECT') && officerRemarks.trim().length < 5) {
      setErrorMsg(`Detailed remarks (minimum 5 characters) explaining '${action.replace(/_/g, ' ')}' are mandatory.`);
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    try {
      await verifyEvcVisitProof(visitId, action, officerRemarks.trim());
      setSuccessMsg(`Inspection proof successfully marked as '${action.replace(/_/g, ' ')}'.`);
      setOfficerRemarks('');
      await loadData();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record verification decision.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading && !dossier) {
    return (
      <div className="modal-backdrop" style={{ zIndex: 1050 }}>
        <div className="modal-dialog" style={{ maxWidth: 600, padding: 24, textAlign: 'center', background: '#FFFFFF', borderRadius: 8 }}>
          <RefreshCw size={24} className="spin" style={{ color: '#2563EB', margin: '0 auto 12px' }} />
          <p style={{ margin: 0, fontSize: 14, color: '#64748B' }}>Loading inspection proof dossier...</p>
        </div>
      </div>
    );
  }

  if (!dossier) return null;

  const { visit, evidences, combined_assessment, institution_address } = dossier;
  const status = visit.proof_submission_status || 'NOT_SUBMITTED';

  return (
    <div className="modal-backdrop" style={{ zIndex: 1050, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(2px)' }}>
      <div
        className="modal-dialog"
        style={{
          maxWidth: 1040,
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#F8FAFC',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          background: '#163A63',
          padding: '16px 24px',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={20} style={{ color: '#60A5FA' }} />
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#FFFFFF' }}>
                AI-Powered EVC Visit Proof & Authenticity Verification
              </h3>
            </div>
            <span style={{ fontSize: 12, color: '#93C5FD', display: 'block', marginTop: 2 }}>
              {visit.institution_name} · Application #{visit.application_id} · Inspection Date: {visit.scheduled_date}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 0, color: '#FFFFFF', cursor: 'pointer', padding: 4 }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Feedback Messages */}
          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 6,
              background: '#FEF2F2',
              border: '1px solid #FECACA',
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

          {successMsg && (
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

          {/* Section 1: Institution & Inspection Details */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            fontSize: 12.5
          }}>
            <div>
              <b style={{ color: '#64748B', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>Institution Address</b>
              <span style={{ color: '#1E293B', fontWeight: 500 }}>{institution_address || 'Registered campus address on file'}</span>
            </div>
            <div>
              <b style={{ color: '#64748B', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>Assigned Panel</b>
              <span style={{ color: '#1E293B', fontWeight: 500 }}>{visit.committee_members}</span>
            </div>
            <div>
              <b style={{ color: '#64748B', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>Inspection Type & Mode</b>
              <span style={{ color: '#1E293B', fontWeight: 500 }}>{visit.visit_mode || 'PHYSICAL'} Visit ({visit.status})</span>
            </div>
            <div>
              <b style={{ color: '#64748B', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>Proof Submission Status</b>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                display: 'inline-block',
                marginTop: 2,
                padding: '2px 8px',
                borderRadius: 4,
                background:
                  status === 'ACCEPTED' ? '#ECFDF5' :
                  status === 'REJECTED' ? '#FEF2F2' :
                  status === 'ADDITIONAL_EVIDENCE_REQUIRED' ? '#FFFBEB' :
                  status === 'SUBMITTED' ? '#EFF6FF' : '#F1F5F9',
                color:
                  status === 'ACCEPTED' ? '#047857' :
                  status === 'REJECTED' ? '#B91C1C' :
                  status === 'ADDITIONAL_EVIDENCE_REQUIRED' ? '#B45309' :
                  status === 'SUBMITTED' ? '#1D4ED8' : '#475569',
                border: `1px solid ${
                  status === 'ACCEPTED' ? '#A7F3D0' :
                  status === 'REJECTED' ? '#FECACA' :
                  status === 'ADDITIONAL_EVIDENCE_REQUIRED' ? '#FDE68A' :
                  status === 'SUBMITTED' ? '#BFDBFE' : '#E2E8F0'
                }`
              }}>
                {status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Section 2: Combined Evidence Assessment Strip */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} style={{ color: '#2563EB' }} />
                <h4 style={{ margin: 0, fontSize: 14, color: '#1E293B', fontWeight: 700 }}>
                  Combined Evidence Assessment
                </h4>
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 6,
                background: combined_assessment.overall_status === 'Evidence Appears Relevant' ? '#ECFDF5' :
                            combined_assessment.overall_status === 'Evidence Requires Review' ? '#FFFBEB' : '#F1F5F9',
                color: combined_assessment.overall_status === 'Evidence Appears Relevant' ? '#047857' :
                       combined_assessment.overall_status === 'Evidence Requires Review' ? '#B45309' : '#475569',
                border: '1px solid #CBD5E1'
              }}>
                {combined_assessment.overall_status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 12 }}>
              <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                <b style={{ color: '#1E293B', display: 'block', marginBottom: 4 }}>Photographs ({evidences.length})</b>
                <span style={{ color: '#64748B' }}>
                  {combined_assessment.image_analysis.analyzed_count} analyzed · {combined_assessment.image_analysis.duplicate_warnings_count} duplicate alert(s)
                </span>
              </div>
              <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                <b style={{ color: '#1E293B', display: 'block', marginBottom: 4 }}>GPS Location</b>
                <span style={{ color: '#64748B' }}>
                  {visit.gps_latitude && visit.gps_longitude
                    ? `${visit.gps_latitude.toFixed(4)}°, ${visit.gps_longitude.toFixed(4)}° (${visit.location_status || 'CAPTURED'})`
                    : 'Location Not Captured'}
                </span>
              </div>
              <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                <b style={{ color: '#1E293B', display: 'block', marginBottom: 4 }}>Campus Proximity</b>
                <span style={{ color: '#64748B' }}>
                  {visit.gps_distance_km !== null && visit.gps_distance_km !== undefined
                    ? `${visit.gps_distance_km} km from campus baseline`
                    : 'Baseline coordinates pending'}
                </span>
              </div>
              <div style={{ background: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                <b style={{ color: '#1E293B', display: 'block', marginBottom: 4 }}>Completeness</b>
                <span style={{ color: '#64748B' }}>
                  {combined_assessment.submission_completeness.has_declaration ? '✓ Declaration Signed' : 'Declaration Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Live Camera Viewfinder Overlay (When "Take Photo" is clicked) */}
          {isCameraActive && (
            <div style={{
              background: '#0F172A',
              border: '2px solid #3B82F6',
              borderRadius: 10,
              padding: 16,
              color: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Camera size={18} style={{ color: '#60A5FA' }} />
                  <b style={{ fontSize: 14 }}>Live Inspection Camera Viewfinder</b>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    title="Flip Camera (Front / Rear)"
                    style={{
                      background: '#1E293B',
                      border: '1px solid #475569',
                      borderRadius: 6,
                      color: '#E2E8F0',
                      padding: '4px 10px',
                      fontSize: 11.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <RotateCcw size={13} />
                    <span>Flip Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    title="Close Camera"
                    style={{ background: 'transparent', border: 0, color: '#94A3B8', cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {cameraError ? (
                <div style={{
                  padding: 24,
                  textAlign: 'center',
                  background: '#1E293B',
                  borderRadius: 8,
                  border: '1px dashed #EF4444'
                }}>
                  <AlertTriangle size={32} style={{ color: '#EF4444', margin: '0 auto 8px' }} />
                  <p style={{ color: '#FCA5A5', fontSize: 13, margin: '0 0 12px' }}>{cameraError}</p>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      stopCamera();
                      fileInputRef.current?.click();
                    }}
                    style={{ fontSize: 12.5 }}
                  >
                    Choose Photo from Files Instead
                  </button>
                </div>
              ) : (
                <>
                  {/* Viewport Frame */}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: 380,
                    background: '#000000',
                    borderRadius: 8,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {capturedSnapshot ? (
                      <img
                        src={capturedSnapshot}
                        alt="Captured Frame Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}

                    {/* Inspection Guide Overlay */}
                    <div style={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      background: 'rgba(0,0,0,0.65)',
                      backdropFilter: 'blur(4px)',
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <Info size={13} style={{ color: '#60A5FA' }} />
                      <span>Align campus building, lab, or signboard within view</span>
                    </div>

                    {visit.gps_latitude && visit.gps_longitude && (
                      <div style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 12,
                        background: 'rgba(0,0,0,0.65)',
                        backdropFilter: 'blur(4px)',
                        padding: '4px 10px',
                        borderRadius: 4,
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <MapPin size={12} style={{ color: '#34D399' }} />
                        <span>GPS: {visit.gps_latitude.toFixed(4)}°, {visit.gps_longitude.toFixed(4)}° (±{Math.round(visit.gps_accuracy || 0)}m)</span>
                      </div>
                    )}
                  </div>

                  {/* Camera Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 240px' }}>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: '#1E293B',
                          color: '#FFFFFF',
                          border: '1px solid #475569',
                          fontSize: 12
                        }}
                      >
                        {EVIDENCE_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>

                      <input
                        type="text"
                        placeholder="Optional photo notes..."
                        value={photoRemarks}
                        onChange={(e) => setPhotoRemarks(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: '#1E293B',
                          color: '#FFFFFF',
                          border: '1px solid #475569',
                          fontSize: 12,
                          flex: 1
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {capturedSnapshot ? (
                        <>
                          <button
                            type="button"
                            onClick={retakeSnapshot}
                            disabled={isCapturingLive}
                            style={{
                              background: '#334155',
                              border: '1px solid #64748B',
                              color: '#FFFFFF',
                              padding: '7px 14px',
                              borderRadius: 6,
                              fontSize: 12.5,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <RotateCcw size={14} />
                            <span>Retake</span>
                          </button>

                          <button
                            type="button"
                            onClick={uploadCapturedSnapshot}
                            disabled={isCapturingLive}
                            style={{
                              background: '#059669',
                              border: 0,
                              color: '#FFFFFF',
                              padding: '7px 16px',
                              borderRadius: 6,
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <CheckCircle2 size={15} />
                            <span>{isCapturingLive ? 'Uploading...' : 'Save & Upload Photo'}</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={takeSnapshot}
                          style={{
                            background: '#DC2626',
                            border: '3px solid #FFFFFF',
                            color: '#FFFFFF',
                            padding: '8px 20px',
                            borderRadius: 24,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 0 10px rgba(220, 38, 38, 0.6)'
                          }}
                        >
                          <Camera size={16} />
                          <span>Capture Photo</span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Section 4: EVC Action Toolbar */}
          {(isEvc || isOfficerOrAdmin) && status !== 'ACCEPTED' && (
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #BFDBFE',
              borderRadius: 8,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}>
              <b style={{ fontSize: 13, color: '#1E3A8A' }}>
                EVC Evidence Capture & Location Verification Tools
              </b>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                {/* File Upload Input (Opens File Explorer) */}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 12.5,
                    background: '#FFFFFF',
                    color: '#1E293B'
                  }}
                >
                  {EVIDENCE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Optional observation/notes..."
                  value={photoRemarks}
                  onChange={(e) => setPhotoRemarks(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 12.5,
                    flex: '1 1 200px'
                  }}
                />

                {/* Take Photo: Opens in-browser Camera Viewfinder */}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => startCamera('environment')}
                  disabled={uploadProgress || isCameraActive}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12.5 }}
                >
                  <Camera size={15} />
                  <span>Take Photo</span>
                </button>

                {/* Choose Images: Opens Windows File Explorer */}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadProgress}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12.5 }}
                >
                  <Upload size={15} />
                  <span>Choose Images (File Explorer)</span>
                </button>

                {/* Geolocation Button */}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCaptureLocation}
                  disabled={locating}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    fontSize: 12.5,
                    borderColor: '#93C5FD',
                    color: '#1D4ED8',
                    background: '#EFF6FF'
                  }}
                >
                  <MapPin size={15} />
                  <span>{locating ? 'Capturing GPS...' : 'Capture GPS Location'}</span>
                </button>

                {evidences.some((e) => e.ai_analysis_status === 'PENDING') && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleAnalyzeAll}
                    disabled={actionLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      fontSize: 12.5,
                      borderColor: '#C7D2FE',
                      color: '#4338CA',
                      background: '#EEF2FF'
                    }}
                  >
                    <Sparkles size={15} />
                    <span>Run AI Screening</span>
                  </button>
                )}
              </div>

              <div style={{ fontSize: 11.5, color: '#64748B', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>• <b>Take Photo:</b> Launches live camera viewfinder directly on screen</span>
                <span>• <b>Choose Images:</b> Opens system file explorer to upload files</span>
                <span>• Supported formats: JPG, JPEG, PNG, WEBP (Max 10MB)</span>
              </div>
            </div>
          )}

          {/* Section 5: Evidence Gallery */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: 14, color: '#163A63', fontWeight: 700 }}>
                Inspection Photographs & Evidence Records ({evidences.length})
              </h4>
              <span style={{ fontSize: 12, color: '#64748B' }}>
                All images stamped with SHA-256 cryptographic hashes for non-repudiation
              </span>
            </div>

            {evidences.length === 0 ? (
              <div style={{
                padding: '36px 20px',
                textAlign: 'center',
                background: '#F8FAFC',
                borderRadius: 8,
                border: '1px dashed #CBD5E1'
              }}>
                <Camera size={32} style={{ color: '#94A3B8', margin: '0 auto 10px' }} />
                <p style={{ margin: 0, fontSize: 14, color: '#475569', fontWeight: 600 }}>
                  No inspection photographs uploaded yet
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>
                  Click "Take Photo" to activate your camera or "Choose Images" to select photos from file explorer.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 14 }}>
                {evidences.map((ev) => {
                  return (
                    <div
                      key={ev.id}
                      style={{
                        background: '#FFFFFF',
                        border: ev.is_duplicate ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
                        borderRadius: 8,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                      }}
                    >
                      {/* Top Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#EFF6FF',
                          color: '#1E40AF',
                          border: '1px solid #BFDBFE'
                        }}>
                          {ev.evidence_type.replace(/_/g, ' ')}
                        </span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: ev.ai_analysis_status === 'COMPLETED' ? '#ECFDF5' :
                                        ev.ai_analysis_status === 'UNAVAILABLE' ? '#F1F5F9' : '#FFFBEB',
                            color: ev.ai_analysis_status === 'COMPLETED' ? '#047857' :
                                   ev.ai_analysis_status === 'UNAVAILABLE' ? '#475569' : '#B45309'
                          }}>
                            AI: {ev.ai_analysis_status || 'PENDING'}
                          </span>
                          {status !== 'ACCEPTED' && status !== 'SUBMITTED' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteEvidence(ev.id)}
                              title="Delete photograph"
                              style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#94A3B8' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Image Thumbnail with Authenticated URL */}
                      <div
                        onClick={() => setPreviewImage(ev)}
                        style={{
                          height: 150,
                          background: '#0F172A',
                          borderRadius: 6,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                      >
                        <img
                          src={getEvidenceImageUrl(ev.id)}
                          alt={ev.file_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as HTMLElement).style.opacity = '0.3';
                          }}
                        />
                        <div style={{
                          position: 'absolute',
                          bottom: 6,
                          right: 6,
                          background: 'rgba(0,0,0,0.7)',
                          backdropFilter: 'blur(3px)',
                          color: '#FFFFFF',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 10.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <Eye size={12} /> Inspect
                        </div>
                      </div>

                      {/* File Details */}
                      <div style={{ fontSize: 11.5, color: '#475569', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <b style={{ color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ev.file_name}
                        </b>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                          <span>Size: {Math.round(ev.file_size / 1024)} KB</span>
                          <span>Uploaded: {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {/* Hash Display */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: '#F1F5F9',
                          padding: '3px 6px',
                          borderRadius: 4,
                          fontFamily: 'monospace',
                          fontSize: 10.5,
                          color: '#334155'
                        }}>
                          <span>SHA: {ev.file_hash ? `${ev.file_hash.substring(0, 16)}...` : 'N/A'}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(ev.file_hash)}
                            title="Copy full SHA-256 hash"
                            style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#64748B' }}
                          >
                            {copiedHash === ev.file_hash ? <Check size={12} style={{ color: '#16A34A' }} /> : <Copy size={12} />}
                          </button>
                        </div>

                        {/* Duplicate Alert */}
                        {ev.is_duplicate && (
                          <div style={{ color: '#B91C1C', fontSize: 11, fontWeight: 600, display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                            <AlertTriangle size={13} /> {ev.duplicate_reference || 'Duplicate image upload detected.'}
                          </div>
                        )}

                        {/* AI Observations / Remarks */}
                        {ev.ai_observations && (
                          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: 4, marginTop: 4, fontSize: 11 }}>
                            <span style={{ color: '#1E40AF', fontWeight: 600 }}>AI Observation:</span>
                            <p style={{ margin: '2px 0 0', color: '#334155' }}>{ev.ai_observations}</p>
                          </div>
                        )}

                        {ev.remarks && (
                          <div style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', marginTop: 2 }}>
                            Notes: {ev.remarks}
                          </div>
                        )}
                      </div>

                      {/* Item Actions */}
                      {ev.ai_analysis_status === 'PENDING' && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleAnalyzeEvidence(ev.id)}
                          disabled={actionLoading}
                          style={{
                            padding: '4px 8px',
                            fontSize: 11,
                            borderColor: '#C7D2FE',
                            color: '#4338CA',
                            background: '#EEF2FF',
                            marginTop: 'auto'
                          }}
                        >
                          <Sparkles size={12} /> Run AI Analysis
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 6: EVC Final Submission */}
          {isEvc && status !== 'ACCEPTED' && status !== 'SUBMITTED' && (
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: 8,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <b style={{ fontSize: 13.5, color: '#1E293B' }}>
                Statutory EVC Visit Confirmation & Final Submission
              </b>

              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={declarationAgreed}
                  onChange={(e) => setDeclarationAgreed(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span style={{ fontSize: 12.5, color: '#334155', lineHeight: '1.45' }}>
                  <b>Mandatory Declaration:</b> "I confirm that I am submitting these photographs and supporting records in connection with the assigned institutional inspection. The information provided is accurate to the best of my knowledge."
                </span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSubmitProof}
                  disabled={actionLoading || !declarationAgreed || evidences.length === 0}
                  style={{ padding: '9px 18px', fontSize: 13 }}
                >
                  {actionLoading ? 'Submitting...' : 'Submit Visit Proof to Regional Officer'}
                </button>
              </div>
            </div>
          )}

          {/* Section 7: RO / Admin Verification Decision Workspace */}
          {isOfficerOrAdmin && (
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: 14, color: '#163A63', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={18} style={{ color: '#2563EB' }} />
                  Regional Officer / Administrator Proof Verification
                </b>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  Statutory evaluation of EVC physical visit proof
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                  Statutory Verification Remarks / Observations (Mandatory for Additional Evidence or Rejection):
                </label>
                <textarea
                  rows={3}
                  value={officerRemarks}
                  onChange={(e) => setOfficerRemarks(e.target.value)}
                  placeholder="Enter statutory inspection evaluation notes (e.g., 'Physical infrastructure and signboard confirmed compliant with APH norms')..."
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 12.5,
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleVerifyDecision('ACCEPT')}
                  disabled={actionLoading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    background: '#059669',
                    color: '#FFFFFF',
                    border: 0,
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <CheckCircle2 size={16} /> Accept Visit Proof
                </button>

                <button
                  type="button"
                  onClick={() => handleVerifyDecision('REQUEST_ADDITIONAL_EVIDENCE')}
                  disabled={actionLoading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    background: '#D97706',
                    color: '#FFFFFF',
                    border: 0,
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <AlertTriangle size={16} /> Request Additional Evidence
                </button>

                <button
                  type="button"
                  onClick={() => handleVerifyDecision('REJECT')}
                  disabled={actionLoading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    background: '#DC2626',
                    color: '#FFFFFF',
                    border: 0,
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <X size={16} /> Reject Proof
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid #E2E8F0', padding: '12px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

      </div>

      {/* Image Zoom / Lightbox Modal */}
      {previewImage && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1100, background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setPreviewImage(null)}
        >
          <div
            style={{
              maxWidth: 820,
              width: '92%',
              maxHeight: '90vh',
              background: '#1E293B',
              borderRadius: 8,
              padding: 18,
              color: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <b style={{ fontSize: 14 }}>{previewImage.file_name}</b>
                <span style={{ fontSize: 12, color: '#94A3B8', display: 'block' }}>
                  Category: {previewImage.evidence_type.replace(/_/g, ' ')} · Uploaded by: {previewImage.uploaded_by}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <a
                  href={getEvidenceImageUrl(previewImage.id)}
                  download={previewImage.file_name}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: '#334155',
                    border: '1px solid #475569',
                    color: '#FFFFFF',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Download size={13} />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  style={{ background: 'transparent', border: 0, color: '#FFFFFF', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, maxHeight: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', background: '#000000', borderRadius: 6 }}>
              <img
                src={getEvidenceImageUrl(previewImage.id)}
                alt={previewImage.file_name}
                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11, background: '#0F172A', padding: 10, borderRadius: 6 }}>
              <div>
                <span style={{ color: '#94A3B8' }}>SHA-256 Hash:</span>
                <span style={{ fontFamily: 'monospace', color: '#E2E8F0', display: 'block', wordBreak: 'break-all' }}>{previewImage.file_hash}</span>
              </div>
              <div>
                <span style={{ color: '#94A3B8' }}>Perceptual Hash (aHash):</span>
                <span style={{ fontFamily: 'monospace', color: '#E2E8F0', display: 'block' }}>{previewImage.phash || 'N/A'}</span>
              </div>
            </div>

            {previewImage.ai_observations && (
              <div style={{ background: '#0F172A', padding: 10, borderRadius: 6, fontSize: 12, color: '#94A3B8' }}>
                <b style={{ color: '#60A5FA' }}>AI Analysis: </b> {previewImage.ai_observations}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
