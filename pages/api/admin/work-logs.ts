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
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return (profile as { role?: string })?.role === "admin"
    ? { supabaseAdmin: createClient(supabaseUrl, supabaseServiceKey) }
    : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await requireAdmin(req);
  if (!ctx) return res.status(403).json({ error: "Admin only" });

  const { supabaseAdmin } = ctx;

  // GET - list work logs, optionally filtered by year and/or employee
  if (req.method === "GET") {
    const year = req.query.year
      ? parseInt(String(req.query.year), 10)
      : new Date().getFullYear();
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    let query = supabaseAdmin
      .from("work_logs")
      .select(
        "id, task, hours, date, created_at, updated_at, employees(id, name, email)"
      )
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false });

    if (req.query.employee_id) {
      query = query.eq("employee_id", String(req.query.employee_id));
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ work_logs: data || [] });
  }

  // POST - create a new work log
  if (req.method === "POST") {
    const { employee_id, task, hours, date } = req.body;
    if (!employee_id || !task?.trim() || hours == null || !date) {
      return res
        .status(400)
        .json({ error: "employee_id, task, hours, and date are required" });
    }
    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      return res.status(400).json({ error: "hours must be a positive number" });
    }
    const { data, error } = await supabaseAdmin
      .from("work_logs")
      .insert({ employee_id, task: task.trim(), hours: parsedHours, date })
      .select("id, task, hours, date, employees(id, name, email)")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  // PUT - update an existing work log
  if (req.method === "PUT") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id query param required" });
    const { task, hours, date, employee_id } = req.body;
    if (!task?.trim() || hours == null || !date) {
      return res.status(400).json({ error: "task, hours, and date are required" });
    }
    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      return res.status(400).json({ error: "hours must be a positive number" });
    }
    const updateData: Record<string, unknown> = {
      task: task.trim(),
      hours: parsedHours,
      date,
      updated_at: new Date().toISOString(),
    };
    if (employee_id) updateData.employee_id = employee_id;

    const { data, error } = await supabaseAdmin
      .from("work_logs")
      .update(updateData)
      .eq("id", String(id))
      .select("id, task, hours, date, employees(id, name, email)")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // DELETE - remove a work log
  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id query param required" });
    const { error } = await supabaseAdmin
      .from("work_logs")
      .delete()
      .eq("id", String(id));
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
