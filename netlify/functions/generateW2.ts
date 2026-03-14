import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const employerName = process.env.EMPLOYER_NAME || "Employer";
const employerEin = process.env.EMPLOYER_EIN || "00-0000000";

function isChildEmployee(birthDate: string | null, taxYear: number): boolean {
  if (!birthDate) return false;
  try {
    const bd = new Date(birthDate);
    const ageAtYearEnd = taxYear - bd.getFullYear();
    return ageAtYearEnd < 18;
  } catch {
    return false;
  }
}

function formatBox(val: number) {
  return val.toFixed(2);
}

async function generateW2PDF(w2: {
  employeeName: string;
  employeeAddress: string;
  employeeCityStateZip: string;
  wages: number;
  federalTaxWithheld: number;
  socialSecurityWages: number;
  socialSecurityTax: number;
  medicareWages: number;
  medicareTax: number;
  taxYear: number;
}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  const { height } = page.getSize();

  let x = 72;
  let y = height - 80;
  const boxW = 180;
  const boxH = 24;
  const gap = 20;

  page.drawText("Form W-2", { x, y, font: fontBold, size: 14 });
  y -= 20;
  page.drawText(`Wage and Tax Statement - ${w2.taxYear}`, { x, y, font, size: 10 });
  y -= 30;

  page.drawText("Employer's name, address, and ZIP code", { x, y, font: fontBold, size: 9 });
  y -= 14;
  page.drawText(employerName.substring(0, 50), { x, y, font, size: 9 });
  y -= 14;
  page.drawText(`EIN: ${employerEin}`, { x, y, font, size: 9 });
  y -= 28;

  page.drawText("Employee's name", { x, y, font: fontBold, size: 9 });
  y -= 14;
  page.drawText(w2.employeeName.substring(0, 50), { x, y, font, size: 9 });
  y -= 14;
  page.drawText("Employee's address and ZIP code", { x, y, font: fontBold, size: 9 });
  y -= 14;
  page.drawText((w2.employeeAddress || "").substring(0, 50), { x, y, font, size: 9 });
  y -= 14;
  page.drawText((w2.employeeCityStateZip || "").substring(0, 50), { x, y, font, size: 9 });
  y -= 40;

  page.drawText("1 Wages, tips, other compensation", { x, y: y + boxH + 4, font, size: 7 });
  page.drawRectangle({ x, y, width: boxW, height: boxH });
  page.drawText(formatBox(w2.wages), { x: x + 4, y: y + 6, font, size: 10 });
  page.drawText("2 Federal income tax withheld", { x: x + boxW + gap, y: y + boxH + 4, font, size: 7 });
  page.drawRectangle({ x: x + boxW + gap, y, width: boxW, height: boxH });
  page.drawText(formatBox(w2.federalTaxWithheld), { x: x + boxW + gap + 4, y: y + 6, font, size: 10 });
  y -= boxH + gap;

  page.drawText("3 Social security wages", { x, y: y + boxH + 4, font, size: 7 });
  page.drawRectangle({ x, y, width: boxW, height: boxH });
  page.drawText(formatBox(w2.socialSecurityWages), { x: x + 4, y: y + 6, font, size: 10 });
  page.drawText("4 Social security tax withheld", { x: x + boxW + gap, y: y + boxH + 4, font, size: 7 });
  page.drawRectangle({ x: x + boxW + gap, y, width: boxW, height: boxH });
  page.drawText(formatBox(w2.socialSecurityTax), { x: x + boxW + gap + 4, y: y + 6, font, size: 10 });
  y -= boxH + gap;

  page.drawText("5 Medicare wages and tips", { x, y: y + boxH + 4, font, size: 7 });
  page.drawRectangle({ x, y, width: boxW, height: boxH });
  page.drawText(formatBox(w2.medicareWages), { x: x + 4, y: y + 6, font, size: 10 });
  page.drawText("6 Medicare tax withheld", { x: x + boxW + gap, y: y + boxH + 4, font, size: 7 });
  page.drawRectangle({ x: x + boxW + gap, y, width: boxW, height: boxH });
  page.drawText(formatBox(w2.medicareTax), { x: x + boxW + gap + 4, y: y + 6, font, size: 10 });

  return await doc.save();
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body: { employee_id?: string; tax_year?: number };
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body || {};
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const employeeId = body.employee_id;
  const taxYear = parseInt(String(body.tax_year || new Date().getFullYear()), 10);

  if (!employeeId) {
    return { statusCode: 400, body: JSON.stringify({ error: "employee_id required" }) };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: emp, error: empErr } = await supabase.from("employees").select("*").eq("id", employeeId).single();
    if (empErr || !emp) {
      return { statusCode: 404, body: JSON.stringify({ error: "Employee not found" }) };
    }

    const startDate = `${taxYear}-01-01`;
    const endDate = `${taxYear}-12-31`;

    const { data: runs } = await supabase
      .from("payroll_runs")
      .select("gross_pay, tax_withheld")
      .eq("employee_id", employeeId)
      .gte("date", startDate)
      .lte("date", endDate);

    const wages = (runs || []).reduce((s, r) => s + Number(r.gross_pay || 0), 0);
    const federalTax = (runs || []).reduce((s, r) => s + Number(r.tax_withheld || 0), 0);

    const isChild = isChildEmployee(emp.birth_date, taxYear);
    const ssWages = isChild ? 0 : wages;
    const ssTax = isChild ? 0 : 0;
    const medicareWages = isChild ? 0 : wages;
    const medicareTax = isChild ? 0 : 0;

    const cityStateZip = [emp.city, emp.state, emp.zip].filter(Boolean).join(", ");

    const pdfBytes = await generateW2PDF({
      employeeName: emp.name,
      employeeAddress: emp.address || "",
      employeeCityStateZip: cityStateZip,
      wages,
      federalTaxWithheld: federalTax,
      socialSecurityWages: ssWages,
      socialSecurityTax: ssTax,
      medicareWages,
      medicareTax,
      taxYear,
    });

    const base64 = Buffer.from(pdfBytes).toString("base64");
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="W2-${emp.name.replace(/\s+/g, "-")}-${taxYear}.pdf"`,
      },
      body: base64,
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
