import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/lib/auth-context";

interface Employee {
  id: string;
  name: string;
  email: string;
}

interface WorkLog {
  id: string;
  task: string;
  hours: number;
  date: string;
  employees: { id: string; name: string; email: string } | null;
}

const emptyForm = {
  employee_id: "",
  task: "",
  hours: "",
  date: new Date().toISOString().slice(0, 10),
};

export default function AdminWorkLogsPage() {
  const { user, profile, loading, session } = useAuth();
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [filterEmployee, setFilterEmployee] = useState("");

  const loadData = () => {
    if (!session?.access_token) return;
    fetch("/api/employees")
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees || []));

    const params = new URLSearchParams({ year: String(year) });
    if (filterEmployee) params.set("employee_id", filterEmployee);

    fetch(`/api/admin/work-logs?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => setWorkLogs(d.work_logs || []))
      .catch(() => setWorkLogs([]));
  };

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (profile?.role !== "admin") { router.replace("/dashboard"); return; }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, loading, router, year, filterEmployee, session?.access_token]);

  const startEdit = (log: WorkLog) => {
    setEditingId(log.id);
    setForm({
      employee_id: log.employees?.id ?? "",
      task: log.task,
      hours: String(log.hours),
      date: log.date,
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.employee_id || !form.task.trim() || !form.hours || !form.date) return;
    setSubmitting(true);
    try {
      const url = editingId
        ? `/api/admin/work-logs?id=${editingId}`
        : "/api/admin/work-logs";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          employee_id: form.employee_id,
          task: form.task.trim(),
          hours: parseFloat(form.hours),
          date: form.date,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed"); return; }
      cancelEdit();
      loadData();
    } catch {
      setError("Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this work log entry?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/work-logs?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      loadData();
    } finally {
      setDeletingId(null);
    }
  };

  const totalHours = workLogs.reduce((s, l) => s + l.hours, 0);

  if (loading || profile?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Work Logs</h1>
          <p className="text-slate-500 mt-1">Record and manage tasks employees performed to earn their pay</p>
        </div>

        {/* Add / Edit Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {editingId ? "Edit Work Log" : "Add Work Log"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
              <select
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              >
                <option value="">Select employee…</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Task / Description</label>
              <input
                type="text"
                value={form.task}
                onChange={(e) => setForm({ ...form, task: e.target.value })}
                placeholder="e.g. Frontend development"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hours</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })}
                placeholder="8"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            {error && (
              <p className="sm:col-span-2 lg:col-span-4 text-sm text-red-600">{error}</p>
            )}

            <div className="sm:col-span-2 lg:col-span-4 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Saving…" : editingId ? "Update Entry" : "Add Entry"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-5 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Filters & Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-800">All Entries</h2>
              <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                {workLogs.length} entries · {totalHours.toLocaleString()} hrs
              </span>
            </div>
            <div className="flex gap-3 flex-wrap">
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Employee</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Task</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                  <th className="py-3 px-4 font-medium text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workLogs.map((log) => (
                  <tr
                    key={log.id}
                    className={`border-t border-slate-100 hover:bg-slate-50/50 ${editingId === log.id ? "bg-emerald-50/60" : ""}`}
                  >
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {log.employees?.name ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{log.task}</td>
                    <td className="text-right py-3 px-4 font-semibold text-slate-800">
                      {log.hours}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{log.date}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(log)}
                          className="px-3 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(log.id)}
                          disabled={deletingId === log.id}
                          className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {deletingId === log.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {workLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No work log entries for {year}
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
