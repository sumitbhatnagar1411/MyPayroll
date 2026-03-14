import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface ReportRow {
  employee_name: string;
  total_wages: number;
  total_payments: number;
  ira_contributions: number;
  payroll_runs_count: number;
}

async function fetchPayrollData(year: number): Promise<ReportRow[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const { data: employees } = await supabase.from("employees").select("id, name");
  const rows: ReportRow[] = [];

  for (const emp of employees || []) {
    const { data: runs } = await supabase
      .from("payroll_runs")
      .select("gross_pay, tax_withheld")
      .eq("employee_id", emp.id)
      .gte("date", startDate)
      .lte("date", endDate);
    const { data: payments } = await supabase
      .from("payments")
      .select("amount")
      .eq("employee_id", emp.id)
      .gte("date", startDate)
      .lte("date", endDate);
    const { data: ira } = await supabase
      .from("ira_contributions")
      .select("amount")
      .eq("employee_id", emp.id)
      .eq("year", year);

    const totalWages = (runs || []).reduce((s, r) => s + Number(r.gross_pay || 0), 0);
    const totalPayments = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const iraContrib = (ira || []).reduce((s, i) => s + Number(i.amount || 0), 0);
    rows.push({
      employee_name: emp.name,
      total_wages: totalWages,
      total_payments: totalPayments,
      ira_contributions: iraContrib,
      payroll_runs_count: (runs || []).length,
    });
  }
  return rows;
}

function formatCurrency(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function toCSV(rows: ReportRow[]) {
  const headers = "Employee Name,Total Wages,Total Payments,IRA Contributions,Number of Payroll Runs";
  const body = rows
    .map((r) =>
      `"${r.employee_name}",${formatCurrency(r.total_wages)},${formatCurrency(r.total_payments)},${formatCurrency(r.ira_contributions)},${r.payroll_runs_count}`
    )
    .join("\n");
  return headers + "\n" + body;
}

async function toPDF(rows: ReportRow[], year: number) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  let y = 720;
  const colWidths = [140, 90, 100, 90, 80];
  page.drawText(`Payroll Report - ${year}`, { x: 50, y, font: fontBold, size: 16 });
  y -= 30;
  let x = 50;
  page.drawText("Employee Name", { x, y, font: fontBold, size: 9 });
  x += colWidths[0];
  page.drawText("Total Wages", { x, y, font: fontBold, size: 9 });
  x += colWidths[1];
  page.drawText("Total Payments", { x, y, font: fontBold, size: 9 });
  x += colWidths[2];
  page.drawText("IRA Contrib", { x, y, font: fontBold, size: 9 });
  x += colWidths[3];
  page.drawText("Payroll Runs", { x, y, font: fontBold, size: 9 });
  y -= 15;
  for (const r of rows) {
    if (y < 80) break;
    x = 50;
    page.drawText(r.employee_name.substring(0, 22), { x, y, font, size: 9 });
    x += colWidths[0];
    page.drawText(formatCurrency(r.total_wages), { x, y, font, size: 9 });
    x += colWidths[1];
    page.drawText(formatCurrency(r.total_payments), { x, y, font, size: 9 });
    x += colWidths[2];
    page.drawText(formatCurrency(r.ira_contributions), { x, y, font, size: 9 });
    x += colWidths[3];
    page.drawText(String(r.payroll_runs_count), { x, y, font, size: 9 });
    y -= 18;
  }
  return await doc.save();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const year = req.query.year ? parseInt(String(req.query.year), 10) : new Date().getFullYear();
  const format = (req.query.format as string) || "json";

  try {
    const rows = await fetchPayrollData(year);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="payroll-report-${year}.csv"`);
      return res.status(200).send(toCSV(rows));
    }

    if (format === "pdf") {
      const pdfBytes = await toPDF(rows, year);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="payroll-report-${year}.pdf"`);
      return res.status(200).send(pdfBytes);
    }

    const jsonRows = rows.map((r) => ({
      "Employee Name": r.employee_name,
      "Total Wages": r.total_wages,
      "Total Payments": r.total_payments,
      "IRA Contributions": r.ira_contributions,
      "Number of Payroll Runs": r.payroll_runs_count,
    }));
    return res.status(200).json(jsonRows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch report" });
  }
}
