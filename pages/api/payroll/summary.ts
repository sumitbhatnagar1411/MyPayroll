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
    const { count: employeeCount } = await supabase
      .from("employees")
      .select("*", { count: "exact", head: true });
    const { count: runCount } = await supabase
      .from("payroll_runs")
      .select("*", { count: "exact", head: true });
    const { data: runs } = await supabase.from("payroll_runs").select("gross_pay");
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
