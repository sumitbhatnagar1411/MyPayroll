# My Payroll System

IRS-compliant payroll reporting module with W-2 generation, annual reports, and CSV/JSON/PDF export.

## Tech Stack

- **Frontend**: Next.js, Tailwind CSS
- **Backend**: Netlify serverless functions
- **Database**: Supabase Postgres
- **PDF generation**: reportlab (Python), pdf-lib (Node for Netlify)
- **Email**: Resend API

## Setup

### 1. Install dependencies

```bash
npm install
pip install -r backend/requirements.txt
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL` – Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` – Supabase service role (for server-side)
- `RESEND_API_KEY` – Resend API key
- `RESEND_FROM_EMAIL` – Sender for W-2 emails (e.g. `Payroll <noreply@yourdomain.com>`)
- `ADMIN_EMAIL` – Admin email for W-2 copies
- `EMPLOYER_NAME` – Employer name for W-2
- `EMPLOYER_EIN` – Employer EIN (XX-XXXXXXX)
- `NEXT_PUBLIC_NETLIFY_URL` – Netlify URL for function calls (e.g. `https://yoursite.netlify.app`)

### 3. Database schema

Run in Supabase SQL Editor (in order):

1. `supabase/migrations/001_payroll_schema.sql`
2. `supabase/migrations/002_expenses.sql`
3. `supabase/migrations/004_drop_profile_trigger.sql` (removes trigger that causes signup errors)

### 4. Supabase Auth

In Supabase Dashboard → Authentication:
- **Providers**: Enable **Email** (disable "Confirm email" if you want immediate login).
- **URL Configuration**: Add `http://localhost:3000` (and your production URL) to Redirect URLs for password reset.

To create your first admin: sign up at `/login`, then in Supabase SQL Editor run:

```sql
UPDATE profiles SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```

Create an employee record and link it to your auth user (if you will also be an employee):

```sql
INSERT INTO employees (auth_user_id, name, email)
SELECT id, 'Your Name', email FROM auth.users WHERE email = 'your@email.com';
```

### 5. Receipt storage

In Supabase Dashboard → Storage → New bucket: create `receipts`, set Public = Yes. The API uses the service role to upload; no extra policies needed for server-side uploads.

### 6. Run locally

```bash
npm run dev
```

For Netlify functions locally, use Netlify Dev:

```bash
netlify dev
```

## Features

- **Login** (`/login`): Admin and employee sign in with email/password
- **Admin dashboard** (`/admin`): Add employees (name, email, role, password), record payments, full access to reports, W-2, expenses, P&L
- **Employee dashboard** (`/dashboard`): View own pay slips and payments, download W-2
- **Payroll reports** (`/reports`): Admin only – total wages, employee summary, CSV/JSON/PDF export
- **W-2 generator** (`/w2`): Admin – generate W-2 for any employee; Employee – download own W-2
- **Expense tracking** (`/expenses`): Admin only
- **P&L report** (`/pl`): Admin only
- **Child employee rule**: Employees under 18 (sole proprietor) have Social Security and Medicare wages set to 0
- **Payroll → Expense link**: When you record a payment, a Payroll expense is auto-created

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.netlify/functions/getPayrollSummary` | GET | Returns `{ total_wages, total_employees, total_payroll_runs }` |
| `/.netlify/functions/generatePayrollReport` | GET | Query: `year`, `format` (csv\|json\|pdf) |
| `/.netlify/functions/generateW2` | POST | Body: `{ employee_id, tax_year }` → PDF |
| `/.netlify/functions/generateW2Email` | POST | Body: `{ employee_id, tax_year }` → emails W-2 to employee + admin |
| `/api/payroll/summary` | GET | Same as getPayrollSummary (Next.js API route) |
| `/api/employees` | GET | List employees (id, name, email) |
| `/api/expenses` | GET, POST | List/create expenses (query: year) |
| `/api/expenses/dashboard` | GET | Totals, by category, monthly trend (query: year) |
| `/api/expenses/export` | GET | Tax report CSV (query: year) |
| `/api/expenses/upload-receipt` | POST | Upload receipt, returns receipt_url |
| `/api/pl` | GET | Profit & Loss (query: year) |
| `/api/revenue` | GET, POST | List/create revenue entries |

## Python scripts (standalone)

```bash
# Payroll report (reads JSON from stdin)
echo '[{"name":"Alex","total_wages":4200,"total_payments":4200,"ira_contributions":4200,"payroll_runs_count":12}]' | python backend/payroll_reports.py 2024 csv
python backend/payroll_reports.py 2024 pdf < data.json > report.pdf

# W-2 generator (reads JSON from stdin)
echo '{"employee_name":"Alex Smith","employee_address":"123 Main St","employee_city_state_zip":"City, ST 12345","employer_name":"Acme Inc","employer_ein":"12-3456789","wages":50000,"federal_tax_withheld":5000,"tax_year":2024}' | python backend/w2_generator.py > w2.pdf
```

## RLS (Row Level Security)

- **employees**: admin = full access; employee = read own row
- **payments**: admin = full access; employee = read own payments
- **payroll_runs**, **ira_contributions**: same pattern

Ensure `profiles` has role set for each user; link `employees.auth_user_id` to `auth.users.id`.
