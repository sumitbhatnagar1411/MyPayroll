import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import RequireAdmin from "@/components/RequireAdmin";

interface Summary {
  total_wages: number;
  total_employees: number;
  total_payroll_runs: number;
}

interface ReportRow {
  "Employee Name": string;
  "Total Wages": number;
  "Total Payments": number;
  "IRA Contributions": number;
  "Number of Payroll Runs": number;
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reportData, setReportData] = useState<ReportRow[] | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/payroll/summary")
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => setError("Failed to load summary"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setReportData(null);
    fetch(`/api/payroll/report?year=${year}`)
      .then((r) => r.json())
      .then(setReportData)
      .catch(() => setReportData([]));
  }, [year]);

  const downloadReport = (format: "csv" | "json" | "pdf") => {
    const url = `/api/payroll/report?year=${year}&format=${format}`;
    window.open(url, "_blank");
  };

  const formatCurrency = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <RequireAdmin>
      <AdminLayout>
    <div className="max-w-6xl mx-auto">
      <Link href="/admin" className="text-slate-600 hover:text-slate-800 mb-6 inline-block">
        ← Back to Admin
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Payroll Reports</h1>

      {loading && <p className="text-slate-600">Loading summary...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-sm text-slate-500">Total Wages</p>
            <p className="text-xl font-semibold">{formatCurrency(summary.total_wages)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-sm text-slate-500">Total Employees</p>
            <p className="text-xl font-semibold">{summary.total_employees}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-sm text-slate-500">Total Payroll Runs</p>
            <p className="text-xl font-semibold">{summary.total_payroll_runs}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-slate-200 p-6 mb-6">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <label className="flex items-center gap-2">
            <span className="text-slate-600">Year:</span>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="border border-slate-300 rounded px-3 py-1.5"
            >
              {[2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => downloadReport("csv")}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
            >
              Download CSV
            </button>
            <button
              onClick={() => downloadReport("json")}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm"
            >
              Download JSON
            </button>
            <button
              onClick={() => downloadReport("pdf")}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm"
            >
              Download PDF
            </button>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-4">Employee Payroll Summary ({year})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-2">Employee Name</th>
                <th className="text-right py-3 px-2">Total Wages</th>
                <th className="text-right py-3 px-2">Total Payments</th>
                <th className="text-right py-3 px-2">IRA Contributions</th>
                <th className="text-right py-3 px-2">Payroll Runs</th>
              </tr>
            </thead>
            <tbody>
              {reportData?.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-2">{row["Employee Name"]}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(row["Total Wages"])}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(row["Total Payments"])}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(row["IRA Contributions"])}</td>
                  <td className="text-right py-2 px-2">{row["Number of Payroll Runs"]}</td>
                </tr>
              ))}
              {reportData?.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No payroll data for {year}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
      </AdminLayout>
    </RequireAdmin>
  );
}
