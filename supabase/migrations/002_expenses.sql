-- Business Expenses Schema
-- Run in Supabase SQL Editor after 001_payroll_schema.sql

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  vendor TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method TEXT,
  receipt_url TEXT,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,  -- Link to payroll payment if auto-created
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_id ON expenses(payment_id);

-- Revenue table (optional - for P&L)
CREATE TABLE IF NOT EXISTS revenue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  source TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_date ON revenue(date);

-- RLS for expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_admin_all" ON expenses
  FOR ALL USING (is_admin());

CREATE POLICY "revenue_admin_all" ON revenue
  FOR ALL USING (is_admin());

-- Trigger: auto-create Payroll expense when payment is inserted
CREATE OR REPLACE FUNCTION create_payroll_expense()
RETURNS TRIGGER AS $$
DECLARE
  emp_name TEXT;
BEGIN
  SELECT name INTO emp_name FROM employees WHERE id = NEW.employee_id;
  INSERT INTO expenses (date, vendor, category, amount, payment_id)
  VALUES (NEW.date, COALESCE(emp_name, 'Employee'), 'Payroll', NEW.amount, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_payment_insert
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION create_payroll_expense();

-- Storage bucket for receipts: create via Supabase Dashboard > Storage > New bucket
-- Name: receipts, Public: Yes
