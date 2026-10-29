import { LucideIcon } from 'lucide-react';

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'institution' | 'officer' | 'bureau' | 'evc_expert' | 'admin';
  institution_name?: string | null;
  region: string;
  designation: string;
}

export interface Application {
  id: number;
  reference: string;
  institution_name: string;
  application_type: string;
  current_stage: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'RETURNED' | 'OVERDUE' | 'COMPLETED' | 'REJECTED';
  assigned_to: string;
  assigned_role: string;
  region: string;
  submission_date: string;
  due_date?: string | null;
  notes: string;
  deficiency_count: number;
  academic_year: string;
  form_data?: string | null;
  decision_outcome?: string | null;
  decision_remarks?: string | null;
  decision_by?: string | null;
  decision_date?: string | null;
  created_at: string;
  created_by?: number | null;
  next_action?: NextBestAction | null;
}

export interface CandidateField {
  field_key: string;
  field_label: string;
  label?: string;
  extracted_value: string;
  original_value?: string;
  provenance: string;
  source_document: string;
  page_number?: number | string | null;
  evidence_quote?: string | null;
  confidence_label?: 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'NEEDS_VERIFICATION' | 'OFFICIALLY_REGISTERED' | string;
  confidence?: number;
  target_form_field: string;
  validation_status?: string;
  user_edited?: boolean;
}

export interface NextBestAction {
  action_code: string;
  action_label: string;
  target_role: string;
  authorized_role?: string;
  assigned_to: string;
  reason: string;
  rationale?: string;
  urgency: 'NORMAL' | 'APPROACHING_DEADLINE' | 'OVERDUE';
  sla_urgency?: string;
}

export interface AuditEvent {
  id: number;
  application_id: number;
  application_reference?: string;
  actor: string;
  actor_role: string;
  action: string;
  from_stage?: string | null;
  to_stage?: string | null;
  details: string;
  prev_hash?: string | null;
  event_hash?: string | null;
  created_at: string;
}

export interface CorrectionRequest {
  id?: number;
  source?: string;
  reason: string;
  document_id?: number | null;
  document_name?: string | null;
  deficiencies_json?: string | null;
  status?: string;
  institution_response?: string | null;
  response_submitted_at?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  created_at: string;
}

export interface ScrutinyFinding {
  id: number;
  scrutiny_run_id?: number | null;
  application_id: number;
  document_id?: number | null;
  rule_id: string;
  document_type: string;
  severity: 'INFO' | 'WARNING' | 'DEFICIENCY';
  category: string;
  description: string;
  evidence_quote?: string | null;
  source_document?: string | null;
  page_number?: number | null;
  expected_requirement?: string | null;
  observed_value?: string | null;
  suggested_action?: string | null;
  is_provisional: boolean;
  source_reference?: string | null;
  officer_disposition: 'PENDING' | 'ACCEPTED' | 'WAIVED' | 'CORRECTION_REQUESTED' | 'REJECTED';
  disposition_notes?: string | null;
  disposed_by?: string | null;
  disposed_at?: string | null;
  created_at: string;
}

export interface ScrutinyRun {
  id: number;
  application_id: number;
  run_type: string;
  conducted_by: string;
  status: string;
  summary: string;
  missing_docs?: string | null;
  rule_results?: any;
  ai_assisted: boolean;
  model_provider?: string | null;
  model_name?: string | null;
  ruleset_version?: string | null;
  created_at: string;
}

