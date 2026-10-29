-- ====================================================================
-- PRAVAHA — AICTE Regulatory Workflow & Scrutiny Engine
-- Supabase Storage Buckets & Storage RLS Configuration
-- Target: Supabase Storage (`storage.buckets` & `storage.objects`)
-- ====================================================================

-- 1. Create storage buckets for regulatory documents and inspection evidence
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('documents', 'documents', false, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']),
    ('evidence', 'evidence', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage RLS Policies for Documents Bucket
CREATE POLICY "Institutions can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'documents' 
    AND (auth.role() = 'authenticated')
);

CREATE POLICY "Users can view permitted documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'documents'
    AND (auth.role() = 'authenticated')
);

-- 3. Storage RLS Policies for Inspection Evidence Bucket
CREATE POLICY "EVC Inspectors and Officers can upload evidence"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'evidence'
    AND (auth.role() = 'authenticated')
);

CREATE POLICY "Authorized users can view inspection evidence"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'evidence'
    AND (auth.role() = 'authenticated')
);

