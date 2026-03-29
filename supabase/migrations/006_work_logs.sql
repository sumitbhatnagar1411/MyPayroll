-- Work Logs: track tasks employees performed to earn their pay
CREATE TABLE IF NOT EXISTS work_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  hours DECIMAL(6, 2) NOT NULL CHECK (hours > 0),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_logs_employee_id ON work_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_date ON work_logs(date);

ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admin_all_work_logs" ON work_logs
  FOR ALL
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Employees can read their own logs
CREATE POLICY "employee_read_own_work_logs" ON work_logs
  FOR SELECT
  USING (
    employee_id = (
      SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );
