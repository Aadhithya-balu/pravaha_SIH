export type UserRole = 'institution' | 'officer' | 'bureau' | 'evc_expert' | 'admin';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
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
  status: 'IN_PROGRESS' | 'RETURNED' | 'OVERDUE' | 'COMPLETED' | 'REJECTED';
  assigned_to: string;
  assigned_role: string;
  region: string;
  submission_date: string;
  due_date: string | null;
  notes: string;
  deficiency_count: number;
  academic_year: string;
  created_at: string;
  created_by?: number | null;
  form_data?: string | null;
  decision_outcome?: string | null;
  decision_remarks?: string | null;
  decision_by?: string | null;
  decision_date?: string | null;
}

export interface AuditEvent {
  id: number;
  application_id: number;
  actor: string;
  actor_role: string;
  action: string;
  from_stage: string | null;
  to_stage: string | null;
  details: string;
  created_at: string;
}

export interface DocumentRecord {
  id: number;
  application_id?: number | null;
  institution_name: string;
  document_name: string;
  document_type: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  extracted_text: string;
  ai_summary?: string | null;
  ai_findings?: string | null;
  ai_confidence?: number | null;
  review_status: 'PENDING' | 'ACCEPTED' | 'CORRECTION_REQUIRED';
  reviewer_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface AiAnalysisResult {
  mode: 'demo_mode' | 'real_llm';
  provider?: string;
  model?: string;
  document_name: string;
  document_type: string;
  summary: string;
  extracted_fields: Record<string, string>;
  missing_information: string[];
  potential_inconsistencies: string[];
  verification_questions: string[];
  confidence_score: number;
  disclaimer: string;
  mode_fallback_reason?: string;
}

export interface ScrutinyRun {
  id: number;
  application_id: number;
  run_type: 'INITIAL' | 'RE_SCRUTINY';
  conducted_by: string;
  status: 'PASSED' | 'DEFICIENCIES_FOUND' | 'PENDING_REVIEW';
  summary: string;
  missing_docs?: string | null;
  rule_results?: string | null;
  ai_assisted: boolean;
  created_at: string;
}

export interface ScrutinyFinding {
  id: number;
  scrutiny_run_id?: number | null;
  application_id: number;
  rule_id: string;
  document_type: string;
  severity: 'INFO' | 'WARNING' | 'DEFICIENCY';
  category: string;
  description: string;
  evidence_quote?: string | null;
  suggested_action?: string | null;
  officer_disposition: 'PENDING' | 'ACCEPTED' | 'WAIVED' | 'CORRECTION_REQUESTED';
  disposition_notes?: string | null;
  disposed_by?: string | null;
  disposed_at?: string | null;
  created_at: string;
}

export interface CorrectionRequest {
  id: number;
  application_id: number;
  requested_by: string;
  reason: string;
  deficiencies_json?: string | null;
  status: 'PENDING' | 'RESUBMITTED' | 'RESOLVED';
  institution_response?: string | null;
  response_submitted_at?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  created_at: string;
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
  urgent_alerts: Array<{
    id: number;
    title: string;
    message: string;
    severity: string;
    created_at: string;
  }>;
}

export interface AvailableTransition {
  action: string;
  target_stage: string;
  target_status: string;
  description: string;
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
}
