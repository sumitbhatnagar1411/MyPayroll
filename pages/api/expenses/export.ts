import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const year = req.query.year ? parseInt(String(req.query.year), 10) : new Date().getFullYear();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data } = await supabase
    .from("expenses")
    .select("date, vendor, category, amount")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  const rows = (data || []).map((e) => ({
    Date: e.date,
    Vendor: e.vendor,
    Category: e.category,
    Amount: Number(e.amount || 0).toFixed(2),
  }));

  const csv = [
    "Date,Vendor,Category,Amount",
    ...rows.map((r) => `"${r.Date}","${r.Vendor}","${r.Category}",${r.Amount}`),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="expense-report-${year}.csv"`);
  return res.status(200).send(csv);
}
