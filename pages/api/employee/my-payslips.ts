import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const { data: emp } = await supabase.from("employees").select("id").eq("auth_user_id", user.id).single();
  if (!emp) return res.status(404).json({ error: "Employee record not found" });

  const year = req.query.year ? parseInt(String(req.query.year), 10) : new Date().getFullYear();
  const month = req.query.month ? parseInt(String(req.query.month), 10) : null;
  
  let start: string;
  let end: string;
  
  if (month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    start = startDate.toISOString().split('T')[0];
    end = endDate.toISOString().split('T')[0];
  } else {
    start = `${year}-01-01`;
    end = `${year}-12-31`;
  }

  const { data: runs } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("employee_id", emp.id)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("employee_id", emp.id)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  return res.status(200).json({ payroll_runs: runs || [], payments: payments || [] });
}
