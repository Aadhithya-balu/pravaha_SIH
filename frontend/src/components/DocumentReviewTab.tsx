import React, { useState } from 'react';
import {
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  ShieldCheck,
  Send
} from 'lucide-react';
import { AiAnalysisResult, User } from '../types';
import { api } from '../api';

interface DocumentReviewTabProps {
  user: User | null;
}

export const DocumentReviewTab: React.FC<DocumentReviewTabProps> = ({ user }) => {
  const [docName, setDocName] = useState('Registered_Lease_Deed_Sample.pdf');
  const [docType, setDocType] = useState('LEASE_DEED');
  const [docText, setDocText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiAnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
    setErrorMsg('');
    setSuccessMsg('');
  }

  async function handleAnalyze() {
    if (!docText.trim()) {
      setErrorMsg('Please paste document text or select a sample document above.');
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
      setErrorMsg(err.message);
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

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', docType);

      const authTok = localStorage.getItem('ps4_token') || '';
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const r = await fetch(`${base}/documents/upload`, {
        method: 'POST',
        headers: authTok ? { Authorization: `Bearer ${authTok}` } : {},
        body: formData
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
      }

      const data = await r.json();
      setAnalysisResult(data.ai_analysis);
      setDocText(data.document.extracted_text || 'Text content extracted from file.');
      setSuccessMsg(`Document '${file.name}' uploaded and analyzed successfully.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="page-container">
      {/* Sample Document Quick Selector */}
      <div className="panel-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <b style={{ fontSize: 13, color: 'var(--text-main)' }}>
            SIH Quick Evaluation: Load Pre-Formatted Regulatory Samples
          </b>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Click to test instant domain validation
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {samples.map((s) => (
            <button
              key={s.title}
              className="btn-secondary"
              style={{ fontSize: 11, padding: '7px 11px' }}
              onClick={() => loadSample(s)}
            >
              <FileText size={13} color="var(--primary)" />
              <span>{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Input & Analysis Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
        {/* Left: Input & Upload */}
        <div className="panel-card">
          <div className="panel-header">
            <h3>
              <Upload size={17} color="var(--primary)" />
              Document Upload & Text Extraction
            </h3>
          </div>

          {errorMsg && <div className="alert-banner danger" style={{ marginBottom: 14 }}>{errorMsg}</div>}
          {successMsg && <div className="alert-banner info" style={{ marginBottom: 14 }}>{successMsg}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label>Regulatory Document Type</label>
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
              <label>Upload Sample File (PDF / TXT)</label>
              <input
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                onChange={handleFileUpload}
                style={{ padding: '8px' }}
              />
            </div>

            <div className="form-group">
              <label>Extracted Document Text Content</label>
              <textarea
                rows={9}
                placeholder="Paste sample legal text or OCR output here..."
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
              />
            </div>

            <button
              className="btn-primary"
              style={{ justifyContent: 'center', padding: '12px' }}
              disabled={isAnalyzing || !docText.trim()}
              onClick={handleAnalyze}
            >
              <Sparkles size={16} />
              <span>{isAnalyzing ? 'Analyzing Regulatory Norms...' : 'Run AI Compliance Check'}</span>
            </button>
          </div>
        </div>

        {/* Right: AI Review Findings */}
        <div className="ai-panel">
          <div className="ai-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} color="#7e22ce" />
              <h3 style={{ margin: 0, fontFamily: 'Manrope', fontSize: 16, color: '#581c87' }}>
                AI-Assisted Scrutiny Findings
              </h3>
            </div>
            {analysisResult && (
              <span className="ai-mode-badge">
                {analysisResult.mode === 'real_llm' ? `LIVE LLM (${analysisResult.model})` : 'DEMO MODE (Deterministic Fallback)'}
              </span>
            )}
          </div>

          {!analysisResult ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#7e22ce' }}>
              <Sparkles size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: 13, margin: 0, fontWeight: 500 }}>
                Select a sample document on the left and click "Run AI Compliance Check" to view automated structured findings.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Executive Summary */}
              <div style={{ background: '#ffffff', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #f3e8ff' }}>
                <b style={{ fontSize: 11, color: '#7e22ce', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Executive Summary
                </b>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: 'var(--text-main)' }}>
                  {analysisResult.summary}
                </p>
              </div>

              {/* Extracted Fields */}
              <div className="ai-section">
                <h4>Extracted Regulatory Metadata</h4>
                <div className="ai-fields-grid">
                  {Object.entries(analysisResult.extracted_fields || {}).map(([key, val]) => (
                    <div key={key} className="ai-field-item">
                      <b>{key}</b>
                      <span>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discrepancies and Inconsistencies */}
              <div className="ai-section">
                <h4>Discrepancies & Regulatory Inconsistencies</h4>
                <div style={{ background: '#fff5f5', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid #fed7d7' }}>
                  <ul className="ai-flags-list">
                    {analysisResult.potential_inconsistencies.map((flag, idx) => (
                      <li key={idx}>
                        <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Human Verification Checklist */}
              <div className="ai-section">
                <h4>Human Officer Verification Checklist</h4>
                <div style={{ background: '#eff6ff', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid #bfdbfe' }}>
                  <ul className="ai-questions-list">
                    {analysisResult.verification_questions.map((q, idx) => (
                      <li key={idx}>
                        <HelpCircle size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Confidence Rating & Official Disclaimer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#6b21a8' }}>
                  Norms Matching Confidence: <b>{(analysisResult.confidence_score * 100).toFixed(0)}%</b>
                </span>
                <span style={{ color: '#6b21a8' }}>
                  Evaluated under APH 2026-27 Norms
                </span>
              </div>

              <div className="ai-disclaimer">
                <b>Statutory Guardrail Notice:</b> {analysisResult.disclaimer}
              </div>

              {/* Official Review Action */}
              {user?.role !== 'institution' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    className="btn-primary"
                    style={{ background: '#16a34a', borderColor: '#16a34a', flex: 1, justifyContent: 'center' }}
                    onClick={() => setSuccessMsg('Document marked as ACCEPTED by scrutiny officer.')}
                  >
                    <CheckCircle2 size={15} />
                    <span>Accept Document Findings</span>
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ borderColor: '#ea580c', color: '#c2410c', flex: 1, justifyContent: 'center' }}
                    onClick={() => setSuccessMsg('Document marked as requiring applicant correction.')}
                  >
                    <AlertTriangle size={15} />
                    <span>Demand Document Correction</span>
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
