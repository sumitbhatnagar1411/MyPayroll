import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth-context";

interface WorkLog {
  id: string;
  task: string;
  hours: number;
  date: string;
  status: "pending" | "approved" | "rejected";
  submitted_by: string;
  rejection_reason?: string;
}

const emptyForm = {
  task: "",
  hours: "",
  date: new Date().toISOString().slice(0, 10),
};

export default function EmployeeWorkLogsPage() {
  const { user, loading, session } = useAuth();
  const router = useRouter();

  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const loadData = () => {
    if (!session?.access_token) return;

    const params = new URLSearchParams({ 
      year: String(year),
      month: String(month)
    });
    fetch(`/api/employee/work-logs?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => setWorkLogs(d.work_logs || []))
      .catch(() => setWorkLogs([]));
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router, year, month, session?.access_token]);

  const startEdit = (log: WorkLog) => {
    if (log.status === "approved") {
      setError("You cannot edit approved work logs. Contact your admin.");
      return;
    }
    setEditingId(log.id);
    setForm({
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
    if (!form.task.trim() || !form.hours || !form.date) {
      setError("All fields are required");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingId
        ? `/api/employee/work-logs?id=${editingId}`
        : "/api/employee/work-logs";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          task: form.task.trim(),
          hours: parseFloat(form.hours),
          date: form.date,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save work log");
        return;
      }

      cancelEdit();
      loadData();
    } catch {
      setError("Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Delete this work log submission? It will be permanently removed."
      )
    )
      return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/employee/work-logs?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete");
        return;
      }

      loadData();
    } catch {
      setError("Request failed");
    } finally {
      setDeletingId(null);
    }
  };

  const pendingLogs = workLogs.filter((log) => log.status === "pending");
  const approvedLogs = workLogs.filter((log) => log.status === "approved");
  const rejectedLogs = workLogs.filter((log) => log.status === "rejected");

  const totalApprovedHours = approvedLogs.reduce((s, l) => s + l.hours, 0);
  const totalPendingHours = pendingLogs.reduce((s, l) => s + l.hours, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full">
        {/* Header */}
        <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 sticky top-0 z-40 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 truncate">Work Logs</h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 truncate">Submit your time entries</p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex-shrink-0 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium rounded-lg transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>

        <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-6xl mx-auto w-full">
          {/* Submit Form */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-4">
              {editingId
                ? "Edit Work Log"
                : "Submit New Work Log"}
            </h2>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Task / Description
                  </label>
                  <input
                    type="text"
                    value={form.task}
                    onChange={(e) =>
                      setForm({ ...form, task: e.target.value })
                    }
                    placeholder="e.g. Frontend development"
                    className="w-full text-sm sm:text-base border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={form.hours}
                    onChange={(e) =>
                      setForm({ ...form, hours: e.target.value })
                    }
                    placeholder="8"
                    className="w-full text-sm sm:text-base border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm({ ...form, date: e.target.value })
                    }
                    className="w-full text-sm sm:text-base border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="col-span-full flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 sm:py-3 bg-emerald-600 text-white text-sm sm:text-base font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? "Saving…" : editingId ? "Update" : "Submit"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex-1 sm:flex-none px-4 py-2.5 sm:py-3 bg-slate-100 text-slate-700 text-sm sm:text-base font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-slate-600 uppercase tracking-wide font-medium">Approved Hours</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 sm:mt-2">
                {totalApprovedHours}
              </p>
            </div>
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-slate-600 uppercase tracking-wide font-medium">Pending Hours</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-600 mt-1 sm:mt-2">
                {totalPendingHours}
              </p>
            </div>
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-slate-600 uppercase tracking-wide font-medium">Total Entries</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 sm:mt-2">
                {workLogs.length}
              </p>
            </div>
          </div>

          {/* Year & Month Filters */}
          <div className="mb-6 sm:mb-8 flex flex-wrap gap-3">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="w-full text-sm sm:text-base border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                className="w-full text-sm sm:text-base border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
              >
                <option value={1}>January</option>
                <option value={2}>February</option>
                <option value={3}>March</option>
                <option value={4}>April</option>
                <option value={5}>May</option>
                <option value={6}>June</option>
                <option value={7}>July</option>
                <option value={8}>August</option>
                <option value={9}>September</option>
                <option value={10}>October</option>
                <option value={11}>November</option>
                <option value={12}>December</option>
              </select>
            </div>
          </div>

          {/* Pending Logs */}
          {pendingLogs.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-slate-100 bg-yellow-50">
                <h3 className="font-semibold text-slate-800">
                  ⏳ Pending Approval ({pendingLogs.length})
                </h3>
                <p className="text-sm text-slate-600">
                  Waiting for admin review
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left py-3 px-4 font-medium text-slate-600">
                        Task
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">
                        Hours
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">
                        Date
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingLogs.map((log) => (
                      <tr key={log.id} className="border-t border-slate-100 hover:bg-yellow-50/60">
                        <td className="py-3 px-4 text-slate-700">{log.task}</td>
                        <td className="text-right py-3 px-4 font-semibold text-slate-800">
                          {log.hours}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{log.date}</td>
                        <td className="text-right py-3 px-4">
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
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Approved Logs */}
          {approvedLogs.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-slate-100 bg-emerald-50">
                <h3 className="font-semibold text-slate-800">
                  ✓ Approved ({approvedLogs.length})
                </h3>
                <p className="text-sm text-slate-600">
                  {totalApprovedHours} hours
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left py-3 px-4 font-medium text-slate-600">
                        Task
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">
                        Hours
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">
                        Submitted By
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedLogs.map((log) => (
                      <tr key={log.id} className="border-t border-slate-100 hover:bg-emerald-50/60">
                        <td className="py-3 px-4 text-slate-700">{log.task}</td>
                        <td className="text-right py-3 px-4 font-semibold text-slate-800">
                          {log.hours}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{log.date}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              log.submitted_by === "admin"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {log.submitted_by === "admin"
                              ? "Admin Created"
                              : "You Submitted"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rejected Logs */}
          {rejectedLogs.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-red-50">
                <h3 className="font-semibold text-slate-800">
                  ✗ Rejected ({rejectedLogs.length})
                </h3>
                <p className="text-sm text-slate-600">
                  Please review and resubmit
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left py-3 px-4 font-medium text-slate-600">
                        Task
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">
                        Hours
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">
                        Rejection Reason
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejectedLogs.map((log) => (
                      <tr key={log.id} className="border-t border-slate-100 hover:bg-red-50/60">
                        <td className="py-3 px-4 text-slate-700">{log.task}</td>
                        <td className="text-right py-3 px-4 font-semibold text-slate-800">
                          {log.hours}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{log.date}</td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs">
                          {log.rejection_reason ? (
                            <span className="text-red-700 text-xs">
                              {log.rejection_reason}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-right py-3 px-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => startEdit(log)}
                              className="px-3 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
                            >
                              Resubmit
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
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty State */}
          {workLogs.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <p className="text-slate-500 mb-2">No work log entries yet</p>
              <p className="text-slate-400 text-sm">
                Submit your first work log above to get started
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
