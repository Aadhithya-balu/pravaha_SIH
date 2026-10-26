import React, { useState } from 'react';
import {
  FileSearch,
  Upload,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  ShieldCheck,
  Send,
  AlertCircle
} from 'lucide-react';
import { AiAnalysisResult, User } from '../types';
import { api, apiUpload } from '../api';

interface DocumentReviewTabProps {
  user: User | null;
}

export const DocumentReviewTab: React.FC<DocumentReviewTabProps> = ({ user }) => {
  const [docName, setDocName] = useState('Registered_Lease_Deed_Sample.pdf');
  const [docType, setDocType] = useState('LEASE_DEED');
  const [docText, setDocText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiAnalysisResult | null>(null);
  const [uploadedDocId, setUploadedDocId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isDispositionLoading, setIsDispositionLoading] = useState(false);

  // Pre-loaded realistic sample documents for 1-click evaluation
  const samples = [
    {
      title: 'Valid 33-Year Land Lease Deed',
      name: 'Registered_Lease_Deed_Valid.pdf',
      type: 'LEASE_DEED',
      text: `REGISTERED LEASE DEED
Executed on 15 March 2020 at Noida Sub-Registrar Office Book 1 Deed No. 4589/2020.
Lessor: Shri Ramakant Sharma, S/o Late Sh. B.K. Sharma.
Lessee: Shri Krishna Educational Trust / ABC Engineering College.
Land Description: Plot / Khasra No. 412/1 and 413, measuring 7.50 Acres situated at Sector 62, Noida, Gautam Buddha Nagar, UP.
Term of Lease: 33 Years commencing 01 April 2020 and concluding on 31 March 2053.
Covenant: The Lessee shall irrevocably possess and utilise the subject property exclusively for running technical and professional educational institutions approved by AICTE.
Registered under the Indian Registration Act 1908.`
    },
    {
      title: 'Deficient Lease Deed (Short 14-Year Tenure)',
      name: 'Deficient_Short_Lease_Deed.pdf',
      type: 'LEASE_DEED',
      text: `MEMORANDUM OF LEASE AGREEMENT
Dated: 10 January 2024.
Between Landlord Shri P.K. Gupta and Sunrise Institute.
Property: Khasra No. 89, Survey 14, 2.50 Acres.
The lease tenure is agreed for a duration of 14 Years only.
Sub-registrar registration pending. Commercial sub-leasing permitted on mutual consent.`
    },
    {
      title: 'Fire Safety Certificate (NOC)',
      name: 'Fire_Safety_Clearance_NOC.pdf',
      type: 'FIRE_NOC',
      text: `GOVERNMENT OF UTTAR PRADESH — FIRE & LIFE SAFETY CLEARANCE CERTIFICATE
No. CFO/GBN/NOC/2025/112 Date of Issue: 12 August 2025.
Premises: ABC Engineering College, Sector 62, Institutional Area, Noida.
Inspection: Multi-storey Academic Block A (G+4) and Block B (G+3) inspected by Divisional Fire Officer.
Fitted Systems: Wet risers, automatic fire detection, smoke alarms, 50,000 Litres static underground water storage.
Conforms to NBC 2016 Part 4. Certificate valid for 1 Year, valid until 11 August 2026.`
    },
    {
      title: 'Mandatory AICTE Undertaking / Affidavit',
      name: 'AICTE_Statutory_Undertaking.pdf',
      type: 'UNDERTAKING',
      text: `MANDATORY AFFIDAVIT
On Rs. 100 Non-Judicial Stamp Paper attested by First Class Judicial Magistrate.
I, Prof. Anand Deshmukh, Secretary of Shri Krishna Educational Society, do hereby solemnly affirm:
1. That the institution strictly enforces AICTE anti-ragging regulations 2009.
2. That all instructional faculty cadre ratios (1:15/1:20) and 7th Central Pay Commission scales are implemented.
3. That all disclosures on the AICTE portal are verified and true to the best of my knowledge.`
    }
  ];

  function loadSample(sample: typeof samples[0]) {
    setDocName(sample.name);
    setDocType(sample.type);
    setDocText(sample.text);
    setAnalysisResult(null);
    setUploadedDocId(null);
    setErrorMsg('');
    setSuccessMsg('');
  }

  async function handleAnalyze() {
    if (!docText.trim()) {
      setErrorMsg('Please paste document text or select an official sample document above.');
      return;
    }
    setIsAnalyzing(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api<AiAnalysisResult>('/documents/check-text', {
        method: 'POST',
        body: JSON.stringify({
          document_name: docName,
          document_type: docType,
          extracted_text: docText
        })
      });
      setAnalysisResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Scrutiny check failed.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocName(file.name);
    setIsAnalyzing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', docType);

      const data = await apiUpload('/documents/upload', formData);
      setAnalysisResult(data.ai_analysis);
      setUploadedDocId(data.document.id);
      setDocText(data.document.extracted_text || 'Text content extracted from file.');
      setSuccessMsg(`Document '${file.name}' ingested and evaluated by AI scrutiny pipeline.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Upload failed.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleRecordDisposition(reviewStatus: 'ACCEPTED' | 'CORRECTION_REQUIRED') {
    if (!uploadedDocId) {
      setErrorMsg('To record a binding statutory disposition, please upload an actual document file above.');
      return;
    }

    setIsDispositionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api(`/documents/${uploadedDocId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          review_status: reviewStatus,
          reviewer_notes: `Marked ${reviewStatus} by ${user?.name} (${user?.role}) via Scrutiny Console.`
        })
      });
      setSuccessMsg(`Document disposition recorded in audit trail: ${reviewStatus}.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Disposition recording failed.');
    } finally {
      setIsDispositionLoading(false);
    }
  }

  return (
    <div className="page-container">
      {/* Sample Document Quick Selector */}
      <div className="panel-card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <b style={{ fontSize: 12, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileSearch size={14} color="var(--primary)" />
            AICTE Regulatory Evaluation Samples
          </b>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Load statutory test cases to evaluate automated rule checks
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {samples.map((s) => (
            <button
              key={s.title}
              className="btn-secondary"
              style={{ fontSize: 11, padding: '6px 10px' }}
              onClick={() => loadSample(s)}
            >
              <FileText size={12} color="var(--primary)" />
              <span>{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Input & Analysis Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 18 }}>
        {/* Left: Input & Upload */}
        <div className="panel-card">
          <div className="panel-header">
            <h3>
              <Upload size={16} color="var(--primary)" />
              Document Ingestion & Text Screening
            </h3>
          </div>

          {errorMsg && <div className="alert-banner danger" style={{ marginBottom: 12 }}>{errorMsg}</div>}
          {successMsg && <div className="alert-banner info" style={{ marginBottom: 12 }}>{successMsg}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label>Statutory Document Type *</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                <option value="LEASE_DEED">Registered Land Lease Deed / Ownership</option>
                <option value="FIRE_NOC">Fire & Life Safety Certificate (NOC)</option>
                <option value="BUILDING_PLAN">Approved Municipal Building Plan & Stability</option>
                <option value="UNDERTAKING">AICTE Mandatory Affidavit / Undertaking</option>
                <option value="LAND_CONVERSION">Land Use Conversion (CLU) Order</option>
                <option value="OTHER">Other Institutional Disclosure</option>
              </select>
            </div>

            <div className="form-group">
              <label>Document Title</label>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Upload File (PDF / DOCX / TXT)</label>
              <input
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                onChange={handleFileUpload}
                style={{ padding: '6px' }}
              />
            </div>

            <div className="form-group">
              <label>Document Text Content (Extracted)</label>
              <textarea
                rows={8}
                placeholder="Paste legal text or extracted OCR output..."
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
              />
            </div>

            <button
              className="btn-primary"
              style={{ justifyContent: 'center', padding: '10px' }}
              disabled={isAnalyzing || !docText.trim()}
              onClick={handleAnalyze}
            >
              <FileSearch size={15} />
              <span>{isAnalyzing ? 'Evaluating Regulatory Norms...' : 'Execute Compliance Screening'}</span>
            </button>
          </div>
        </div>

        {/* Right: Scrutiny Findings */}
        <div className="panel-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <div>
              <h3>
                <ShieldCheck size={16} color="var(--primary)" />
                Regulatory Scrutiny Findings
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Automated rule checking & statutory discrepancy detection
              </span>
            </div>

            {analysisResult && (
              <span className="badge badge-stage">
                {analysisResult.mode === 'real_llm' ? `LIVE LLM (${analysisResult.model})` : 'DETERMINISTIC FALLBACK'}
              </span>
            )}
          </div>

          {!analysisResult ? (
            <div className="empty-state" style={{ padding: '60px 20px', margin: 'auto 0' }}>
              <FileSearch size={32} color="#94a3b8" />
              <h4>No Document Analyzed Yet</h4>
              <p>
                Select one of the pre-loaded regulatory samples or upload a document on the left, then click "Execute Compliance Screening".
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Executive Summary */}
              <div style={{
                background: '#f8fafc',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>
                  Executive Summary
                </span>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--text-main)' }}>
                  {analysisResult.summary}
                </p>
              </div>

              {/* Extracted Fields */}
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Extracted Regulatory Metadata
                </span>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 8,
                  background: '#f8fafc',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  {Object.entries(analysisResult.extracted_fields || {}).map(([key, val]) => (
                    <div key={key} style={{ fontSize: 11 }}>
                      <b style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 10, display: 'block' }}>{key}</b>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discrepancies and Inconsistencies */}
              {analysisResult.potential_inconsistencies && analysisResult.potential_inconsistencies.length > 0 && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Flagged Discrepancies & Regulatory Inconsistencies ({analysisResult.potential_inconsistencies.length})
                  </span>
                  <div style={{
                    background: '#fef2f2',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #fecaca'
                  }}>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#991b1b', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {analysisResult.potential_inconsistencies.map((flag, idx) => (
                        <li key={idx}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Human Verification Checklist */}
              {analysisResult.verification_questions && analysisResult.verification_questions.length > 0 && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Human Verification Checklist for Scrutinizing Officer
                  </span>
                  <div style={{
                    background: '#eff6ff',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #bfdbfe'
                  }}>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#1e3a8a', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {analysisResult.verification_questions.map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Statutory Disclaimer */}
              <div style={{
                padding: '8px 12px',
                background: '#f8fafc',
                borderLeft: '3px solid #64748b',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                color: '#475569',
                lineHeight: 1.4
              }}>
                <b>Statutory Guardrail:</b> {analysisResult.disclaimer}
              </div>

              {/* Binding Officer Disposition Action */}
              {user?.role !== 'institution' && uploadedDocId && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    className="btn-primary"
                    style={{ background: '#047857', borderColor: '#047857', flex: 1, justifyContent: 'center' }}
                    disabled={isDispositionLoading}
                    onClick={() => handleRecordDisposition('ACCEPTED')}
                  >
                    <CheckCircle2 size={14} />
                    <span>Accept Document (Compliant)</span>
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ borderColor: '#ea580c', color: '#c2410c', flex: 1, justifyContent: 'center' }}
                    disabled={isDispositionLoading}
                    onClick={() => handleRecordDisposition('CORRECTION_REQUIRED')}
                  >
                    <AlertTriangle size={14} />
                    <span>Demand Rectification</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
