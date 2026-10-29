-- ====================================================================
-- PRAVAHA — AICTE Regulatory Workflow & Scrutiny Engine
-- Supabase Schema Migration: Initial Core Schema & RLS Policies
-- Target: Supabase PostgreSQL (Supports Row-Level Security, Auth & RBAC)
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. INSTITUTIONS TABLE
CREATE TABLE IF NOT EXISTS public.institutions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(40) UNIQUE NOT NULL,
    name VARCHAR(200) UNIQUE NOT NULL,
    region VARCHAR(80) NOT NULL,
    state VARCHAR(80) NOT NULL,
    address TEXT NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(40) DEFAULT '+91-11-29581000',
    institution_type VARCHAR(100) DEFAULT 'Engineering & Technology',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_institutions_region ON public.institutions(region);
CREATE INDEX IF NOT EXISTS idx_institutions_name ON public.institutions(name);

-- 3. USER PROFILES TABLE (Linked with Supabase auth.users or internal users)
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(40) NOT NULL DEFAULT 'institution', -- institution, officer, bureau, evc_expert, admin
    institution_name VARCHAR(200),
    region VARCHAR(80) DEFAULT 'Northern',
    designation VARCHAR(120) DEFAULT 'Authorized Official',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_institution ON public.users(institution_name);

