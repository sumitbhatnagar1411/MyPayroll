import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth-context";

interface PayrollRun {
  id: string;
  date: string;
  gross_pay: number;
  tax_withheld: number;
  notes: string | null;
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string | null;
  transaction_reference: string | null;
}

export default function EmployeeDashboard() {
  const { user, profile, loading, session, signOut } = useAuth();
  const router = useRouter();
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [w2Loading, setW2Loading] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const formatCurrency = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const totalGross = payrollRuns.reduce((s, r) => s + r.gross_pay, 0);
  const totalNet = payrollRuns.reduce((s, r) => s + (r.gross_pay - r.tax_withheld), 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (profile?.role === "admin") router.replace("/admin");
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`/api/employee/my-payslips?year=${year}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setPayrollRuns(d.payroll_runs || []);
        setPayments(d.payments || []);
      });
    fetch("/api/employee/me", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((d) => d.id && setEmployeeId(d.id))
      .catch(() => {});
  }, [session?.access_token, year]);

  const downloadW2 = async () => {
    if (!employeeId) return;
    setW2Loading(true);
    try {
      const res = await fetch("/.netlify/functions/generateW2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId, tax_year: year }),
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `W2-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download W-2");
    } finally {
      setW2Loading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading || profile?.role === "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold">
              P
            </div>
            <div>
              <h1 className="font-semibold text-slate-800">My Payroll</h1>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800">Pay Overview</h2>
          <p className="text-slate-500 text-sm mt-0.5">Your pay slips and payments for {year}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Gross</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(totalGross)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Net Pay</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(totalNet)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Payments Received</p>
            <p className="text-xl font-bold text-sky-600 mt-1">{formatCurrency(totalPaid)}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
              <h3 className="font-semibold text-slate-800">Pay Slips</h3>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Gross Pay</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Tax Withheld</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRuns.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4">{r.date}</td>
                      <td className="text-right py-3 px-4">{formatCurrency(r.gross_pay)}</td>
                      <td className="text-right py-3 px-4 text-slate-500">{formatCurrency(r.tax_withheld)}</td>
                      <td className="text-right py-3 px-4 font-semibold text-emerald-600">
                        {formatCurrency(r.gross_pay - r.tax_withheld)}
                      </td>
                    </tr>
                  ))}
                  {payrollRuns.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500">
                        No pay slips for {year}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <h3 className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-800">Payments Received</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4">{p.date}</td>
                      <td className="text-right py-3 px-4 font-semibold text-sky-600">{formatCurrency(p.amount)}</td>
                      <td className="py-3 px-4 text-slate-500">{p.method || "—"}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-slate-500">
                        No payments for {year}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-sm p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg">W-2 Tax Form</h3>
                <p className="text-emerald-100 text-sm mt-1">
                  Download your W-2 for tax year {year}
                </p>
              </div>
              <button
                onClick={downloadW2}
                disabled={w2Loading || !employeeId}
                className="shrink-0 px-6 py-3 bg-white text-emerald-700 font-semibold rounded-lg hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {w2Loading ? "Generating..." : "Download W-2"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">My Documents</h3>
                  <p className="text-slate-500 text-sm mt-0.5">View offer letters and other documents shared by HR</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/documents")}
                className="shrink-0 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                View Documents
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
