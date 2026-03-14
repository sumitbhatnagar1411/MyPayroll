import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import RequireAdmin from "@/components/RequireAdmin";

interface RevenueItem {
  date: string;
  source: string;
  amount: number;
  description?: string;
}

interface PLData {
  year: number;
  revenue: { total: number; items: RevenueItem[] };
  expenses: { total: number; items: { date: string; vendor: string; category: string; amount: number }[] };
  net_profit: number;
}

function AddRevenueForm({ year, onAdded, compact }: { year: number; onAdded: () => void; compact?: boolean }) {
  const [show, setShow] = useState(false);
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(`${year}-01-15`);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !amount) return;
    setLoading(true);
    try {
      const res = await fetch("/api/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          source,
          amount: parseFloat(amount),
        }),
      });
      if (res.ok) {
        setSource("");
        setAmount("");
        setShow(false);
        onAdded();
      }
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="text-sm text-sky-600 hover:text-sky-700"
        >
          {show ? "Cancel" : "+ Add Revenue"}
        </button>
        {show && (
          <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap gap-2 items-end">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="Source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="border rounded px-2 py-1 text-sm w-32"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border rounded px-2 py-1 text-sm w-24"
            />
            <button type="submit" disabled={loading} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm">
              Add
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 max-w-md">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
      />
      <input
        type="text"
        placeholder="Source (e.g. YouTube, Client)"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
      />
      <input
        type="number"
        step="0.01"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
      />
      <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded text-sm">
        Add Revenue
      </button>
    </form>
  );
}

export default function PLPage() {
  const [data, setData] = useState<PLData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const formatCurrency = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pl?year=${year}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [year]);

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <Link href="/" className="text-slate-600 hover:text-slate-800 mb-6 inline-block">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Profit & Loss Report</h1>

      <div className="mb-4">
        <label className="text-slate-600 mr-2">Year:</label>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="border border-slate-300 rounded px-3 py-1.5"
        >
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : data ? (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-500">Revenue</p>
                <p className="text-xl font-semibold text-emerald-700">{formatCurrency(data.revenue.total)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Expenses</p>
                <p className="text-xl font-semibold text-red-700">{formatCurrency(data.expenses.total)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Net Profit</p>
                <p className={`text-xl font-semibold ${data.net_profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {formatCurrency(data.net_profit)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Revenue Details</h2>
              <AddRevenueForm year={year} onAdded={() => window.location.reload()} compact />
            </div>
            {data.revenue.items.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Source</th>
                    <th className="text-left py-2">Description</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revenue.items.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2">{r.date}</td>
                      <td>{r.source}</td>
                      <td>{r.description || "—"}</td>
                      <td className="text-right font-medium">{formatCurrency(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-slate-500">No revenue entries yet. Use the form above to add.</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Expense Details</h2>
            {data.expenses.items.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Vendor</th>
                    <th className="text-left py-2">Category</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.items.map((e, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2">{e.date}</td>
                      <td>{e.vendor}</td>
                      <td>{e.category}</td>
                      <td className="text-right font-medium">{formatCurrency(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-slate-500">No expenses this year.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <Link href="/expenses" className="text-sky-600 hover:text-sky-700 font-medium">
          ← Expense Tracking
        </Link>
      </div>
    </div>
      </AdminLayout>
    </RequireAdmin>
  );
}
