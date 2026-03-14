import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface PayrollSummaryRow {
  employee_name: string;
  total_wages: number;
  total_payments: number;
  ira_contributions: number;
  payroll_runs_count: number;
}

async function fetchPayrollData(year: number) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data: employees } = await supabase.from("employees").select("id, name");

  const rows: PayrollSummaryRow[] = [];
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
    const runCount = (runs || []).length;

    rows.push({
      employee_name: emp.name,
      total_wages: totalWages,
      total_payments: totalPayments,
      ira_contributions: iraContrib,
      payroll_runs_count: runCount,
    });
  }
  return rows;
}

function formatCurrency(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function toCSV(rows: PayrollSummaryRow[]) {
  const headers = "Employee Name,Total Wages,Total Payments,IRA Contributions,Number of Payroll Runs";
  const body = rows
    .map(
      (r) =>
        `"${r.employee_name}",${formatCurrency(r.total_wages)},${formatCurrency(r.total_payments)},${formatCurrency(r.ira_contributions)},${r.payroll_runs_count}`
    )
    .join("\n");
  return headers + "\n" + body;
}

function toJSON(rows: PayrollSummaryRow[]) {
  return JSON.stringify(
    rows.map((r) => ({
      "Employee Name": r.employee_name,
      "Total Wages": r.total_wages,
      "Total Payments": r.total_payments,
      "IRA Contributions": r.ira_contributions,
      "Number of Payroll Runs": r.payroll_runs_count,
    })),
    null,
    2
  );
}

async function toPDF(rows: PayrollSummaryRow[], year: number) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);

  let y = 720;
  page.drawText(`Payroll Report - ${year}`, { x: 50, y, font: fontBold, size: 16 });
  y -= 30;

  const colWidths = [140, 90, 100, 90, 80];
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

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const params = event.queryStringParameters || {};
  const year = parseInt(params.year || String(new Date().getFullYear()), 10);
  const format = (params.format || "json").toLowerCase();
  if (!["csv", "json", "pdf"].includes(format)) {
    return { statusCode: 400, body: "Invalid format. Use csv, json, or pdf." };
  }

  try {
    const rows = await fetchPayrollData(year);

    if (format === "csv") {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="payroll-report-${year}.csv"`,
        },
        body: toCSV(rows),
      };
    }

    if (format === "json") {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="payroll-report-${year}.json"`,
        },
        body: toJSON(rows),
      };
    }

    const pdfBytes = await toPDF(rows, year);
    const base64 = Buffer.from(pdfBytes).toString("base64");
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="payroll-report-${year}.pdf"`,
      },
      body: base64,
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
