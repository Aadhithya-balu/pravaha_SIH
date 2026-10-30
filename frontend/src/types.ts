import { LucideIcon } from 'lucide-react';

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'institution' | 'officer' | 'bureau' | 'evc_expert' | 'evc' | 'admin';
  institution_name?: string | null;
  region: string;
  designation: string;
  availability_status?: 'AVAILABLE' | 'UNAVAILABLE' | 'ON_LEAVE' | 'BUSY' | string | null;
  expertise?: string | null;
  phone?: string | null;
}

export interface InstitutionProfile {
  id: number;
  code: string;
  name: string;
  region: string;
  state: string;
  address: string;
  contact_email: string;
  contact_phone: string;
  institution_type: string;
}

export interface NextBestAction {
  action_code: string;
  action_label: string;
  target_role: string;
  authorized_role?: string;
  assigned_to: string;
  reason: string;
  rationale?: string;
  urgency: 'NORMAL' | 'APPROACHING_DEADLINE' | 'OVERDUE' | string;
  sla_urgency?: string;
  days_remaining?: number | null;
  is_user_authorized: boolean;
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
  findings?: ScrutinyFinding[];
}

export interface DocumentRecord {
  id: number;
  application_id?: number | null;
  institution_name: string;
  document_name: string;
  document_type: string;
  document_category?: string;
  file_path?: string | null;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  version?: number;
  is_latest?: boolean;
  file_hash?: string | null;
  processing_status?: string;
  extracted_text?: string;
  ai_summary?: string | null;
  ai_findings?: string | null;
  ai_confidence?: number | null;
  review_status: 'PENDING' | 'ACCEPTED' | 'CORRECTION_REQUIRED' | 'VERIFIED' | string;
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
  phash?: string | null;
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
  actual_date?: string | null;
  visit_mode: 'PHYSICAL' | 'VIRTUAL' | 'HYBRID';
  status: 'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'POSTPONED';
  visit_occurred?: 'OCCURRED' | 'DID_NOT_OCCUR' | 'UNCONFIRMED' | string;
  missed_reason?: string | null;
  evidence_verification_status?: 'PENDING' | 'VERIFIED' | 'REJECTED' | string;
  location_details?: string | null;
  structured_checklist?: string | null;
  inspection_outcome?: 'RECOMMENDED' | 'NOT_RECOMMENDED' | 'CONDITIONAL' | string | null;
  report_summary?: string | null;
  recommendations?: string | null;
  assigned_by: string;
  created_at: string;
  evidence_count?: number;
  proof_submission_status?: 'NOT_SUBMITTED' | 'EVIDENCE_UPLOADED' | 'AI_COMPLETED' | 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'ADDITIONAL_EVIDENCE_REQUIRED' | 'REJECTED' | string;
  proof_submitted_at?: string | null;
  proof_declaration?: string | null;
  proof_decided_by?: string | null;
  proof_decided_at?: string | null;
  proof_decision_remarks?: string | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  gps_accuracy?: number | null;
  gps_captured_at?: string | null;
  gps_distance_km?: number | null;
  location_status?: 'WITHIN_PROXIMITY' | 'DISTANCE_EXCEEDED' | 'BASELINE_UNAVAILABLE' | 'UNAVAILABLE' | string | null;
  assigned_staff_id?: number | null;
  assigned_staff_name?: string | null;
  assigned_staff_email?: string | null;
  assignment_method?: 'AI' | 'AI_AUTO' | 'MANUAL' | string | null;
  assignment_status?: 'ASSIGNMENT_PENDING' | 'ACCEPTED' | 'DECLINED' | 'INSPECTION_SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'REPORT_SUBMITTED' | 'REPORT_VERIFIED' | 'CANCELLED' | string | null;
  assignment_reason?: string | null;
  decline_reason?: string | null;
  assigned_at?: string | null;
  responded_at?: string | null;
}

export interface EVCAssignmentHistory {
  id: number;
  application_id: number;
  visit_id: number;
  staff_id?: number | null;
  staff_name?: string | null;
  staff_email?: string | null;
  assignment_method?: string | null;
  assigned_by?: string | null;
  assignment_status: string;
  assignment_reason?: string | null;
  decline_reason?: string | null;
  assigned_at?: string | null;
  responded_at?: string | null;
}

export interface EVCStaff {
  id: number;
  name: string;
  email: string;
  role: string;
  region?: string | null;
  designation?: string | null;
  phone?: string | null;
  expertise?: string | null;
  availability_status: string;
  active_assignments_count: number;
  completed_assignments_count: number;
}

export interface InspectionEvidence {
  id: number;
  visit_id: number;
  application_id: number;
  evidence_type: string;
  file_name: string;
  file_path: string;
  file_hash: string;
  phash?: string | null;
  file_size: number;
  uploaded_by: string;
  remarks?: string | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  gps_accuracy?: number | null;
  captured_at?: string | null;
  ai_analysis_status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNAVAILABLE' | string;
  ai_analysis_result?: string | null;
  ai_observations?: string | null;
  ai_warnings?: string | null;
  is_duplicate?: boolean;
  duplicate_reference?: string | null;
  download_url?: string;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED' | string;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at: string;
}

export interface EVCVisitProofDossier {
  visit: EVCVisit;
  institution_address?: string | null;
  institution_latitude?: number | null;
  institution_longitude?: number | null;
  evidences: InspectionEvidence[];
  combined_assessment: {
    overall_status: 'Evidence Appears Relevant' | 'Evidence Requires Review' | 'Insufficient Evidence' | 'AI Analysis Unavailable' | string;
    image_analysis: {
      total_photographs: number;
      analyzed_count: number;
      failed_count: number;
      unavailable_count: number;
      duplicate_warnings_count: number;
      categories_present: string[];
      missing_core_categories: string[];
    };
    location_evidence: {
      gps_available: boolean;
      latitude?: number | null;
      longitude?: number | null;
      accuracy_meters?: number | null;
      distance_km?: number | null;
      location_status: string;
    };
    timestamp_evidence: {
      earliest_timestamp?: string | null;
      latest_timestamp?: string | null;
      timestamp_consistency: string;
    };
    submission_completeness: {
      total_photographs: number;
      minimum_photographs_met: boolean;
      has_declaration: boolean;
      status: string;
    };
  };
}

export interface StageRemark {
  id: number;
  application_id: number;
  stage: string;
  author_name: string;
  author_email: string;
  author_role: string;
  comment_text: string;
  action_type?: string;
  visibility: 'APPLICANT_VISIBLE' | 'INTERNAL_OFFICER_ONLY' | string;
  document_reference?: string | null;
  parent_remark_id?: number | null;
  is_resolved?: boolean;
  resolution_notes?: string | null;
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

export interface AuditEvent {
  id: number;
  application_id: number;
  actor: string;
  actor_role: string;
  action: string;
  from_stage: string | null;
  to_stage: string | null;
  details: string;
  prev_hash?: string | null;
  event_hash?: string | null;
  created_at: string;
  application_reference?: string | null;
  institution_name?: string | null;
}

export interface ApplicationDetailResponse {
  application: Application;
  next_action?: NextBestAction | null;
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
