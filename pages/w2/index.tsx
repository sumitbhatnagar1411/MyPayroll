import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import RequireAdmin from "@/components/RequireAdmin";


interface Employee {
  id: string;
  name: string;
  email: string;
}

export default function W2Page() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(data.employees || []))
      .catch(() => setEmployees([]));
  }, []);

  const generateW2 = async () => {
    if (!selectedEmployee) {
      setError("Please select an employee");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/.netlify/functions/generateW2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: selectedEmployee, tax_year: taxYear }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate W-2");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `W2-${taxYear}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate W-2");
    } finally {
      setLoading(false);
    }
  };

  const sendW2Email = async () => {
    if (!selectedEmployee) {
      setError("Please select an employee");
      return;
    }
    setLoading(true);
    setError(null);
    setEmailSent(false);
    try {
      const res = await fetch("/.netlify/functions/generateW2Email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: selectedEmployee, tax_year: taxYear }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send W-2 email");
      }
      setEmailSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send W-2 email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <RequireAdmin>
      <AdminLayout>
    <div className="max-w-2xl mx-auto">
      <Link href="/admin" className="text-slate-600 hover:text-slate-800 mb-6 inline-block">
        ← Back to Admin
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">W-2 Generator</h1>
      <p className="text-slate-600 mb-6">
        Admin only. Select an employee and tax year to generate a W-2 form.
      </p>

      <div className="bg-white rounded-lg shadow border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">Select employee...</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tax Year</label>
          <select
            value={taxYear}
            onChange={(e) => setTaxYear(parseInt(e.target.value, 10))}
            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {emailSent && <p className="text-emerald-600 text-sm">W-2 emailed successfully to employee and admin.</p>}

        <div className="flex gap-3 pt-2">
          <button
            onClick={generateW2}
            disabled={loading}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Generating..." : "Generate W-2"}
          </button>
          <button
            onClick={sendW2Email}
            disabled={loading}
            className="px-6 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Sending..." : "Generate & Email W-2"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          PDF will be downloaded when you click Generate W-2. Use &quot;Generate &amp; Email W-2&quot; to send
          to the employee and admin via Resend.
        </p>
      </div>
    </div>
      </AdminLayout>
    </RequireAdmin>
  );
}
