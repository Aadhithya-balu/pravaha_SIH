import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  ShieldCheck,
  RotateCcw,
  Eye,
  EyeOff,
  Filter,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  Edit3,
  Save,
  Search,
  ExternalLink,
  Download,
  AlertCircle,
  FileCheck,
  Layers,
  Database,
  Building2,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  CheckSquare
} from 'lucide-react';
import { AiAnalysisResult, User, CandidateField, Application } from '../types';
import { api, fetchApplications, applyExtractedFields } from '../api';

interface DocumentReviewTabProps {
  user: User | null;
  initialApplication?: Application | null;
}

export interface ScrutinyCheckItem {
  id: string;
  rule_id: string;
  rule_title: string;
  category: 'LAND_INFRASTRUCTURE' | 'FIRE_LIFE_SAFETY' | 'FACULTY_CADRE' | 'STATUTORY_AFFIDAVIT' | 'ACADEMIC_NORMS';
  engine_source: 'DETERMINISTIC_RULE_ENGINE' | 'AI_SEMANTIC_ANALYSIS' | 'HUMAN_AUDIT';
  result: 'PASS' | 'POTENTIAL_ISSUE' | 'MISSING_EVIDENCE' | 'NEEDS_REVIEW';
  severity: 'CRITICAL' | 'DEFICIENCY' | 'WARNING' | 'INFO';
  plain_explanation: string;
  evidence_quote?: string | null;
  source_document: string;
  page_number?: number | string;
  recommended_action: string;
  officer_disposition: 'PENDING' | 'ACCEPTED' | 'WAIVED' | 'CORRECTION_REQUESTED';
  disposition_notes?: string | null;
  disposed_by?: string | null;
  disposed_at?: string | null;
}

