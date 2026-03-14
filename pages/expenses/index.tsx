import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import AdminLayout from "@/components/AdminLayout";
import RequireAdmin from "@/components/RequireAdmin";

interface Expense {
  id: string;
  date: string;
  vendor: string;
  category: string;
  description: string | null;
  amount: number;
  payment_method: string | null;
  receipt_url: string | null;
}

interface Dashboard {
  total_expenses: number;
  total_revenue: number;
  net_profit: number;
  by_category: Record<string, number>;
  monthly_trend: { month: string; amount: number }[];
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    date: new Date().toISOString().slice(0, 10),
    vendor: "",
    category: "Software",
    description: "",
    amount: "",
    payment_method: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/expenses?year=${year}`).then((r) => r.json()),
      fetch(`/api/expenses/dashboard?year=${year}`).then((r) => r.json()),
    ])
      .then(([expRes, dashRes]) => {
        setExpenses(expRes.expenses || []);
        setDashboard(dashRes);
      })
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  };

  useEffect(loadData, [year]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendor || !form.amount) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          receipt_url: form.receipt_url || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setForm((f) => ({ ...f, vendor: "", description: "", amount: "", receipt_url: "" }));
      loadData();
    } catch {
      setError("Failed to save expense");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const res = await fetch("/api/expenses/upload-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, filename: file.name }),
        });
        if (!res.ok) throw new Error("Upload failed");
        const { receipt_url } = await res.json();
        setForm((f) => ({ ...f, receipt_url }));
      };
      reader.readAsDataURL(file);
    } catch {
      setError("Receipt upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const downloadTaxReport = () => {
    window.open(`/api/expenses/export?year=${year}`, "_blank");
  };

  return (
    <RequireAdmin>
      <AdminLayout>
    <div className="max-w-6xl mx-auto">
      <Link href="/admin" className="text-slate-600 hover:text-slate-800 mb-6 inline-block">
        ← Back to Admin
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Expense Tracking</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Dashboard cards */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-sm text-slate-500">Total Expenses ({year})</p>
            <p className="text-xl font-semibold text-red-700">{formatCurrency(dashboard.total_expenses)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-sm text-slate-500">Revenue ({year})</p>
            <p className="text-xl font-semibold text-emerald-700">{formatCurrency(dashboard.total_revenue)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-sm text-slate-500">Net Profit ({year})</p>
            <p className={`text-xl font-semibold ${dashboard.net_profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {formatCurrency(dashboard.net_profit)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200 flex items-end">
            <button
              onClick={downloadTaxReport}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm"
            >
              Export Tax CSV
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add expense form */}
        <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Add Expense</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Vendor</label>
              <input
                type="text"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                placeholder="e.g. Adobe, Amazon"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
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
                placeholder="0.00"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Receipt</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleReceiptUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-sm text-sky-600 hover:text-sky-700 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload receipt"}
              </button>
              {form.receipt_url && (
                <a href={form.receipt_url} target="_blank" rel="noopener noreferrer" className="block text-xs text-slate-500 mt-1">
                  Receipt attached
                </a>
              )}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
            >
              {submitting ? "Saving..." : "Add Expense"}
            </button>
          </form>
        </div>

        {/* Expense list + by category */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Expenses ({year})</h2>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="border border-slate-300 rounded px-2 py-1 text-sm"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <p className="text-slate-500">Loading...</p>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2">Date</th>
                      <th className="text-left py-2">Vendor</th>
                      <th className="text-left py-2">Category</th>
                      <th className="text-right py-2">Amount</th>
                      <th className="text-left py-2">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2">{e.date}</td>
                        <td>{e.vendor}</td>
                        <td>{e.category}</td>
                        <td className="text-right font-medium">{formatCurrency(e.amount)}</td>
                        <td>
                          {e.receipt_url ? (
                            <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline text-xs">
                              View
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          No expenses this year
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* By category */}
          {dashboard && Object.keys(dashboard.by_category).length > 0 && (
            <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4">By Category</h2>
              <div className="space-y-2">
                {Object.entries(dashboard.by_category)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between text-sm">
                      <span>{cat}</span>
                      <span className="font-medium">{formatCurrency(amt)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Monthly trend */}
          {dashboard && dashboard.monthly_trend.length > 0 && (
            <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Monthly Expense Trend</h2>
              <div className="space-y-2">
                {dashboard.monthly_trend.map(({ month, amount }) => (
                  <div key={month} className="flex items-center gap-3">
                    <span className="text-sm w-20">{month}</span>
                    <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded"
                        style={{
                          width: `${Math.min(100, (amount / Math.max(...dashboard.monthly_trend.map((m) => m.amount), 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-20 text-right">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Link href="/pl" className="text-sky-600 hover:text-sky-700 font-medium">
          → Profit & Loss Report
        </Link>
      </div>
    </div>
      </AdminLayout>
    </RequireAdmin>
  );
}
