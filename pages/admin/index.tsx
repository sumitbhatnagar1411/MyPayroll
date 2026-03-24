import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

const cards = [
  { href: "/admin/employees", title: "Employees", desc: "Add and manage employees", color: "emerald", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/admin/payments", title: "Payments", desc: "Record payments to employees", color: "sky", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  { href: "/reports", title: "Payroll Reports", desc: "View and export payroll data", color: "violet", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { href: "/w2", title: "W-2 Generator", desc: "Generate W-2 tax forms", color: "amber", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { href: "/expenses", title: "Expenses", desc: "Track business expenses", color: "rose", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/pl", title: "P&L Report", desc: "Profit and loss statement", color: "teal", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { href: "/admin/documents", title: "Documents", desc: "Upload & manage employee documents", color: "indigo", icon: "M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" },
];

const colorMap: Record<string, string> = {
  emerald: "bg-emerald-50 border-emerald-100 text-emerald-700 hover:border-emerald-300 group-hover:bg-emerald-100",
  sky: "bg-sky-50 border-sky-100 text-sky-700 hover:border-sky-300 group-hover:bg-sky-100",
  violet: "bg-violet-50 border-violet-100 text-violet-700 hover:border-violet-300 group-hover:bg-violet-100",
  amber: "bg-amber-50 border-amber-100 text-amber-700 hover:border-amber-300 group-hover:bg-amber-100",
  rose: "bg-rose-50 border-rose-100 text-rose-700 hover:border-rose-300 group-hover:bg-rose-100",
  teal: "bg-teal-50 border-teal-100 text-teal-700 hover:border-teal-300 group-hover:bg-teal-100",
  indigo: "bg-indigo-50 border-indigo-100 text-indigo-700 hover:border-indigo-300 group-hover:bg-indigo-100",
};

export default function AdminDashboard() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<{ total_wages: number; total_employees: number; total_payroll_runs: number } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (profile?.role !== "admin") router.replace("/dashboard");
  }, [user, profile, loading, router]);

  useEffect(() => {
    fetch("/api/payroll/summary").then((r) => r.json()).then(setSummary).catch(() => {});
  }, []);

  if (loading || profile?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  const formatCurrency = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">Manage payroll, employees, and reports</p>
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <p className="text-sm font-medium text-slate-500">Total Wages</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(summary.total_wages)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <p className="text-sm font-medium text-slate-500">Employees</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{summary.total_employees}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <p className="text-sm font-medium text-slate-500">Payroll Runs</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{summary.total_payroll_runs}</p>
            </div>
          </div>
        )}

        <h2 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex items-start gap-4 p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 transition-colors ${colorMap[card.color]}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">{card.title}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{card.desc}</p>
              </div>
              <svg className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
