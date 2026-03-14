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

  const { data: revenue } = await supabase
    .from("revenue")
    .select("date, source, amount, description")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  const { data: expenses } = await supabase
    .from("expenses")
    .select("date, vendor, category, amount")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  const totalRevenue = (revenue || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  return res.status(200).json({
    year,
    revenue: {
      total: totalRevenue,
      items: revenue || [],
    },
    expenses: {
      total: totalExpenses,
      items: expenses || [],
    },
    net_profit: netProfit,
  });
}
