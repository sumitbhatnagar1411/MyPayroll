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

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount, category, date")
    .gte("date", startDate)
    .lte("date", endDate);

  const { data: revenue } = await supabase
    .from("revenue")
    .select("amount")
    .gte("date", startDate)
    .lte("date", endDate);

  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalRevenue = (revenue || []).reduce((s, r) => s + Number(r.amount || 0), 0);

  const byCategory: Record<string, number> = {};
  (expenses || []).forEach((e) => {
    const cat = e.category || "Other";
    byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount || 0);
  });

  const byMonth: Record<string, number> = {};
  (expenses || []).forEach((e) => {
    const month = (e.date || "").slice(0, 7);
    if (month) byMonth[month] = (byMonth[month] || 0) + Number(e.amount || 0);
  });
  const monthlyTrend = Object.entries(byMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, amount]) => ({ month, amount }));

  return res.status(200).json({
    total_expenses: totalExpenses,
    total_revenue: totalRevenue,
    net_profit: totalRevenue - totalExpenses,
    by_category: byCategory,
    monthly_trend: monthlyTrend,
  });
}
