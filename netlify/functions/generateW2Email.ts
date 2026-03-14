import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const resendApiKey = process.env.RESEND_API_KEY!;
const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
const employerName = process.env.EMPLOYER_NAME || "Employer";
const employerEin = process.env.EMPLOYER_EIN || "00-0000000";

function isChildEmployee(birthDate: string | null, taxYear: number): boolean {
  if (!birthDate) return false;
  try {
    const bd = new Date(birthDate);
    return taxYear - bd.getFullYear() < 18;
  } catch {
    return false;
  }
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
  y -= 60;
  page.drawText(employerName, { x, y, font, size: 9 });
  y -= 14;
  page.drawText(w2.employeeName, { x, y, font, size: 9 });
  y -= 40;
  page.drawText(`1 Wages: ${w2.wages.toFixed(2)}`, { x, y, font, size: 10 });
  y -= 18;
  page.drawText(`2 Federal tax withheld: ${w2.federalTaxWithheld.toFixed(2)}`, { x, y, font, size: 10 });
  y -= 18;
  page.drawText(`3 Social Security wages: ${w2.socialSecurityWages.toFixed(2)}`, { x, y, font, size: 10 });
  y -= 18;
  page.drawText(`4 Social Security tax: ${w2.socialSecurityTax.toFixed(2)}`, { x, y, font, size: 10 });
  y -= 18;
  page.drawText(`5 Medicare wages: ${w2.medicareWages.toFixed(2)}`, { x, y, font, size: 10 });
  y -= 18;
  page.drawText(`6 Medicare tax: ${w2.medicareTax.toFixed(2)}`, { x, y, font, size: 10 });

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
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const employeeId = body.employee_id;
  const taxYear = parseInt(String(body.tax_year || new Date().getFullYear()), 10);
  if (!employeeId) {
    return { statusCode: 400, body: JSON.stringify({ error: "employee_id required" }) };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: emp } = await supabase.from("employees").select("*").eq("id", employeeId).single();
    if (!emp) return { statusCode: 404, body: JSON.stringify({ error: "Employee not found" }) };

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
    const medicareWages = isChild ? 0 : wages;

    const pdfBytes = await generateW2PDF({
      employeeName: emp.name,
      employeeAddress: emp.address || "",
      employeeCityStateZip: [emp.city, emp.state, emp.zip].filter(Boolean).join(", "),
      wages,
      federalTaxWithheld: federalTax,
      socialSecurityWages: ssWages,
      socialSecurityTax: 0,
      medicareWages,
      medicareTax: 0,
      taxYear,
    });

    const base64Pdf = Buffer.from(pdfBytes).toString("base64");
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [emp.email, adminEmail].filter(Boolean),
        subject: "Your W-2 Form is Ready",
        html: `<p>Your W-2 form for tax year ${taxYear} is attached.</p><p>Please keep this for your records.</p>`,
        attachments: [
          {
            filename: `W2-${emp.name.replace(/\s+/g, "-")}-${taxYear}.pdf`,
            content: base64Pdf,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { statusCode: 500, body: JSON.stringify({ error: "Resend failed", detail: errText }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, message: "W-2 emailed successfully" }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