export interface DocumentRecord {
  id: number;
  application_id?: number | null;
  institution_name: string;
  document_name: string;
  document_type: string;
  file_path?: string | null;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  version: number;
  is_latest: boolean;
  file_hash?: string | null;
  processing_status: string;
  extracted_text?: string;
  ai_summary?: string | null;
  ai_findings?: string | null;
  ai_confidence?: number | null;
  review_status: 'PENDING' | 'ACCEPTED' | 'CORRECTION_REQUIRED';
  reviewer_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface InspectionEvidence {
  id: number;
  visit_id: number;
  application_id: number;
  evidence_type: string;
  file_name: string;
  file_path: string;
  file_hash: string;
  file_size: number;
  uploaded_by: string;
  remarks?: string | null;
  created_at: string;
}

export interface RegulatoryCategory {
  id: number;
  category_code: string;
  title: string;
  institution_type: string;
  description: string;
  required_documents_json: string;
  workflow_sequence_json: string;
  sla_days: number;
  is_active: boolean;
  created_at: string;
}

export interface DocumentReviewItem {
  id: number;
  application_id?: number | null;
  application_reference?: string | null;
  institution_name: string;
  document_name: string;
  document_type: string;
  file_path?: string | null;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
  extracted_text: string;
  ai_summary?: string | null;
  ai_findings?: string | null;
  ai_confidence?: number | null;
  review_status: 'PENDING' | 'ACCEPTED' | 'CORRECTION_REQUIRED';
  reviewer_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  ai_analysis?: AiAnalysisResult | null;
  findings: ScrutinyFinding[];
}

export interface EVCVisit {
  id: number;
  application_id: number;
  institution_name: string;
  committee_members: string;
  scheduled_date: string;
  visit_mode: 'PHYSICAL' | 'VIRTUAL' | 'HYBRID';
  status: 'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'POSTPONED';
  report_summary?: string | null;
  recommendations?: string | null;
  assigned_by: string;
  created_at: string;
}

export interface ComplianceItem {
  id: number;
  institution_name: string;
  application_id?: number | null;
  item_type: string;
  description: string;
  due_date: string;
  status: 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'OVERDUE';
  submission_evidence?: string | null;
  submitted_at?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  officer_comments?: string | null;
  created_at: string;
}

export interface AlertItem {
  id: number;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  target_role: string;
  institution_name?: string | null;
  application_id?: number | null;
  is_read: boolean;
  trigger_type: string;
  created_at: string;
}

export interface DashboardMetrics {
  total_applications: number;
  in_progress: number;
  due_soon: number;
  overdue: number;
  returned: number;
  completed: number;
  by_stage: Record<string, number>;
  by_type: Record<string, number>;
  evc_pending_count: number;
  compliance_pending_count: number;
  total_alerts: number;
  active_institutions: number;
}

export interface BottleneckAnalytics {
  total_in_progress: number;
  total_active_cases?: number;
  total_active_applications?: number;
  critical_bottlenecks?: any;
  average_days_in_stage: Record<string, number>;
  stage_counts: Record<string, number>;
  region_workload: Record<string, number>;
  regional_workload?: Record<string, number>;
  officer_workload: Record<string, number>;
  identified_bottlenecks: string[];
}

export interface AvailableTransition {
  action: string;
  target_stage: string;
  target_status: string;
  description: string;
}

export interface StageRemark {
  id: number;
  application_id: number;
  stage: string;
  author_name: string;
  author_email: string;
  author_role: string;
  comment_text?: string;
  remark_text?: string;
  visibility: string;
  document_reference?: string | null;
  created_at: string;
}

export interface ApplicationDetailResponse {
  application: Application;
  available_transitions: AvailableTransition[];
  audit_history: AuditEvent[];
  documents: DocumentRecord[];
  evc_visit?: EVCVisit | null;
  scrutiny_runs?: ScrutinyRun[];
  scrutiny_findings?: ScrutinyFinding[];
  correction_requests?: CorrectionRequest[];
  remarks?: StageRemark[];
}

export interface AiAnalysisResult {
  mode: string;
  execution_mode?: string;
  mode_fallback_reason?: string;
  provider: string;
  model: string;
  ruleset_version?: string;
  summary: string;
  extracted_fields?: Record<string, string>;
  missing_information?: string[];
  potential_inconsistencies?: string[];
  verification_questions?: string[];
  confidence_score?: number;
  disclaimer?: string;
}
