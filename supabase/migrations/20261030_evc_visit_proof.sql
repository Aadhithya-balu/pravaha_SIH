-- PRAVAHA EVC Visit Proof & Authenticity Verification Schema Migration
-- Adds GPS location, AI analysis results, proof submission and verification lifecycle columns

-- 1. Institution coordinates for baseline proximity checking
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 2. EVC Visit Proof Lifecycle & Location Verification
ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS proof_submission_status VARCHAR(50) DEFAULT 'NOT_SUBMITTED';
ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS proof_submitted_at TIMESTAMPTZ;
ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS proof_declaration TEXT;
ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS proof_decided_by VARCHAR(255);
ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS proof_decided_at TIMESTAMPTZ;
ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS proof_decision_remarks TEXT;
ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS gps_latitude DOUBLE PRECISION;
ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS gps_longitude DOUBLE PRECISION;
ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS gps_accuracy DOUBLE PRECISION;
ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS gps_captured_at TIMESTAMPTZ;
ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS gps_distance_km DOUBLE PRECISION;
ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS location_status VARCHAR(40);

-- 3. Inspection Evidence Photos & AI Vision Analysis
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS gps_latitude DOUBLE PRECISION;
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS gps_longitude DOUBLE PRECISION;
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS gps_accuracy DOUBLE PRECISION;
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS ai_analysis_status VARCHAR(40) DEFAULT 'PENDING';
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS ai_analysis_result TEXT;
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS ai_observations TEXT;
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS ai_warnings TEXT;
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS duplicate_reference VARCHAR(255);
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS phash VARCHAR(64);
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'PENDING';
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS verified_by VARCHAR(255);
ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 4. Create Index on Proof Submission Status & Visit ID
CREATE INDEX IF NOT EXISTS idx_evc_visits_proof_status ON evc_visits (proof_submission_status);
CREATE INDEX IF NOT EXISTS idx_inspection_evidences_visit_type ON inspection_evidences (visit_id, evidence_type);