-- 4. REGULATORY CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.regulatory_categories (
    id SERIAL PRIMARY KEY,
    category_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    institution_type VARCHAR(100) DEFAULT 'Technical / Engineering',
    description TEXT NOT NULL,
    required_documents_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    workflow_sequence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    sla_days INTEGER DEFAULT 21,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_categories_code ON public.regulatory_categories(category_code);

-- 5. APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.applications (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(40) UNIQUE NOT NULL,
    institution_name VARCHAR(200) NOT NULL,
    application_type VARCHAR(100) NOT NULL,
    current_stage VARCHAR(60) NOT NULL DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, SCRUTINY, RETURNED_FOR_CLARIFICATION, RE_SCRUTINY, EVC_PENDING, EVC_SCHEDULED, EVC_COMPLETED, SAC_SHC_REVIEW, COMPLIANCE_PENDING, COMPLETED, REJECTED
    status VARCHAR(40) NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, RETURNED, OVERDUE, COMPLETED, REJECTED, DRAFT
    assigned_to VARCHAR(255) DEFAULT 'Regional Officer',
    assigned_role VARCHAR(40) DEFAULT 'officer',
    region VARCHAR(80) DEFAULT 'Northern',
    submission_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    notes TEXT DEFAULT '',
    deficiency_count INTEGER DEFAULT 0,
    academic_year VARCHAR(20) DEFAULT '2026-2027',
    form_data JSONB,
    decision_outcome VARCHAR(40), -- APPROVED, REJECTED
    decision_remarks TEXT,
    decision_by VARCHAR(255),
    decision_date TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_ref ON public.applications(reference);
CREATE INDEX IF NOT EXISTS idx_applications_institution ON public.applications(institution_name);
CREATE INDEX IF NOT EXISTS idx_applications_stage ON public.applications(current_stage);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);

-- 6. APPLICATION DOCUMENTS & VERSIONING TABLE
CREATE TABLE IF NOT EXISTS public.documents (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES public.applications(id) ON DELETE CASCADE,
    institution_name VARCHAR(200) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(80) NOT NULL DEFAULT 'LEASE_DEED',
    file_path VARCHAR(500),
    file_size INTEGER DEFAULT 0,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    uploaded_by VARCHAR(255) NOT NULL,
    version INTEGER DEFAULT 1,
    is_latest BOOLEAN DEFAULT TRUE,
    file_hash VARCHAR(64),
    processing_status VARCHAR(40) DEFAULT 'COMPLETED', -- UPLOADED, QUEUED, PROCESSING, COMPLETED, NEEDS_REVIEW, FAILED
    extracted_text TEXT DEFAULT '',
    ai_summary TEXT,
    ai_findings JSONB,
    ai_confidence FLOAT,
    review_status VARCHAR(40) DEFAULT 'PENDING', -- PENDING, ACCEPTED, CORRECTION_REQUIRED
    reviewer_notes TEXT,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_app ON public.documents(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON public.documents(file_hash);

-- 7. STAGE REMARKS & CHRONOLOGICAL COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.stage_remarks (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES public.applications(id) ON DELETE CASCADE,
    stage VARCHAR(60) NOT NULL,
    author_name VARCHAR(255) NOT NULL,
    author_email VARCHAR(255) NOT NULL,
    author_role VARCHAR(40) NOT NULL,
    comment_text TEXT NOT NULL,
    visibility VARCHAR(30) NOT NULL DEFAULT 'APPLICANT_VISIBLE', -- APPLICANT_VISIBLE, INTERNAL_OFFICER_ONLY
    document_reference VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remarks_app ON public.stage_remarks(application_id);
CREATE INDEX IF NOT EXISTS idx_remarks_stage ON public.stage_remarks(stage);

-- 8. SCRUTINY RUNS & FINDINGS
CREATE TABLE IF NOT EXISTS public.scrutiny_runs (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES public.applications(id) ON DELETE CASCADE,
    run_type VARCHAR(40) DEFAULT 'INITIAL',
    conducted_by VARCHAR(255) NOT NULL,
    status VARCHAR(40) DEFAULT 'PASSED',
    summary TEXT DEFAULT '',
    missing_docs JSONB,
    rule_results JSONB,
    ai_assisted BOOLEAN DEFAULT FALSE,
    model_provider VARCHAR(80),
    model_name VARCHAR(120),
    ruleset_version VARCHAR(80) DEFAULT 'APH-2024-2027-v1.2',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scrutiny_findings (
    id SERIAL PRIMARY KEY,
    scrutiny_run_id INTEGER REFERENCES public.scrutiny_runs(id) ON DELETE CASCADE,
    application_id INTEGER REFERENCES public.applications(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES public.documents(id) ON DELETE SET NULL,
    rule_id VARCHAR(80) NOT NULL,
    document_type VARCHAR(80) NOT NULL,
    severity VARCHAR(30) DEFAULT 'DEFICIENCY', -- INFO, WARNING, DEFICIENCY
    category VARCHAR(60) DEFAULT 'VALIDATION',
    description TEXT NOT NULL,
    evidence_quote TEXT,
    source_document VARCHAR(255),
    page_number INTEGER,
    expected_requirement TEXT,
    observed_value TEXT,
    suggested_action TEXT,
    is_provisional BOOLEAN DEFAULT FALSE,
    source_reference VARCHAR(255),
    officer_disposition VARCHAR(40) DEFAULT 'PENDING',
    disposition_notes TEXT,
    disposed_by VARCHAR(255),
    disposed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_app ON public.scrutiny_findings(application_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON public.scrutiny_findings(severity);

-- 9. CORRECTION REQUESTS
CREATE TABLE IF NOT EXISTS public.correction_requests (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES public.applications(id) ON DELETE CASCADE,
    requested_by VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    deficiencies_json JSONB,
    status VARCHAR(40) DEFAULT 'PENDING',
    institution_response TEXT,
    response_submitted_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. EVC VISITS & INSPECTION EVIDENCE
CREATE TABLE IF NOT EXISTS public.evc_visits (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES public.applications(id) ON DELETE CASCADE,
    institution_name VARCHAR(200) NOT NULL,
    committee_members TEXT NOT NULL,
    scheduled_date DATE NOT NULL,
    visit_mode VARCHAR(40) DEFAULT 'PHYSICAL', -- PHYSICAL, VIRTUAL, HYBRID
    status VARCHAR(40) DEFAULT 'SCHEDULED', -- PENDING, SCHEDULED, IN_PROGRESS, COMPLETED, POSTPONED
    report_summary TEXT,
    recommendations TEXT,
    assigned_by VARCHAR(255) DEFAULT 'Regional Officer',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inspection_evidences (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER REFERENCES public.evc_visits(id) ON DELETE CASCADE,
    application_id INTEGER REFERENCES public.applications(id) ON DELETE CASCADE,
    evidence_type VARCHAR(50) DEFAULT 'GEOTAGGED_PHOTO', -- GEOTAGGED_PHOTO, SIGNED_REPORT, LAB_VERIFICATION, FACULTY_ATTENDANCE
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    file_size INTEGER DEFAULT 0,
    uploaded_by VARCHAR(255) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_visit ON public.inspection_evidences(visit_id);

-- 11. COMPLIANCE & UNDERTAKINGS
CREATE TABLE IF NOT EXISTS public.compliance_items (
    id SERIAL PRIMARY KEY,
    institution_name VARCHAR(200) NOT NULL,
    application_id INTEGER REFERENCES public.applications(id) ON DELETE CASCADE,
    item_type VARCHAR(80) NOT NULL,
    description TEXT NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(40) DEFAULT 'PENDING',
    submission_evidence TEXT,
    submitted_at TIMESTAMPTZ,
    verified_by VARCHAR(255),
    verified_at TIMESTAMPTZ,
    officer_comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. IN-APP ALERTS & NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.alerts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(30) DEFAULT 'INFO',
    target_role VARCHAR(30) DEFAULT 'officer',
    institution_name VARCHAR(200),
    application_id INTEGER,
    recipient_user_id INTEGER REFERENCES public.users(id),
    is_read BOOLEAN DEFAULT FALSE,
    trigger_type VARCHAR(40) DEFAULT 'DEADLINE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON public.alerts(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_role ON public.alerts(target_role);

-- 13. TAMPER-EVIDENT SHA-256 AUDIT LOG (IMMUTABLE APPEND-ONLY)
CREATE TABLE IF NOT EXISTS public.audit_events (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES public.applications(id) ON DELETE CASCADE,
    actor VARCHAR(255) NOT NULL,
    actor_role VARCHAR(40) DEFAULT 'officer',
    action VARCHAR(80) NOT NULL,
    from_stage VARCHAR(60),
    to_stage VARCHAR(60),
    details TEXT DEFAULT '',
    prev_hash VARCHAR(64),
    event_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_app ON public.audit_events(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_hash ON public.audit_events(event_hash);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evc_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Applications: Applicants see only their own institution's records; Officers see all
CREATE POLICY "Institutions view own applications" ON public.applications
    FOR SELECT USING (
        institution_name = (auth.jwt() ->> 'institution_name')
        OR auth.jwt() ->> 'role' IN ('officer', 'bureau', 'admin', 'evc_expert')
    );

CREATE POLICY "Institutions create own applications" ON public.applications
    FOR INSERT WITH CHECK (
        institution_name = (auth.jwt() ->> 'institution_name')
        OR auth.jwt() ->> 'role' IN ('officer', 'admin')
    );

CREATE POLICY "Officers and Owners update applications" ON public.applications
    FOR UPDATE USING (
        (institution_name = (auth.jwt() ->> 'institution_name') AND current_stage IN ('DRAFT', 'RETURNED_FOR_CLARIFICATION'))
        OR auth.jwt() ->> 'role' IN ('officer', 'bureau', 'admin')
    );

-- Documents: Applicants access own institution's documents; Officers/EVC access assigned
CREATE POLICY "Document access policy" ON public.documents
    FOR SELECT USING (
        institution_name = (auth.jwt() ->> 'institution_name')
        OR auth.jwt() ->> 'role' IN ('officer', 'bureau', 'admin', 'evc_expert')
    );

CREATE POLICY "Document upload policy" ON public.documents
    FOR INSERT WITH CHECK (
        institution_name = (auth.jwt() ->> 'institution_name')
        OR auth.jwt() ->> 'role' IN ('officer', 'admin')
    );

-- Stage Remarks: Applicants see only APPLICANT_VISIBLE remarks; Officers see all
CREATE POLICY "Stage remarks select policy" ON public.stage_remarks
    FOR SELECT USING (
        (visibility = 'APPLICANT_VISIBLE' AND application_id IN (
            SELECT id FROM public.applications WHERE institution_name = (auth.jwt() ->> 'institution_name')
        ))
        OR auth.jwt() ->> 'role' IN ('officer', 'bureau', 'admin', 'evc_expert')
    );

CREATE POLICY "Stage remarks insert policy" ON public.stage_remarks
    FOR INSERT WITH CHECK (
        auth.jwt() ->> 'role' IN ('officer', 'bureau', 'admin', 'evc_expert', 'institution')
    );

-- Audit Events: Read-only for authorized users, strictly IMMUTABLE (NO UPDATE, NO DELETE)
CREATE POLICY "Audit events select policy" ON public.audit_events
    FOR SELECT USING (
        application_id IN (
            SELECT id FROM public.applications WHERE institution_name = (auth.jwt() ->> 'institution_name')
        )
        OR auth.jwt() ->> 'role' IN ('officer', 'bureau', 'admin', 'evc_expert')
    );

CREATE POLICY "Audit events insert by system or authorized officers" ON public.audit_events
    FOR INSERT WITH CHECK (TRUE);

-- NO UPDATE OR DELETE ON AUDIT EVENTS (Guarantees append-only tamper-evident audit log)
CREATE POLICY "Deny update on audit events" ON public.audit_events
    FOR UPDATE USING (FALSE);

CREATE POLICY "Deny delete on audit events" ON public.audit_events
    FOR DELETE USING (FALSE);
