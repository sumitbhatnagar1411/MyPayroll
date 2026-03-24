import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth-context";

interface EmployeeDocument {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string;
  year: number;
  created_at: string;
}

const DOC_TYPE_LABEL: Record<string, string> = {
  offer_letter: "Offer Letter",
  contract: "Employment Contract",
  nda: "NDA",
  performance_review: "Performance Review",
  tax_form: "Tax Form",
  policy: "Company Policy",
  other: "Other",
};

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

export default function MyDocuments() {
  const { user, profile, loading, session } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [filterYear, setFilterYear] = useState("");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (profile?.role === "admin") { router.replace("/admin/documents"); return; }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!session?.access_token) return;
    setFetching(true);
    fetch("/api/documents", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => setDocuments(d.documents || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [session?.access_token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-pulse text-slate-400">Loading…</div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-slate-100">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-slate-500 hover:text-slate-700 transition-colors"
            aria-label="Back to dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-slate-800">My Documents</h1>
        </div>
        <span className="text-sm text-slate-500">{documents.length} document{documents.length !== 1 ? "s" : ""} total</span>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        {/* Year filter */}
        {availableYears.length > 1 && (
          <div className="mb-6">
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All years</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {fetching ? (
          <div className="text-center py-16 text-slate-400 animate-pulse">Loading documents…</div>
        ) : sortedYears.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
            <svg className="w-12 h-12 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-400 text-sm">No documents have been shared with you yet.</p>
          </div>
        ) : (
          sortedYears.map((year) => (
            <div key={year} className="mb-8">
              <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-600 text-sm font-medium">{year}</span>
                <span className="text-slate-400 text-sm font-normal">
                  {byYear[year].length} document{byYear[year].length !== 1 ? "s" : ""}
                </span>
              </h2>
              <div className="space-y-3">
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
                    <div
                      key={doc.id}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <svg className={`w-8 h-8 shrink-0 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate" title={doc.file_name}>
                            {doc.file_name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="inline-block bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded">
                              {DOC_TYPE_LABEL[doc.document_type] || doc.document_type}
                            </span>
                            <span className="text-xs text-slate-400">{formatDate(doc.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
