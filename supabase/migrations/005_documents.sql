-- Employee Documents Schema
-- Run in Supabase SQL Editor after 004_drop_profile_trigger.sql

-- Documents table
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'offer_letter',
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_year ON employee_documents(year);

-- RLS
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "docs_admin_all" ON employee_documents
  FOR ALL USING (is_admin());

-- Employee: can only read their own documents
CREATE POLICY "docs_employee_select_own" ON employee_documents
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

-- Storage bucket for documents: create via Supabase Dashboard > Storage > New bucket
-- Name: documents, Public: No (private bucket, access via signed URLs or service role)