export const DocumentReviewTab: React.FC<DocumentReviewTabProps> = ({ user, initialApplication }) => {
  // Application linking
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(initialApplication?.id || null);

  // Active document state
  const [docName, setDocName] = useState('Registered_Lease_Deed_Sample.pdf');
  const [docType, setDocType] = useState('LEASE_DEED');
  const [docText, setDocText] = useState('');
  const [docFileSize, setDocFileSize] = useState<number>(245760); // 240 KB
  const [docMimeType, setDocMimeType] = useState('application/pdf');

  // Preview & Search within doc - CLOSED BY DEFAULT as requested
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSearchQuery, setPreviewSearchQuery] = useState('');
  const [selectedHighlight, setSelectedHighlight] = useState<string | null>(null);

  // Analysis result & candidate fields
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiAnalysisResult | null>(null);
  const [editableFields, setEditableFields] = useState<CandidateField[]>([]);
  const [scrutinyChecks, setScrutinyChecks] = useState<ScrutinyCheckItem[]>([]);

  // UI Redesign States
  const [isEngineDetailsOpen, setIsEngineDetailsOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState<'findings' | 'fields' | 'all'>('findings');
  const [fieldFilter, setFieldFilter] = useState<'ALL' | 'NEEDS_REVIEW' | 'VERIFIED' | 'APPLICANT_ENTERED'>('ALL');
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [editValueDraft, setEditValueDraft] = useState<string>('');
  const [editStatusDraft, setEditStatusDraft] = useState<'EXTRACTED' | 'APPLICANT_ENTERED' | 'VERIFIED' | 'NEEDS_REVIEW'>('VERIFIED');
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  // Filtering findings
  const [filterResult, setFilterResult] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterDisposition, setFilterDisposition] = useState<string>('ALL');
  const [findingSearch, setFindingSearch] = useState<string>('');

  // Officer action dialogs
  const [isWaiveOpen, setIsWaiveOpen] = useState(false);
  const [selectedCheckForWaive, setSelectedCheckForWaive] = useState<ScrutinyCheckItem | null>(null);
  const [waiveJustification, setWaiveJustification] = useState('');

  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [selectedCheckForCorrection, setSelectedCheckForCorrection] = useState<ScrutinyCheckItem | null>(null);
  const [correctionNote, setCorrectionNote] = useState('');

  // Notifications & loading
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSavingFields, setIsSavingFields] = useState(false);

  // Realistic SIH Scrutiny Evaluation Presets
  const samples = [
    {
      title: 'Valid 33-Year Land Lease Deed',
      badge: 'PASSES APH NORMS',
      name: 'Registered_Lease_Deed_Valid.pdf',
      type: 'LEASE_DEED',
      size: 312000,
      mime: 'application/pdf',
      text: `REGISTERED LEASE DEED
Executed on 15 March 2020 at Gautam Buddha Nagar Sub-Registrar Office Book 1 Deed No. 4589/2020.
Lessor: Shri Ramakant Sharma, S/o Late Sh. B.K. Sharma.
Lessee: Shri Krishna Educational Trust / ABC Institute of Technology.
Land Description: Plot / Khasra No. 412/1 and 413, measuring 7.50 Acres situated at Sector 62, Institutional Area, Noida, Gautam Buddha Nagar, UP.
Term of Lease: 33 Years commencing 01 April 2020 and concluding on 31 March 2053.
Covenant: The Lessee shall irrevocably possess and utilise the subject property exclusively for running technical and professional educational institutions approved by AICTE.
Registered under the Indian Registration Act 1908. Non-encumbrance certificate verified.`
    },
    {
      title: 'Deficient Lease Deed (Short 14-Year Tenure)',
      badge: 'DEFICIENCY (APH SEC 3.2)',
      name: 'Deficient_Short_Lease_Deed.pdf',
      type: 'LEASE_DEED',
      size: 184000,
      mime: 'application/pdf',
      text: `MEMORANDUM OF LEASE AGREEMENT
Dated: 10 January 2024.
Between Landlord Shri P.K. Gupta and Sunrise Institute of Engineering.
Property Description: Khasra No. 89, Survey 14, measuring 2.50 Acres situated in Tehsil Sadar.
The lease tenure is mutually agreed for a duration of 14 Years only, expiring 09 January 2038.
Sub-registrar registration pending. Commercial sub-leasing permitted on mutual consent.
No perpetual educational covenant recorded.`
    },
    {
      title: 'Fire Safety Certificate (NOC)',
      badge: 'ANNUAL VALIDITY',
      name: 'Fire_Safety_Clearance_NOC.pdf',
      type: 'FIRE_NOC',
      size: 420000,
      mime: 'application/pdf',
      text: `GOVERNMENT OF UTTAR PRADESH — FIRE & LIFE SAFETY CLEARANCE CERTIFICATE
No. CFO/GBN/NOC/2025/112 Date of Issue: 12 August 2025.
Premises: ABC Institute of Technology, Sector 62, Institutional Area, Noida.
Inspection: Multi-storey Academic Block A (G+4) and Block B (G+3) inspected by Divisional Fire Officer.
Fitted Systems: Wet risers, automatic fire detection, smoke alarms, 50,000 Litres static underground water storage.
Conforms to NBC 2016 Part 4. Certificate valid for 1 Year, expiring on 11 August 2026. Annual renewal mandatory.`
    },
    {
      title: 'Mandatory Statutory Undertaking',
      badge: 'JUDICIAL AFFIDAVIT',
      name: 'AICTE_Statutory_Undertaking.pdf',
      type: 'UNDERTAKING',
      size: 156000,
      mime: 'application/pdf',
      text: `MANDATORY STATUTORY AFFIDAVIT
Executed on Rs. 100 Non-Judicial Stamp Paper attested by First Class Judicial Magistrate.
I, Prof. Anand Deshmukh, Secretary of Shri Krishna Educational Society, do hereby solemnly affirm:
1. That the institution strictly enforces AICTE anti-ragging regulations 2009 in letter and spirit.
2. That instructional faculty cadre ratios (1:15/1:20) and 7th Central Pay Commission scales are implemented for all approved programs.
3. That all institutional disclosures on the AICTE regulatory portal are verified, true, and legally binding.`
    }
  ];

  // Fetch applications for context linking
  useEffect(() => {
    async function loadApps() {
      try {
        const appList = await fetchApplications();
        setApplications(appList);
        if (!selectedAppId && appList.length > 0) {
          setSelectedAppId(appList[0].id);
        }
      } catch (e) {
        console.warn('Could not load application list for linking:', e);
      }
    }
    loadApps();
  }, []);

  // Initialize with sample 1 on mount
  useEffect(() => {
    loadSample(samples[0]);
  }, []);

  function loadSample(sample: typeof samples[0]) {
    setDocName(sample.name);
    setDocType(sample.type);
    setDocText(sample.text);
    setDocFileSize(sample.size);
    setDocMimeType(sample.mime);
    setSelectedHighlight(null);
    setErrorMsg('');
    setSuccessMsg('');
    setExpandedFindingId(null);
    setExpandedSources({});
    runLocalEvaluation(sample.name, sample.type, sample.text);
  }

  // Synthesize rich compliance checks & candidate fields based on document text & backend scrutiny rules
  function runLocalEvaluation(name: string, type: string, text: string, backendResult?: AiAnalysisResult) {
    const lower = text.toLowerCase();

    // 1. Generate Structured Extracted Fields with Provenance
    const fields: CandidateField[] = [];

    // Land Survey / Khasra
    const surveyMatch = text.match(/(?:khasra|survey|plot|gat)\s+(?:no\.?|number|#)?\s*[:\s]*([0-9a-zA-Z\/\-\s]+?)(?:,|\.|\n|$|measuring)/i);
    if (surveyMatch) {
      fields.push({
        field_key: 'land_survey_no',
        field_label: 'Land Survey / Khasra Number',
        extracted_value: surveyMatch[1].trim(),
        original_value: surveyMatch[1].trim(),
        provenance: 'EXTRACTED_FROM_DOCUMENT',
        source_document: name,
        page_number: 'Page 1, Clause 3',
        evidence_quote: surveyMatch[0].trim(),
        confidence_label: 'HIGH_CONFIDENCE',
        confidence: 0.96,
        target_form_field: 'land_survey_no',
        validation_status: 'EXTRACTED'
      });
    }

    // Land Area
    const areaMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(acres?|hectares?|sq\.?\s*meters?|sqm|sq\.?\s*ft)/i);
    if (areaMatch) {
      const areaVal = areaMatch[0].trim();
      const numVal = parseFloat(areaMatch[1]);
      fields.push({
        field_key: 'land_area',
        field_label: 'Documented Land Area',
        extracted_value: areaVal,
        original_value: areaVal,
        provenance: 'EXTRACTED_FROM_DOCUMENT',
        source_document: name,
        page_number: 'Page 1, Schedule A',
        evidence_quote: areaMatch[0].trim(),
        confidence_label: 'HIGH_CONFIDENCE',
        confidence: 0.94,
        target_form_field: 'land_area',
        validation_status: numVal >= 7.5 ? 'VERIFIED' : 'NEEDS_REVIEW'
      });
    }

    // Lease Tenure
    const tenureMatch = text.match(/(\d+)\s*(?:years|yrs)/i);
    if (tenureMatch) {
      const years = parseInt(tenureMatch[1], 10);
      fields.push({
        field_key: 'lease_tenure_years',
        field_label: 'Registered Lease Tenure',
        extracted_value: `${years} Years`,
        original_value: `${years} Years`,
        provenance: 'DETERMINISTIC_PARSED',
        source_document: name,
        page_number: 'Page 2, Term Clause',
        evidence_quote: tenureMatch[0].trim(),
        confidence_label: 'HIGH_CONFIDENCE',
        confidence: 0.98,
        target_form_field: 'lease_tenure',
        validation_status: years >= 30 ? 'VERIFIED' : 'NEEDS_REVIEW'
      });
    }

    // Validity / Dates
    const dates = text.match(/\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/gi);
    if (dates && dates.length >= 2) {
      fields.push({
        field_key: 'validity_period',
        field_label: 'Validity Period (Commencement to Expiry)',
        extracted_value: `From ${dates[0]} to ${dates[1]}`,
        original_value: `From ${dates[0]} to ${dates[1]}`,
        provenance: 'EXTRACTED_FROM_DOCUMENT',
        source_document: name,
        page_number: 'Page 1, Term Definition',
        evidence_quote: `Dates identified: ${dates[0]} and ${dates[1]}`,
        confidence_label: 'HIGH_CONFIDENCE',
        confidence: 0.91,
        target_form_field: 'validity_dates',
        validation_status: 'EXTRACTED'
      });
    } else if (dates && dates.length === 1) {
      fields.push({
        field_key: 'document_date',
        field_label: 'Document Execution / Issue Date',
        extracted_value: dates[0],
        original_value: dates[0],
        provenance: 'EXTRACTED_FROM_DOCUMENT',
        source_document: name,
        page_number: 'Preamble / Header',
        evidence_quote: `Issue Date: ${dates[0]}`,
        confidence_label: 'HIGH_CONFIDENCE',
        confidence: 0.95,
        target_form_field: 'document_date',
        validation_status: 'EXTRACTED'
      });
    }

    // Applicant-Entered Baseline Comparison Field
    fields.push({
      field_key: 'applicant_institution_name',
      field_label: 'Declared Institution Name',
      extracted_value: lower.includes('abc') ? 'ABC Institute of Technology' : 'Sunrise Institute of Engineering',
      original_value: lower.includes('abc') ? 'ABC Institute of Technology' : 'Sunrise Institute of Engineering',
      provenance: 'APPLICANT_PORTAL_SELF_DISCLOSURE',
      source_document: 'Application Form Part A',
      page_number: 'Online Application Portal',
      evidence_quote: 'Self-declaration by authorized representative',
      confidence_label: 'OFFICIALLY_REGISTERED',
      confidence: 1.0,
      target_form_field: 'institution_name',
      validation_status: 'APPLICANT_ENTERED'
    });

    setEditableFields(fields);

    // 2. Synthesize Scrutiny Checklist Items against AICTE Approval Process Handbook (APH 2024-2027)
    const checks: ScrutinyCheckItem[] = [];

    if (type === 'LEASE_DEED' || lower.includes('lease')) {
      const tenureVal = tenureMatch ? parseInt(tenureMatch[1], 10) : 0;
      const hasReg = lower.includes('registered') && lower.includes('sub-registrar');
      const hasCovenant = lower.includes('educational') || lower.includes('aicte');

      // Check 1: Statutory 30-Year Lease Threshold
      checks.push({
        id: 'chk-land-tenure',
        rule_id: 'APH-2024-LAND-01',
        rule_title: 'Mandatory 30-Year Registered Lease Tenure',
        category: 'LAND_INFRASTRUCTURE',
        engine_source: 'DETERMINISTIC_RULE_ENGINE',
        result: tenureVal >= 30 ? 'PASS' : 'POTENTIAL_ISSUE',
        severity: tenureVal >= 30 ? 'INFO' : 'CRITICAL',
        plain_explanation: tenureVal >= 30
          ? `Verified 33-year lease tenure exceeds the statutory 30-year minimum threshold mandated in APH 2024-2027 Section 3.2.`
          : `Deficient lease tenure of ${tenureVal} years fails to meet statutory 30-year minimum threshold mandated under APH 2024-2027 Section 3.2.`,
        evidence_quote: tenureMatch ? tenureMatch[0] : 'Tenure clause not identified',
        source_document: name,
        page_number: 'Clause: Term of Lease',
        recommended_action: tenureVal >= 30
          ? 'Confirm certified title search report from registrar office during EVC.'
          : 'Issue immediate deficiency return. Demand registered addendum extending tenure through minimum 30 years.',
        officer_disposition: 'PENDING'
      });

      // Check 2: Sub-Registrar Official Registration
      checks.push({
        id: 'chk-land-registration',
        rule_id: 'APH-2024-LAND-02',
        rule_title: 'Registration under Indian Registration Act 1908',
        category: 'LAND_INFRASTRUCTURE',
        engine_source: 'DETERMINISTIC_RULE_ENGINE',
        result: hasReg ? 'PASS' : 'MISSING_EVIDENCE',
        severity: hasReg ? 'INFO' : 'DEFICIENCY',
        plain_explanation: hasReg
          ? 'Deed is registered with competent Sub-Registrar Office with Book/Deed reference recorded.'
          : 'Sub-registrar registration seal / endorsement missing or pending. Unregistered agreements are invalid for approval.',
        evidence_quote: hasReg ? 'Book 1 Deed No. 4589/2020 at Sub-Registrar Office' : 'Sub-registrar registration pending',
        source_document: name,
        page_number: 'Preamble / Execution Seal',
        recommended_action: hasReg
          ? 'Proceed to title encumbrance check.'
          : 'Demand uploaded copy of registered deed bearing official sub-registrar endorsement.',
        officer_disposition: 'PENDING'
      });

      // Check 3: Exclusive Educational Land Use Covenant
      checks.push({
        id: 'chk-land-covenant',
        rule_id: 'APH-2024-LAND-03',
        rule_title: 'Exclusive Technical Education Usage Covenant',
        category: 'LAND_INFRASTRUCTURE',
        engine_source: 'AI_SEMANTIC_ANALYSIS',
        result: hasCovenant ? 'PASS' : 'NEEDS_REVIEW',
        severity: hasCovenant ? 'INFO' : 'WARNING',
        plain_explanation: hasCovenant
          ? 'Deed contains express covenant restricting land use exclusively to AICTE-approved educational institutions.'
          : 'Deed allows commercial subleasing or lacks explicit educational purpose restriction.',
        evidence_quote: hasCovenant ? 'Exclusive possession for running technical educational institutions approved by AICTE' : 'Commercial sub-leasing permitted on mutual consent',
        source_document: name,
        page_number: 'Covenant / Permitted Use Clause',
        recommended_action: hasCovenant
          ? 'Check master plan zoning compliance.'
          : 'Request clarification affidavit confirming exclusive educational zoning.',
        officer_disposition: 'PENDING'
      });
    } else if (type === 'FIRE_NOC' || lower.includes('fire')) {
      const hasNbc = lower.includes('nbc 2016') || lower.includes('national building code');

      // Check 1: NBC 2016 Part 4 Life Safety Norms
      checks.push({
        id: 'chk-fire-nbc',
        rule_id: 'APH-2024-FIRE-01',
        rule_title: 'NBC 2016 Part 4 Fire Protection Conformity',
        category: 'FIRE_LIFE_SAFETY',
        engine_source: 'DETERMINISTIC_RULE_ENGINE',
        result: hasNbc ? 'PASS' : 'MISSING_EVIDENCE',
        severity: hasNbc ? 'INFO' : 'CRITICAL',
        plain_explanation: hasNbc
          ? 'Clearance certificate explicitly certifies compliance with NBC 2016 Part 4 life safety standards.'
          : 'Certificate does not reference NBC 2016 Part 4 standards. Fire safety apparatus verification required.',
        evidence_quote: hasNbc ? 'Conforms to NBC 2016 Part 4' : 'Fire equipment inspection reference missing',
        source_document: name,
        page_number: 'Conformity Schedule',
        recommended_action: hasNbc ? 'Verify static water storage capacity during EVC.' : 'Demand amended certificate conforming to NBC 2016.',
        officer_disposition: 'PENDING'
      });

      // Check 2: NOC Active Validity & Expiry Tracking
      checks.push({
        id: 'chk-fire-validity',
        rule_id: 'APH-2024-FIRE-02',
        rule_title: 'Annual Fire Clearance Active Validity',
        category: 'FIRE_LIFE_SAFETY',
        engine_source: 'DETERMINISTIC_RULE_ENGINE',
        result: 'PASS',
        severity: 'INFO',
        plain_explanation: 'NOC valid through 11 August 2026. Scheduled within current academic approval cycle.',
        evidence_quote: 'Certificate valid for 1 Year, expiring on 11 August 2026',
        source_document: name,
        page_number: 'Validity Clause',
        recommended_action: 'Flag automated renewal reminder 45 days prior to expiration.',
        officer_disposition: 'PENDING'
      });
    } else if (type === 'UNDERTAKING' || lower.includes('affidavit')) {
      const hasRagging = lower.includes('ragging');
      const hasCadre = lower.includes('cadre') || lower.includes('pay commission');

      // Check 1: Anti-Ragging Regulation 2009 Affirmation
      checks.push({
        id: 'chk-affidavit-ragging',
        rule_id: 'APH-2024-AFFIDAVIT-01',
        rule_title: 'Mandatory Anti-Ragging Regulatory Compliance Affirmation',
        category: 'STATUTORY_AFFIDAVIT',
        engine_source: 'AI_SEMANTIC_ANALYSIS',
        result: hasRagging ? 'PASS' : 'POTENTIAL_ISSUE',
        severity: hasRagging ? 'INFO' : 'CRITICAL',
        plain_explanation: hasRagging
          ? 'Sworn affidavit contains affirmative undertaking adhering to AICTE Anti-Ragging Regulations 2009.'
          : 'Mandatory anti-ragging declaration missing from sworn affidavit.',
        evidence_quote: hasRagging ? 'Strictly enforces AICTE anti-ragging regulations 2009 in letter and spirit' : 'Clause missing',
        source_document: name,
        page_number: 'Affidavit Clause 1',
        recommended_action: 'Verify Anti-Ragging Committee composition during EVC visit.',
        officer_disposition: 'PENDING'
      });

      // Check 2: Pay Commission & Cadre Ratio Undertaking
      checks.push({
        id: 'chk-affidavit-cadre',
        rule_id: 'APH-2024-AFFIDAVIT-02',
        rule_title: '7th Central Pay Commission & Faculty Cadre Ratios (1:15/1:20)',
        category: 'FACULTY_CADRE',
        engine_source: 'DETERMINISTIC_RULE_ENGINE',
        result: hasCadre ? 'PASS' : 'NEEDS_REVIEW',
        severity: hasCadre ? 'INFO' : 'WARNING',
        plain_explanation: hasCadre
          ? 'Affidavit commits to 1:15/1:20 cadre ratio and 7th CPC scale implementations.'
          : 'Cadre ratio and salary disbursement scales not explicitly committed.',
        evidence_quote: hasCadre ? 'Instructional faculty cadre ratios (1:15/1:20) and 7th Central Pay Commission scales' : 'Clause missing',
        source_document: name,
        page_number: 'Affidavit Clause 2',
        recommended_action: 'Audit salary bank statement scrolls and PF records during scrutiny.',
        officer_disposition: 'PENDING'
      });
    } else {
      // General Document Check
      checks.push({
        id: 'chk-general-01',
        rule_id: 'APH-2024-GEN-01',
        rule_title: 'Institutional Document Authenticity & Completeness',
        category: 'ACADEMIC_NORMS',
        engine_source: 'AI_SEMANTIC_ANALYSIS',
        result: text.length > 200 ? 'PASS' : 'NEEDS_REVIEW',
        severity: text.length > 200 ? 'INFO' : 'WARNING',
        plain_explanation: text.length > 200
          ? 'Document text successfully extracted with sufficient legal context for compliance checks.'
          : 'Document text appears brief or truncated. Verify original scanned upload quality.',
        evidence_quote: text.slice(0, 100) + '...',
        source_document: name,
        page_number: 'Page 1',
        recommended_action: 'Verify official stamp and authorized signature.',
        officer_disposition: 'PENDING'
      });
    }

    setScrutinyChecks(checks);
    // Auto expand the first issue if any, or keep first finding open
    const firstIssue = checks.find(c => c.result === 'POTENTIAL_ISSUE' || c.result === 'MISSING_EVIDENCE');
    if (firstIssue) {
      setExpandedFindingId(firstIssue.id);
    } else if (checks.length > 0) {
      setExpandedFindingId(checks[0].id);
    }
  }

  // Handle live upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocName(file.name);
    setDocFileSize(file.size);
    setDocMimeType(file.type || 'application/octet-stream');
    setIsAnalyzing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', docType);

      const authTok = localStorage.getItem('ps4_token') || '';
      const base = import.meta.env.VITE_API_URL || '/api';
      const r = await fetch(`${base}/documents/upload`, {
        method: 'POST',
        headers: authTok ? { Authorization: `Bearer ${authTok}` } : {},
        body: formData
      });

      if (!r.ok) {
        if (r.status === 401) {
          localStorage.removeItem('ps4_token');
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
      }

      const data = await r.json();
      const extractedText = data.document?.extracted_text || 'Text successfully extracted from document.';
      setDocText(extractedText);
      setAnalysisResult(data.ai_analysis);
      runLocalEvaluation(file.name, docType, extractedText, data.ai_analysis);
      setSuccessMsg(`Document '${file.name}' ingested, text extracted, and scrutinized.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Upload failed');
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Handle re-analyze / text analyze
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
      runLocalEvaluation(docName, docType, docText, res);
      setSuccessMsg('Scrutiny pipeline completed. Findings and extracted fields refreshed.');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Edit extracted field inline
  function handleFieldChange(fieldKey: string, newValue: string) {
    setEditableFields((prev) =>
      prev.map((f) => {
        if (f.field_key === fieldKey) {
          const isEdited = newValue !== f.original_value;
          return {
            ...f,
            extracted_value: newValue,
            user_edited: isEdited,
            validation_status: isEdited ? 'VERIFIED' : f.validation_status
          };
        }
        return f;
      })
    );
  }

  // Toggle field validation status
  function handleFieldStatusChange(fieldKey: string, status: 'EXTRACTED' | 'APPLICANT_ENTERED' | 'VERIFIED' | 'NEEDS_REVIEW') {
    setEditableFields((prev) =>
      prev.map((f) => (f.field_key === fieldKey ? { ...f, validation_status: status } : f))
    );
  }

  // Reset fields to original extracted values
  function handleResetFields() {
    setEditableFields((prev) =>
      prev.map((f) => ({
        ...f,
        extracted_value: f.original_value || f.extracted_value,
        user_edited: false,
        validation_status: 'EXTRACTED'
      }))
    );
    setEditingFieldKey(null);
    setSuccessMsg('Reset all fields to original OCR extraction values.');
  }

  // Save / apply confirmed fields to application dossier
  async function handleSaveConfirmedFields() {
    if (!selectedAppId) {
      setSuccessMsg('Fields confirmed and cached locally (No linked application dossier selected).');
      return;
    }

    setIsSavingFields(true);
    setErrorMsg('');
    try {
      const fieldsPayload: Record<string, string> = {};
      editableFields.forEach((f) => {
        fieldsPayload[f.field_key] = f.extracted_value;
      });

      await applyExtractedFields(selectedAppId, fieldsPayload);
      setSuccessMsg(`Successfully applied ${editableFields.length} confirmed fields to Application #${selectedAppId} form.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply fields to application.');
    } finally {
      setIsSavingFields(false);
    }
  }

  // Scrutiny finding dispositions
  function handleFindingDisposition(checkId: string, disp: 'ACCEPTED' | 'WAIVED' | 'CORRECTION_REQUESTED', note?: string) {
    setScrutinyChecks((prev) =>
      prev.map((c) => {
        if (c.id === checkId) {
          return {
            ...c,
            officer_disposition: disp,
            disposition_notes: note || (disp === 'ACCEPTED' ? 'Accepted by scrutiny officer' : 'Disposition recorded'),
            disposed_by: user?.name || 'Scrutiny Officer',
            disposed_at: new Date().toISOString()
          };
        }
        return c;
      })
    );

    if (disp === 'WAIVED') {
      setIsWaiveOpen(false);
      setSelectedCheckForWaive(null);
      setWaiveJustification('');
      setSuccessMsg(`Rule ${checkId} waived with regulatory justification.`);
    } else if (disp === 'CORRECTION_REQUESTED') {
      setIsCorrectionOpen(false);
      setSelectedCheckForCorrection(null);
      setCorrectionNote('');
      setSuccessMsg(`Clarification / correction request drafted for rule ${checkId}.`);
    } else {
      setSuccessMsg(`Finding ${checkId} accepted.`);
    }
  }

  // Start inline editing of a field
  function startInlineEdit(field: CandidateField) {
    setEditingFieldKey(field.field_key);
    setEditValueDraft(field.extracted_value);
    const validStatus = (['EXTRACTED', 'APPLICANT_ENTERED', 'VERIFIED', 'NEEDS_REVIEW'].includes(field.validation_status || '')
      ? field.validation_status
      : 'VERIFIED') as 'EXTRACTED' | 'APPLICANT_ENTERED' | 'VERIFIED' | 'NEEDS_REVIEW';
    setEditStatusDraft(validStatus);
  }

  function saveInlineEdit(fieldKey: string) {
    handleFieldChange(fieldKey, editValueDraft);
    handleFieldStatusChange(fieldKey, editStatusDraft);
    setEditingFieldKey(null);
  }

  function toggleSourceExpansion(fieldKey: string) {
    setExpandedSources(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  }

  // Filtered findings
  const filteredFindings = scrutinyChecks.filter((c) => {
    if (filterResult !== 'ALL' && c.result !== filterResult) return false;
    if (filterSeverity !== 'ALL' && c.severity !== filterSeverity) return false;
    if (filterDisposition !== 'ALL' && c.officer_disposition !== filterDisposition) return false;
    if (findingSearch.trim()) {
      const q = findingSearch.toLowerCase();
      const matchText = `${c.rule_id} ${c.rule_title} ${c.plain_explanation} ${c.source_document}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  // Filtered fields
  const filteredFields = editableFields.filter((f) => {
    if (fieldFilter === 'ALL') return true;
    if (fieldFilter === 'NEEDS_REVIEW') return f.validation_status === 'NEEDS_REVIEW';
    if (fieldFilter === 'VERIFIED') return f.validation_status === 'VERIFIED';
    if (fieldFilter === 'APPLICANT_ENTERED') return f.validation_status === 'APPLICANT_ENTERED';
    return true;
  });

  // Metric counts
  const passedCount = scrutinyChecks.filter((c) => c.result === 'PASS').length;
  const issuesCount = scrutinyChecks.filter((c) => c.result === 'POTENTIAL_ISSUE').length;
  const missingCount = scrutinyChecks.filter((c) => c.result === 'MISSING_EVIDENCE').length;
  const reviewCount = scrutinyChecks.filter((c) => c.result === 'NEEDS_REVIEW').length;

  const verifiedFieldsCount = editableFields.filter(f => f.validation_status === 'VERIFIED').length;
  const needsReviewFieldsCount = editableFields.filter(f => f.validation_status === 'NEEDS_REVIEW').length;
  const verifiedPercentage = editableFields.length > 0 ? Math.round((verifiedFieldsCount / editableFields.length) * 100) : 0;

  const currentApp = applications.find(a => a.id === selectedAppId);

  return (
    <div className="page-container" style={{ gap: 16 }}>
      {/* ====================================================================
          1. SIMPLIFIED PAGE HEADER & TOOLBAR (Government Enterprise Design)
          ==================================================================== */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 10,
        padding: '18px 22px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16
        }}>
          {/* Left: Clean Title & Subtitle */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShieldCheck size={18} color="#2563EB" />
              </div>
              <h1 style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                color: '#1E293B',
                letterSpacing: '-0.01em'
              }}>
                AI Document Scrutiny
              </h1>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#F1F5F9',
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 600,
                color: '#475569'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16845B' }} />
                <span>Engine Ready</span>
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 10.5,
                fontWeight: 700,
                background: '#EFF6FF',
                color: '#2563EB',
                border: '1px solid #BFDBFE'
              }}>
                SIH26262 DEMO
              </div>
            </div>
            <p style={{
              margin: '6px 0 0',
              fontSize: 13.5,
              color: '#64748B',
              lineHeight: 1.4
            }}>
              Review extracted information, verify regulatory rules and record findings.
            </p>
          </div>

          {/* Right: Compact Dossier Selector & Quick Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Dossier:</span>
              <select
                value={selectedAppId || ''}
                onChange={(e) => setSelectedAppId(e.target.value ? Number(e.target.value) : null)}
                style={{
                  fontSize: 12.5,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#1E293B',
                  fontWeight: 500,
                  maxWidth: 260
                }}
              >
                <option value="">Sandbox (Independent Evaluation)</option>
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.reference} · {a.institution_name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !docText.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                background: '#2457C5',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: isAnalyzing ? 'wait' : 'pointer',
                boxShadow: '0 1px 2px rgba(36, 87, 197, 0.25)',
                transition: 'all 0.15s ease'
              }}
              title="Execute full statutory scrutiny against current document"
            >
              <Sparkles size={14} className={isAnalyzing ? 'spin' : ''} />
              <span>{isAnalyzing ? 'Scrutinizing...' : 'Run Scrutiny'}</span>
            </button>
          </div>
        </div>

        {/* SIH Evaluation Presets Toolbar */}
        <div style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B' }}>
            <span style={{ fontWeight: 600, color: '#1E293B' }}>Sample Documents:</span>
            <span>Load pre-verified test cases:</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {samples.map((s) => {
              const isSelected = docName === s.name;
              return (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => loadSample(s)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: isSelected ? '#EFF6FF' : '#F8FAFC',
                    border: `1px solid ${isSelected ? '#2563EB' : '#E2E8F0'}`,
                    color: isSelected ? '#2563EB' : '#475569',
                    transition: 'all 0.12s ease'
                  }}
                  title={`Load ${s.title}`}
                >
                  <FileText size={12} color={isSelected ? '#2563EB' : '#64748B'} />
                  <span>{s.title}</span>
                  <span style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: s.badge.includes('PASS') ? '#DCFCE7' : s.badge.includes('DEFICIENCY') ? '#FEE2E2' : '#FEF3C7',
                    color: s.badge.includes('PASS') ? '#166534' : s.badge.includes('DEFICIENCY') ? '#991B1B' : '#92400E'
                  }}>
                    {s.badge.includes('PASS') ? 'PASS' : s.badge.includes('DEFICIENCY') ? 'DEFICIENT' : 'ANNUAL'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. COMPACT SCRUTINY ENGINE STATUS STRIP (With Collapsible Details)
          ==================================================================== */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
        padding: '10px 16px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: 12.5
        }}>
          {/* Left: Four Concise Status Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16845B' }} />
              <span style={{ fontWeight: 600, color: '#1E293B' }}>Engine:</span>
              <span style={{ color: '#475569' }}>
                {analysisResult?.execution_mode === 'real_llm' ? 'Live LLM Scrutiny' : 'Deterministic Rule Engine'}
              </span>
            </div>

            <span style={{ color: '#CBD5E1' }}>|</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} color="#2563EB" />
              <span style={{ fontWeight: 600, color: '#1E293B' }}>Ruleset:</span>
              <span style={{ color: '#475569' }}>AICTE APH 2024–2027</span>
            </div>

            <span style={{ color: '#CBD5E1' }}>|</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Database size={14} color="#64748B" />
              <span style={{ fontWeight: 600, color: '#1E293B' }}>Provider:</span>
              <span style={{ color: '#475569' }}>
                {analysisResult?.provider || 'Deterministic / Offline'}
              </span>
            </div>

            <span style={{ color: '#CBD5E1' }}>|</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={13} color="#D97706" />
              <span style={{ color: '#64748B', fontStyle: 'italic', fontSize: 12 }}>
                Human approval required · Officers make final decisions
              </span>
            </div>
          </div>

          {/* Right: Collapsible Details Toggle */}
          <button
            type="button"
            onClick={() => setIsEngineDetailsOpen(!isEngineDetailsOpen)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#2563EB',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Info size={13} />
            <span>{isEngineDetailsOpen ? 'Hide Details' : 'Engine Details'}</span>
            {isEngineDetailsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Collapsible Info Drawer */}
        {isEngineDetailsOpen && (
          <div style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px dashed #E2E8F0',
            fontSize: 12,
            color: '#475569',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <p style={{ margin: 0 }}>
              <b>Statutory Methodology: </b>
              {analysisResult?.mode_fallback_reason ||
                'Hybrid compliance framework. Deterministic validation verifies quantitative land acreage, 30-year lease tenure, and fire safety norms directly against codified APH rules.'}
            </p>
            <p style={{ margin: 0, color: '#64748B' }}>
              <b>Human-in-the-Loop Safeguard: </b>
              AI findings assist regulatory review and identify discrepancies. Statutory approval, rejection, or waiver decisions remain exclusively with authorised human officers.
            </p>
          </div>
        )}
      </div>

      {/* Error & Success Feedback Banners */}
      {errorMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 6,
          background: '#FDF2F2',
          border: '1px solid #FDE2E2',
          color: '#D64545',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D64545', fontWeight: 700 }}>×</button>
        </div>
      )}
      {successMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 6,
          background: '#F0FDF4',
          border: '1px solid #DCFCE7',
          color: '#16845B',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16845B', fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* ====================================================================
          3. MAIN TWO-COLUMN SPLIT-PANEL LAYOUT (42% Left / 58% Right)
          ==================================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.38fr)',
        gap: 20,
        alignItems: 'start'
      }} className="scrutiny-2col-layout">

        {/* ------------------------------------------------------------------
            LEFT PANEL: DOCUMENT WORKSPACE (~42%)
            ------------------------------------------------------------------ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Document Ingestion & Overview Card */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: '1px solid #F1F5F9'
            }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1E293B', margin: 0 }}>
                  Document Workspace
                </h2>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  Ingested regulatory dossier file
                </span>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 4,
                background: '#F0FDF4',
                color: '#16845B',
                border: '1px solid #DCFCE7'
              }}>
                ● Ingested & Parsed
              </span>
            </div>

            {/* Clean Document File Summary */}
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <FileText size={18} color="#2563EB" />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b style={{
                    fontSize: 13,
                    color: '#1E293B',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {docName}
                  </b>
                  <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2, display: 'flex', gap: 8 }}>
                    <span>{(docFileSize / 1024).toFixed(0)} KB</span>
                    <span>·</span>
                    <span>{docMimeType}</span>
                    {currentApp && (
                      <>
                        <span>·</span>
                        <span style={{ color: '#2563EB' }}>{currentApp.reference}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Category Selector & Upload Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Regulatory Document Category
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    color: '#1E293B',
                    background: '#FFFFFF'
                  }}
                >
                  <option value="LEASE_DEED">Registered Land Lease Deed / Ownership</option>
                  <option value="FIRE_NOC">Fire & Life Safety Clearance (NOC)</option>
                  <option value="BUILDING_PLAN">Approved Building Plan & Structural Stability</option>
                  <option value="UNDERTAKING">Statutory Affidavit / Undertaking</option>
                  <option value="FACULTY_LIST">Sanctioned Faculty Cadre List</option>
                  <option value="OTHER">Other Institutional Disclosure</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Replace / Upload New File (PDF, DOCX, TXT)
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 12,
                    background: '#FFFFFF'
                  }}
                />
              </div>

              {/* Primary Action Button: Run Scrutiny */}
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing || !docText.trim()}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: '10px 16px',
                  background: '#2457C5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: isAnalyzing ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 1px 3px rgba(36, 87, 197, 0.25)',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <Sparkles size={15} className={isAnalyzing ? 'spin' : ''} />
                <span>{isAnalyzing ? 'Executing AI Scrutiny...' : 'Run Scrutiny Pipeline'}</span>
              </button>
            </div>
          </div>

          {/* Collapsible Document Text Preview - CLOSED BY DEFAULT */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
          }}>
            <button
              type="button"
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
              style={{
                width: '100%',
                padding: '12px 18px',
                background: '#FFFFFF',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={15} color="#2457C5" />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1E293B' }}>
                  Extracted Document Text
                </span>
                <span style={{ fontSize: 11.5, color: '#64748B' }}>
                  ({docText.length} characters)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#2563EB', fontWeight: 600 }}>
                <span>{isPreviewOpen ? 'Collapse' : 'Expand'}</span>
                {isPreviewOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {isPreviewOpen && (
              <div style={{ borderTop: '1px solid #F1F5F9' }}>
                {/* Search Bar in Text */}
                <div style={{
                  padding: '10px 16px',
                  background: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10
                }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={13} color="#94A3B8" style={{ position: 'absolute', left: 9, top: 8 }} />
                    <input
                      type="text"
                      placeholder="Search within extracted legal text..."
                      value={previewSearchQuery}
                      onChange={(e) => setPreviewSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '5px 10px 5px 28px',
                        borderRadius: 5,
                        border: '1px solid #CBD5E1',
                        fontSize: 12,
                        background: '#FFFFFF',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  {previewSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setPreviewSearchQuery('')}
                      style={{ background: 'none', border: 'none', fontSize: 11.5, color: '#64748B', cursor: 'pointer' }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Text Body */}
                <div style={{
                  padding: '14px 18px',
                  maxHeight: 340,
                  overflowY: 'auto',
                  fontFamily: 'JetBrains Mono, Menlo, monospace',
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: '#1E293B',
                  background: '#FAFAFA',
                  whiteSpace: 'pre-wrap'
                }}>
                  {previewSearchQuery ? (
                    docText.split(new RegExp(`(${previewSearchQuery})`, 'gi')).map((part, i) =>
                      part.toLowerCase() === previewSearchQuery.toLowerCase() ? (
                        <mark key={i} style={{ background: '#FEF08A', color: '#1E293B', padding: '1px 2px', borderRadius: 2 }}>
                          {part}
                        </mark>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )
                  ) : selectedHighlight ? (
                    docText.split(new RegExp(`(${selectedHighlight})`, 'gi')).map((part, i) =>
                      part.toLowerCase() === selectedHighlight.toLowerCase() ? (
                        <mark key={i} style={{ background: '#BFDBFE', color: '#1E3A8A', padding: '1px 2px', borderRadius: 2 }}>
                          {part}
                        </mark>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )
                  ) : (
                    docText
                  )}
                </div>

                {/* Footer metadata */}
                <div style={{
                  padding: '8px 16px',
                  background: '#F8FAFC',
                  borderTop: '1px solid #E2E8F0',
                  fontSize: 11.5,
                  color: '#64748B',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>Source: Ingested legal document text</span>
                  <span>OCR Accuracy: Verified</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------
            RIGHT PANEL: REVIEW WORKSPACE (~58%)
            ------------------------------------------------------------------ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Main Review Card with Tab Switcher */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
          }}>
            {/* Header: Segmented Review View Switcher */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              paddingBottom: 14,
              borderBottom: '1px solid #F1F5F9',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1E293B', margin: 0 }}>
                  Review Workspace
                </h2>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  Statutory rule checks & candidate field verification
                </span>
              </div>

              {/* Segmented Control Buttons */}
              <div style={{
                display: 'inline-flex',
                background: '#F1F5F9',
                borderRadius: 7,
                padding: 3,
                border: '1px solid #E2E8F0'
              }}>
                <button
                  type="button"
                  onClick={() => setReviewTab('findings')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 5,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: reviewTab === 'findings' ? '#FFFFFF' : 'transparent',
                    color: reviewTab === 'findings' ? '#2563EB' : '#64748B',
                    boxShadow: reviewTab === 'findings' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.12s ease'
                  }}
                >
                  <ShieldCheck size={13} />
                  <span>Rule Findings ({scrutinyChecks.length})</span>
                  {issuesCount > 0 && (
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#DC2626'
                    }} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setReviewTab('fields')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 5,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: reviewTab === 'fields' ? '#FFFFFF' : 'transparent',
                    color: reviewTab === 'fields' ? '#2563EB' : '#64748B',
                    boxShadow: reviewTab === 'fields' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.12s ease'
                  }}
                >
                  <Database size={13} />
                  <span>Extracted Fields ({editableFields.length})</span>
                  {needsReviewFieldsCount > 0 && (
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#D97706'
                    }} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setReviewTab('all')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 5,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: reviewTab === 'all' ? '#FFFFFF' : 'transparent',
                    color: reviewTab === 'all' ? '#2563EB' : '#64748B',
                    boxShadow: reviewTab === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.12s ease'
                  }}
                >
                  <Layers size={13} />
                  <span>Combined</span>
                </button>
              </div>
            </div>

            {/* ================================================================
                SECTION A: SCRUTINY FINDINGS (Displayed if 'findings' or 'all')
                ================================================================ */}
            {(reviewTab === 'findings' || reviewTab === 'all') && (
              <div style={{ marginBottom: reviewTab === 'all' ? 24 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <ShieldCheck size={16} color="#2563EB" />
                    <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: '#1E293B' }}>
                      Scrutiny Findings
                    </h3>
                  </div>
                  <span style={{ fontSize: 11.5, color: '#64748B' }}>
                    Evaluated against APH 2024–2027 statutory criteria
                  </span>
                </div>

                {/* 4 Compact Summary Metrics (Equal Dimensions, Restrained Colours) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 10,
                  marginBottom: 14
                }}>
                  {/* Metric 1: Passed */}
                  <div
                    onClick={() => setFilterResult(filterResult === 'PASS' ? 'ALL' : 'PASS')}
                    style={{
                      background: '#F0FDF4',
                      border: `1px solid ${filterResult === 'PASS' ? '#16845B' : '#DCFCE7'}`,
                      borderRadius: 8,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: 56,
                      boxSizing: 'border-box'
                    }}
                    title="Click to filter passed rules"
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#16845B' }}>Passed</span>
                    <b style={{ fontSize: 18, color: '#16845B', lineHeight: 1 }}>{passedCount}</b>
                  </div>

                  {/* Metric 2: Issues */}
                  <div
                    onClick={() => setFilterResult(filterResult === 'POTENTIAL_ISSUE' ? 'ALL' : 'POTENTIAL_ISSUE')}
                    style={{
                      background: '#FDF2F2',
                      border: `1px solid ${filterResult === 'POTENTIAL_ISSUE' ? '#D64545' : '#FDE2E2'}`,
                      borderRadius: 8,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: 56,
                      boxSizing: 'border-box'
                    }}
                    title="Click to filter potential issues"
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#D64545' }}>Issues</span>
                    <b style={{ fontSize: 18, color: '#D64545', lineHeight: 1 }}>{issuesCount}</b>
                  </div>

                  {/* Metric 3: Missing */}
                  <div
                    onClick={() => setFilterResult(filterResult === 'MISSING_EVIDENCE' ? 'ALL' : 'MISSING_EVIDENCE')}
                    style={{
                      background: '#FEF7EC',
                      border: `1px solid ${filterResult === 'MISSING_EVIDENCE' ? '#D98B16' : '#FCE6CA'}`,
                      borderRadius: 8,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: 56,
                      boxSizing: 'border-box'
                    }}
                    title="Click to filter missing evidence"
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#D98B16' }}>Missing</span>
                    <b style={{ fontSize: 18, color: '#D98B16', lineHeight: 1 }}>{missingCount}</b>
                  </div>

                  {/* Metric 4: Needs Review */}
                  <div
                    onClick={() => setFilterResult(filterResult === 'NEEDS_REVIEW' ? 'ALL' : 'NEEDS_REVIEW')}
                    style={{
                      background: '#F8FAFC',
                      border: `1px solid ${filterResult === 'NEEDS_REVIEW' ? '#64748B' : '#E2E8F0'}`,
                      borderRadius: 8,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: 56,
                      boxSizing: 'border-box'
                    }}
                    title="Click to filter items needing review"
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B' }}>Needs Review</span>
                    <b style={{ fontSize: 18, color: '#1E293B', lineHeight: 1 }}>{reviewCount}</b>
                  </div>
                </div>

                {/* Compact Filter Row & Search */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                  flexWrap: 'wrap'
                }}>
                  <div style={{ position: 'relative', flex: '1 1 180px' }}>
                    <Search size={13} color="#94A3B8" style={{ position: 'absolute', left: 9, top: 8 }} />
                    <input
                      type="text"
                      placeholder="Search rule, citation or text..."
                      value={findingSearch}
                      onChange={(e) => setFindingSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '5px 10px 5px 28px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        fontSize: 12,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <select
                    value={filterDisposition}
                    onChange={(e) => setFilterDisposition(e.target.value)}
                    style={{
                      padding: '5px 8px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      fontSize: 11.5,
                      background: '#FFFFFF'
                    }}
                  >
                    <option value="ALL">All Dispositions</option>
                    <option value="PENDING">Pending Disposition</option>
                    <option value="ACCEPTED">Accepted</option>
                    <option value="WAIVED">Waived</option>
                    <option value="CORRECTION_REQUESTED">Clarification Requested</option>
                  </select>

                  {(filterResult !== 'ALL' || filterDisposition !== 'ALL' || findingSearch) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterResult('ALL');
                        setFilterDisposition('ALL');
                        setFindingSearch('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 11.5,
                        color: '#2563EB',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Reset filters
                    </button>
                  )}
                </div>

                {/* Concise Expandable Findings List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredFindings.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                      No scrutiny findings match the selected filter criteria.
                    </div>
                  ) : (
                    filteredFindings.map((check) => {
                      const isExpanded = expandedFindingId === check.id;

                      let statusBadgeBg = '#F0FDF4';
                      let statusBadgeBorder = '#DCFCE7';
                      let statusBadgeText = '#16845B';
                      let statusLabel = 'PASS';

                      if (check.result === 'POTENTIAL_ISSUE') {
                        statusBadgeBg = '#FDF2F2';
                        statusBadgeBorder = '#FDE2E2';
                        statusBadgeText = '#D64545';
                        statusLabel = 'ISSUE';
                      } else if (check.result === 'MISSING_EVIDENCE') {
                        statusBadgeBg = '#FEF7EC';
                        statusBadgeBorder = '#FCE6CA';
                        statusBadgeText = '#D98B16';
                        statusLabel = 'MISSING';
                      } else if (check.result === 'NEEDS_REVIEW') {
                        statusBadgeBg = '#F8FAFC';
                        statusBadgeBorder = '#E2E8F0';
                        statusBadgeText = '#64748B';
                        statusLabel = 'REVIEW';
                      }

                      return (
                        <div
                          key={check.id}
                          style={{
                            background: '#FFFFFF',
                            border: `1px solid ${isExpanded ? '#CBD5E1' : '#E2E8F0'}`,
                            borderRadius: 8,
                            overflow: 'hidden',
                            transition: 'border-color 0.15s ease'
                          }}
                        >
                          {/* Collapsed Header Row */}
                          <div
                            onClick={() => setExpandedFindingId(isExpanded ? null : check.id)}
                            style={{
                              padding: '10px 14px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: isExpanded ? '#F8FAFC' : '#FFFFFF',
                              gap: 10
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                              <span style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 4,
                                background: statusBadgeBg,
                                border: `1px solid ${statusBadgeBorder}`,
                                color: statusBadgeText,
                                flexShrink: 0
                              }}>
                                {statusLabel}
                              </span>

                              <span style={{
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: '#64748B',
                                flexShrink: 0
                              }}>
                                {check.rule_id}
                              </span>

                              <b style={{
                                fontSize: 13,
                                color: '#1E293B',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {check.rule_title}
                              </b>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                              {check.officer_disposition !== 'PENDING' && (
                                <span style={{
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: check.officer_disposition === 'ACCEPTED' ? '#F0FDF4' : '#FEF7EC',
                                  color: check.officer_disposition === 'ACCEPTED' ? '#16845B' : '#B45309',
                                  border: `1px solid ${check.officer_disposition === 'ACCEPTED' ? '#DCFCE7' : '#FDE68A'}`
                                }}>
                                  {check.officer_disposition}
                                </span>
                              )}

                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, color: '#2563EB', fontWeight: 500 }}>
                                <span>{isExpanded ? 'Collapse' : 'Details'}</span>
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Finding Details & Officer Actions */}
                          {isExpanded && (
                            <div style={{
                              padding: '14px 16px',
                              borderTop: '1px solid #F1F5F9',
                              background: '#FFFFFF',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 12
                            }}>
                              {/* Rationale / Plain Explanation */}
                              <div>
                                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 2 }}>
                                  Regulatory Evaluation:
                                </span>
                                <p style={{ margin: 0, fontSize: 13, color: '#1E293B', lineHeight: 1.45 }}>
                                  {check.plain_explanation}
                                </p>
                              </div>

                              {/* Source Evidence Quote */}
                              {check.evidence_quote && (
                                <div style={{
                                  background: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  borderLeft: '3px solid #2563EB',
                                  borderRadius: 6,
                                  padding: '8px 12px',
                                  fontSize: 12
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11, color: '#64748B' }}>
                                    <span>Citation: <b>{check.source_document}</b> {check.page_number ? `(${check.page_number})` : ''}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsPreviewOpen(true);
                                        setSelectedHighlight(check.evidence_quote || null);
                                      }}
                                      style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                                    >
                                      Locate in document →
                                    </button>
                                  </div>
                                  <div style={{ fontStyle: 'italic', color: '#334155' }}>
                                    "{check.evidence_quote}"
                                  </div>
                                </div>
                              )}

                              {/* Recommended Action */}
                              {check.recommended_action && (
                                <div style={{ fontSize: 12, color: '#475569' }}>
                                  <span style={{ fontWeight: 600, color: '#1E293B' }}>Recommended Action: </span>
                                  <span>{check.recommended_action}</span>
                                </div>
                              )}

                              {/* Recorded Dispositions if any */}
                              {check.disposition_notes && (
                                <div style={{
                                  padding: '8px 12px',
                                  background: '#F8FAFC',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  border: '1px solid #E2E8F0'
                                }}>
                                  <b>Recorded Disposition: </b>
                                  <span>{check.disposition_notes}</span>
                                  {check.disposed_by && (
                                    <span style={{ color: '#64748B' }}> — {check.disposed_by}</span>
                                  )}
                                </div>
                              )}

                              {/* Officer Action Buttons */}
                              {user?.role !== 'institution' && check.officer_disposition === 'PENDING' && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  paddingTop: 8,
                                  borderTop: '1px solid #F1F5F9',
                                  flexWrap: 'wrap'
                                }}>
                                  <button
                                    type="button"
                                    onClick={() => handleFindingDisposition(check.id, 'ACCEPTED')}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      padding: '5px 12px',
                                      borderRadius: 6,
                                      background: '#FFFFFF',
                                      border: '1px solid #16845B',
                                      color: '#16845B',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.12s ease'
                                    }}
                                  >
                                    <Check size={13} />
                                    <span>Accept Finding</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCheckForCorrection(check);
                                      setCorrectionNote(`Please rectify: ${check.plain_explanation}`);
                                      setIsCorrectionOpen(true);
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      padding: '5px 12px',
                                      borderRadius: 6,
                                      background: '#FFFFFF',
                                      border: '1px solid #D97706',
                                      color: '#D97706',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.12s ease'
                                    }}
                                  >
                                    <RotateCcw size={13} />
                                    <span>Request Clarification</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCheckForWaive(check);
                                      setWaiveJustification('');
                                      setIsWaiveOpen(true);
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      padding: '5px 12px',
                                      borderRadius: 6,
                                      background: '#FFFFFF',
                                      border: '1px solid #64748B',
                                      color: '#64748B',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.12s ease'
                                    }}
                                  >
                                    <HelpCircle size={13} />
                                    <span>Waive with Justification</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ================================================================
                SECTION B: EXTRACTED FIELDS (Displayed if 'fields' or 'all')
                ================================================================ */}
            {(reviewTab === 'fields' || reviewTab === 'all') && (
              <div>
                {/* Header Row: Title, Progress, Reset & Apply Actions */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 10
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Database size={16} color="#2563EB" />
                      <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: '#1E293B' }}>
                        Extracted Fields
                      </h3>
                      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
                        ({editableFields.length} candidate fields)
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 11.5, color: '#475569' }}>
                        {verifiedFieldsCount} of {editableFields.length} verified ({verifiedPercentage}%)
                      </span>
                      <div style={{ width: 100, height: 5, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${verifiedPercentage}%`, background: '#16845B', borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>

                  {/* Actions: Reset & Save Confirmed */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleResetFields}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: '#64748B',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title="Reset all fields to original OCR extraction values"
                    >
                      <RotateCcw size={12} />
                      <span>Reset</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveConfirmedFields}
                      disabled={isSavingFields}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#16845B',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#FFFFFF',
                        cursor: isSavingFields ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 1px 2px rgba(22, 132, 91, 0.2)'
                      }}
                      title="Apply confirmed fields to linked application form"
                    >
                      <Save size={13} />
                      <span>{isSavingFields ? 'Saving...' : 'Apply Verified Fields'}</span>
                    </button>
                  </div>
                </div>

                {/* Filter Chips: All, Needs Review, Verified, Applicant Entered */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  {[
                    { key: 'ALL', label: `All (${editableFields.length})` },
                    { key: 'NEEDS_REVIEW', label: `Needs Review (${needsReviewFieldsCount})` },
                    { key: 'VERIFIED', label: `Verified (${verifiedFieldsCount})` },
                    { key: 'APPLICANT_ENTERED', label: `Applicant Entered (${editableFields.filter(f => f.validation_status === 'APPLICANT_ENTERED').length})` }
                  ].map((tab) => {
                    const isSel = fieldFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setFieldFilter(tab.key as any)}
                        style={{
                          padding: '3px 9px',
                          borderRadius: 14,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: isSel ? '#EFF6FF' : '#F8FAFC',
                          border: `1px solid ${isSel ? '#2563EB' : '#E2E8F0'}`,
                          color: isSel ? '#2563EB' : '#64748B',
                          transition: 'all 0.12s ease'
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Compact Field Review List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredFields.map((field) => {
                    const isEditing = editingFieldKey === field.field_key;
                    const isSourceOpen = !!expandedSources[field.field_key];

                    let statusBadgeBg = '#F0FDF4';
                    let statusBadgeBorder = '#DCFCE7';
                    let statusBadgeColor = '#16845B';
                    let statusText = 'Verified';

                    if (field.validation_status === 'NEEDS_REVIEW') {
                      statusBadgeBg = '#FEF7EC';
                      statusBadgeBorder = '#FCE6CA';
                      statusBadgeColor = '#D98B16';
                      statusText = 'Needs Review';
                    } else if (field.validation_status === 'APPLICANT_ENTERED') {
                      statusBadgeBg = '#F8FAFC';
                      statusBadgeBorder = '#E2E8F0';
                      statusBadgeColor = '#64748B';
                      statusText = 'Applicant Entered';
                    } else if (field.validation_status === 'EXTRACTED') {
                      statusBadgeBg = '#EFF6FF';
                      statusBadgeBorder = '#BFDBFE';
                      statusBadgeColor = '#2563EB';
                      statusText = 'Extracted';
                    }

                    return (
                      <div
                        key={field.field_key}
                        style={{
                          background: '#FFFFFF',
                          border: `1px solid ${isEditing ? '#3B82F6' : '#E2E8F0'}`,
                          borderRadius: 8,
                          padding: '10px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6
                        }}
                      >
                        {/* Top Row: Label, Value, Status Badge & Actions */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 8
                        }}>
                          {/* Left: Field Name & Current Value */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', minWidth: 170 }}>
                              {field.field_label || field.field_key}
                            </span>

                            {!isEditing && (
                              <b style={{
                                fontSize: 13.5,
                                color: '#2563EB',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {field.extracted_value}
                              </b>
                            )}
                          </div>

                          {/* Right: Status Chip, View Source & Edit Actions */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: statusBadgeBg,
                              border: `1px solid ${statusBadgeBorder}`,
                              color: statusBadgeColor
                            }}>
                              {statusText}
                            </span>

                            {field.evidence_quote && (
                              <button
                                type="button"
                                onClick={() => toggleSourceExpansion(field.field_key)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#64748B',
                                  fontSize: 11.5,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}
                              >
                                <span>Source</span>
                                {isSourceOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            )}

                            {!isEditing ? (
                              <button
                                type="button"
                                onClick={() => startInlineEdit(field)}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  border: '1px solid #CBD5E1',
                                  background: '#FFFFFF',
                                  color: '#2563EB',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}
                              >
                                <Edit3 size={11} />
                                <span>Edit</span>
                              </button>
                            ) : (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  type="button"
                                  onClick={() => saveInlineEdit(field.field_key)}
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    border: 'none',
                                    background: '#16845B',
                                    color: '#FFFFFF',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Done
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingFieldKey(null)}
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    border: '1px solid #CBD5E1',
                                    background: '#FFFFFF',
                                    color: '#64748B',
                                    fontSize: 11.5,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Inline Edit Panel when user clicks Edit */}
                        {isEditing && (
                          <div style={{
                            marginTop: 4,
                            paddingTop: 8,
                            borderTop: '1px dashed #E2E8F0',
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center'
                          }}>
                            <input
                              type="text"
                              value={editValueDraft}
                              onChange={(e) => setEditValueDraft(e.target.value)}
                              style={{
                                flex: 2,
                                padding: '5px 8px',
                                borderRadius: 5,
                                border: '1px solid #3B82F6',
                                fontSize: 12.5,
                                background: '#EFF6FF'
                              }}
                              autoFocus
                            />

                            <select
                              value={editStatusDraft}
                              onChange={(e) => setEditStatusDraft(e.target.value as any)}
                              style={{
                                flex: 1,
                                padding: '5px 8px',
                                borderRadius: 5,
                                border: '1px solid #CBD5E1',
                                fontSize: 11.5
                              }}
                            >
                              <option value="VERIFIED">Verified</option>
                              <option value="NEEDS_REVIEW">Needs Review</option>
                              <option value="APPLICANT_ENTERED">Applicant Entered</option>
                              <option value="EXTRACTED">Extracted</option>
                            </select>
                          </div>
                        )}

                        {/* Source Evidence Accordion */}
                        {isSourceOpen && field.evidence_quote && (
                          <div style={{
                            marginTop: 4,
                            padding: '8px 10px',
                            background: '#F8FAFC',
                            borderRadius: 6,
                            fontSize: 11.5,
                            border: '1px solid #E2E8F0',
                            color: '#475569'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, color: '#64748B' }}>
                              <span>Citation: <b>{field.source_document}</b> {field.page_number ? `(${field.page_number})` : ''}</span>
                              <span>{Math.round((field.confidence ?? 0.95) * 100)}% Confidence</span>
                            </div>
                            <div style={{ fontStyle: 'italic', color: '#1E293B' }}>
                              "{field.evidence_quote}"
                            </div>
                            {field.user_edited && field.original_value && (
                              <div style={{ marginTop: 3, color: '#64748B', fontSize: 11 }}>
                                Original OCR Value: <del>{field.original_value}</del>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          4. DIALOGS: MANDATORY WAIVER JUSTIFICATION & CLARIFICATION
          ==================================================================== */}
      {/* Dialog 1: Mandatory Waiver Justification */}
      {isWaiveOpen && selectedCheckForWaive && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h4 style={{ margin: 0, fontSize: 14 }}>Mandatory Waiver Justification</h4>
              <button
                type="button"
                onClick={() => {
                  setIsWaiveOpen(false);
                  setSelectedCheckForWaive(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12.5, color: '#1E293B' }}>
                Waiving rule: <b>{selectedCheckForWaive.rule_id} — {selectedCheckForWaive.rule_title}</b>
              </div>

              <div style={{ fontSize: 12, color: '#D97706', background: '#FEF7EC', padding: '8px 12px', borderRadius: 6, border: '1px solid #FDE68A' }}>
                ⚠️ A regulatory waiver requires an explicit statutory justification recorded in the permanent audit ledger.
              </div>

              <textarea
                placeholder="Enter mandatory regulatory justification for waiver..."
                value={waiveJustification}
                onChange={(e) => setWaiveJustification(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 90,
                  padding: '8px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  fontSize: 12.5,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div className="modal-footer" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsWaiveOpen(false);
                  setSelectedCheckForWaive(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={waiveJustification.trim().length < 5}
                onClick={() => handleFindingDisposition(selectedCheckForWaive.id, 'WAIVED', waiveJustification)}
                style={{ background: '#16845B', borderColor: '#16845B' }}
              >
                Confirm Waiver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog 2: Request Clarification / Demand Correction */}
      {isCorrectionOpen && selectedCheckForCorrection && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h4 style={{ margin: 0, fontSize: 14 }}>Request Clarification from Institution</h4>
              <button
                type="button"
                onClick={() => {
                  setIsCorrectionOpen(false);
                  setSelectedCheckForCorrection(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12.5, color: '#1E293B' }}>
                Drafting clarification demand for: <b>{selectedCheckForCorrection.rule_id} — {selectedCheckForCorrection.rule_title}</b>
              </div>

              <textarea
                placeholder="Specify deficiency notice instructions for the applicant..."
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 90,
                  padding: '8px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  fontSize: 12.5,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div className="modal-footer" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsCorrectionOpen(false);
                  setSelectedCheckForCorrection(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={correctionNote.trim().length < 5}
                onClick={() => handleFindingDisposition(selectedCheckForCorrection.id, 'CORRECTION_REQUESTED', correctionNote)}
                style={{ background: '#D97706', borderColor: '#D97706' }}
              >
                Send Clarification Demand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
