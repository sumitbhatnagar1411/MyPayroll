import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function requireAdmin(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return (profile as { role?: string })?.role === "admin"
    ? { supabaseAdmin: createClient(supabaseUrl, supabaseServiceKey) }
    : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireAdmin(req);
  if (!ctx) return res.status(403).json({ error: "Admin only" });

  const { supabaseAdmin } = ctx;

  if (req.method === "GET") {
    const year = req.query.year ? parseInt(String(req.query.year), 10) : new Date().getFullYear();
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id, amount, date, method, transaction_reference, created_at, employees(id, name, email)")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false });
    return res.status(200).json({ payments: data || [] });
  }

  if (req.method === "POST") {
    const { employee_id, amount, date, method, transaction_reference } = req.body;
    if (!employee_id || amount == null || !date) {
      return res.status(400).json({ error: "employee_id, amount, and date required" });
    }
    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert({
        employee_id,
        amount: parseFloat(amount),
        date,
        method: method || null,
        transaction_reference: transaction_reference || null,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
