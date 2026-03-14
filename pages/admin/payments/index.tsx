import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/lib/auth-context";

interface Employee {
  id: string;
  name: string;
  email: string;
}

interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string | null;
  transaction_reference: string | null;
  employees: { name: string; email: string } | null;
}

export default function AdminPaymentsPage() {
  const { user, profile, loading, session } = useAuth();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [form, setForm] = useState({
    employee_id: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    method: "",
    transaction_reference: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());

  const loadData = () => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees || []));
    fetch(`/api/admin/payments?year=${year}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => setPayments(d.payments || []))
      .catch(() => setPayments([]));
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (profile?.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    loadData();
  }, [user, profile, loading, router, year, session?.access_token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.employee_id || !form.amount || !form.date) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          method: form.method || null,
          transaction_reference: form.transaction_reference || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        return;
      }
      setForm({ ...form, amount: "", transaction_reference: "" });
      loadData();
    } catch {
      setError("Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  if (loading || profile?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Payments</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Record Payment</h2>
          <p className="text-sm text-slate-500 mb-4">
            Recording a payment will automatically create a Payroll expense for the P&L.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
              <select
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                required
              >
                <option value="">Select employee...</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment method</label>
              <input
                type="text"
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                placeholder="e.g. Bank transfer, Venmo"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Transaction reference</label>
              <input
                type="text"
                value={form.transaction_reference}
                onChange={(e) => setForm({ ...form, transaction_reference: e.target.value })}
                placeholder="Optional"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Recording..." : "Record Payment"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Recent Payments ({year})</h2>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="border rounded px-2 py-1 text-sm"
            >
              {[2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Employee</th>
                  <th className="text-right py-2">Amount</th>
                  <th className="text-left py-2">Method</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2">{p.date}</td>
                    <td>{p.employees?.name || "—"}</td>
                    <td className="text-right font-medium">{formatCurrency(p.amount)}</td>
                    <td>{p.method || "—"}</td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No payments this year
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
