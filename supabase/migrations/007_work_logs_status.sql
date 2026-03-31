-- Add status and submitted_by columns to work_logs for approval workflow
ALTER TABLE work_logs 
ADD COLUMN status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN submitted_by TEXT DEFAULT 'admin' CHECK (submitted_by IN ('admin', 'employee')),
ADD COLUMN rejection_reason TEXT;

-- Create index on status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_work_logs_status ON work_logs(status);
CREATE INDEX IF NOT EXISTS idx_work_logs_submitted_by ON work_logs(submitted_by);
