import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const year = req.query.year ? parseInt(String(req.query.year), 10) : new Date().getFullYear();
    const month = req.query.month ? parseInt(String(req.query.month), 10) : null;
    
    let startDate: string;
    let endDate: string;
    
    if (month) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      startDate = start.toISOString().split('T')[0];
      endDate = end.toISOString().split('T')[0];
    } else {
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    }
    
    const { count: employeeCount } = await supabase
      .from("employees")
      .select("*", { count: "exact", head: true });
    
    let runsQuery = supabase
      .from("payroll_runs")
      .select("*", { count: "exact", head: true })
      .gte("date", startDate)
      .lte("date", endDate);
    
    const { count: runCount } = await runsQuery;
    
    let dataQuery = supabase
      .from("payroll_runs")
      .select("gross_pay")
      .gte("date", startDate)
      .lte("date", endDate);
    
    const { data: runs } = await dataQuery;
    const totalWages = (runs || []).reduce((s, r) => s + Number(r.gross_pay || 0), 0);
    return res.status(200).json({
      total_wages: totalWages,
      total_employees: employeeCount || 0,
      total_payroll_runs: runCount || 0,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch summary" });
  }
}
