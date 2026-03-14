-- Payroll System Schema
-- Run in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles/roles for RLS (assumes Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  ssn_last4 TEXT,
  birth_date DATE,  -- For child employee rule (under 18 = no SS/Medicare)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll runs
CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  gross_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax_withheld DECIMAL(12, 2) NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  method TEXT,
  transaction_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- IRA contributions
CREATE TABLE IF NOT EXISTS ira_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payroll_runs_employee_id ON payroll_runs(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_date ON payroll_runs(date);
CREATE INDEX IF NOT EXISTS idx_payments_employee_id ON payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
CREATE INDEX IF NOT EXISTS idx_ira_contributions_employee_year ON ira_contributions(employee_id, year);

-- RLS Policies

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ira_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_user_role() RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'admin';
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: get employee_id for current user
CREATE OR REPLACE FUNCTION get_my_employee_id() RETURNS UUID AS $$
  SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Employees: admin = read/write, employee = read own row
CREATE POLICY "employees_admin_all" ON employees
  FOR ALL USING (is_admin());

CREATE POLICY "employees_employee_own" ON employees
  FOR SELECT USING (auth_user_id = auth.uid());

-- Payments: admin = read/write, employee = read own payments
CREATE POLICY "payments_admin_all" ON payments
  FOR ALL USING (is_admin());

CREATE POLICY "payments_employee_own" ON payments
  FOR SELECT USING (employee_id = get_my_employee_id());

-- Payroll runs: admin = read/write, employee = read own
CREATE POLICY "payroll_runs_admin_all" ON payroll_runs
  FOR ALL USING (is_admin());

CREATE POLICY "payroll_runs_employee_own" ON payroll_runs
  FOR SELECT USING (employee_id = get_my_employee_id());

-- IRA contributions: admin = read/write, employee = read own
CREATE POLICY "ira_admin_all" ON ira_contributions
  FOR ALL USING (is_admin());

CREATE POLICY "ira_employee_own" ON ira_contributions
  FOR SELECT USING (employee_id = get_my_employee_id());

-- Profiles: users can read own profile
CREATE POLICY "profiles_read_own" ON profiles
  FOR SELECT USING (id = auth.uid());
