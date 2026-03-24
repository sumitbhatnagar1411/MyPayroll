import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/lib/auth-context";

interface Employee {
  id: string;
  name: string;
  email: string;
}

interface EmployeeDocument {
  id: string;
  employee_id: string;
  file_name: string;
  file_url: string;
  document_type: string;
  year: number;
  created_at: string;
  employees: { name: string; email: string } | null;
}

const DOCUMENT_TYPES = [
  { value: "offer_letter", label: "Offer Letter" },
  { value: "contract", label: "Employment Contract" },
  { value: "nda", label: "NDA" },
  { value: "performance_review", label: "Performance Review" },
  { value: "tax_form", label: "Tax Form" },
  { value: "policy", label: "Company Policy" },
  { value: "other", label: "Other" },
];

const DOC_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPES.map((d) => [d.value, d.label])
);

const FILE_ICON: Record<string, string> = {
  ".pdf": "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  ".doc": "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  ".docx": "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  ".xls": "M3 10h18M3 14h18M10 3v18M14 3v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z",
  ".xlsx": "M3 10h18M3 14h18M10 3v18M14 3v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z",
};

function getExt(name: string) {
  return name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() || "";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDocuments() {
  const { user, profile, loading, session } = useAuth();
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterYear, setFilterYear] = useState("");

  // Upload form state
  const [selEmployee, setSelEmployee] = useState("");
  const [docType, setDocType] = useState("offer_letter");
  const [docYear, setDocYear] = useState(new Date().getFullYear().toString());
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (profile?.role !== "admin") router.replace("/admin");
  }, [user, profile, loading, router]);

  // Fetch employees list
  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/employees", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees || []))
      .catch(() => {});
  }, [session?.access_token]);

  // Fetch documents
  useEffect(() => {
    if (!session?.access_token) return;
    const params = new URLSearchParams();
    if (filterEmployee) params.set("employee_id", filterEmployee);
    fetch(`/api/documents?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => setDocuments(d.documents || []))
      .catch(() => {});
  }, [session?.access_token, filterEmployee]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setUploadError("");
    setUploadSuccess("");
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");
    setUploadSuccess("");

    if (!selEmployee) { setUploadError("Please select an employee."); return; }
    if (!file) { setUploadError("Please select a file."); return; }
    if (!docYear || isNaN(Number(docYear))) { setUploadError("Please enter a valid year."); return; }

    const allowedExts = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];
    const ext = getExt(file.name);
    if (!allowedExts.includes(ext)) {
      setUploadError("Only PDF, Word (.doc/.docx), and Excel (.xls/.xlsx) files are allowed.");
      return;
    }

    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({
          employee_id: selEmployee,
          document_type: docType,
          year: Number(docYear),
          file_name: file.name,
          base64,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setUploadSuccess("Document uploaded successfully.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Refresh documents list
      const params = new URLSearchParams();
      if (filterEmployee) params.set("employee_id", filterEmployee);
      fetch(`/api/documents?${params}`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      })
        .then((r) => r.json())
        .then((d) => setDocuments(d.documents || []))
        .catch(() => {});
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading || profile?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  // Group documents by year
  const filteredDocs = filterYear
    ? documents.filter((d) => d.year === Number(filterYear))
    : documents;

  const byYear = filteredDocs.reduce<Record<number, EmployeeDocument[]>>((acc, doc) => {
    (acc[doc.year] = acc[doc.year] || []).push(doc);
    return acc;
  }, {});
  const sortedYears = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a);

  const availableYears = [...new Set(documents.map((d) => d.year))].sort((a, b) => b - a);

  return (
    <AdminLayout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Employee Documents</h1>
          <p className="text-slate-500 mt-1">Upload and manage documents for employees</p>
        </div>

        {/* Upload Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Upload Document</h2>
          <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Employee select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Employee <span className="text-red-500">*</span>
              </label>
              <select
                value={selEmployee}
                onChange={(e) => setSelEmployee(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="">Select employee…</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Document type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Document Type <span className="text-red-500">*</span>
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={docYear}
                onChange={(e) => setDocYear(e.target.value)}
                min={2000}
                max={2100}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* File input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                File <span className="text-red-500">*</span>
                <span className="text-slate-400 font-normal ml-1">(PDF, DOC, DOCX, XLS, XLSX)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 file:mr-3 file:border-0 file:bg-emerald-50 file:text-emerald-700 file:rounded file:px-2 file:py-1 file:text-xs file:font-medium"
              />
              {file && (
                <p className="text-xs text-slate-500 mt-1 truncate">{file.name}</p>
              )}
            </div>

            {/* Buttons + messages */}
            <div className="md:col-span-2 flex items-center gap-4 flex-wrap">
              <button
                type="submit"
                disabled={uploading}
                className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {uploading ? "Uploading…" : "Upload Document"}
              </button>
              {uploadError && (
                <p className="text-sm text-red-600">{uploadError}</p>
              )}
              {uploadSuccess && (
                <p className="text-sm text-emerald-600">{uploadSuccess}</p>
              )}
            </div>
          </form>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All years</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Documents grouped by year */}
        {sortedYears.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-400">
            No documents found.
          </div>
        ) : (
          sortedYears.map((year) => (
            <div key={year} className="mb-8">
              <h3 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-600 text-sm font-medium">{year}</span>
                <span className="text-slate-400 text-sm font-normal">{byYear[year].length} document{byYear[year].length !== 1 ? "s" : ""}</span>
              </h3>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-3">File</th>
                      <th className="text-left px-4 py-3">Employee</th>
                      <th className="text-left px-4 py-3">Type</th>
                      <th className="text-left px-4 py-3">Uploaded</th>
                      <th className="text-left px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {byYear[year].map((doc) => {
                      const ext = getExt(doc.file_name);
                      const iconPath = FILE_ICON[ext] || FILE_ICON[".pdf"];
                      const isExcel = ext === ".xls" || ext === ".xlsx";
                      const isWord = ext === ".doc" || ext === ".docx";
                      const iconColor = isExcel
                        ? "text-green-600"
                        : isWord
                        ? "text-blue-600"
                        : "text-red-500";
                      return (
                        <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <svg className={`w-5 h-5 shrink-0 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
                              </svg>
                              <span className="truncate max-w-[200px] text-slate-700" title={doc.file_name}>
                                {doc.file_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {doc.employees?.name || "—"}
                            <span className="block text-xs text-slate-400">{doc.employees?.email}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded">
                              {DOC_TYPE_LABEL[doc.document_type] || doc.document_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                            {formatDate(doc.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-xs font-medium"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
}
