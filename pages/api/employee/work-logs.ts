import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getEmployeeContext(token: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return null;

  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  return emp ? { employee_id: emp.id, supabase } : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.replace("Bearer ", "");
  const ctx = await getEmployeeContext(token);

  if (!ctx) {
    return res.status(401).json({ error: "Employee record not found" });
  }

  const { employee_id, supabase } = ctx;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // GET - list employee's work logs
  if (req.method === "GET") {
    const year = req.query.year
      ? parseInt(String(req.query.year), 10)
      : new Date().getFullYear();
    const month = req.query.month
      ? parseInt(String(req.query.month), 10)
      : null;

    let start: string;
    let end: string;

    if (month) {
      // Specific month in specific year
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      start = startDate.toISOString().split("T")[0];
      end = endDate.toISOString().split("T")[0];
    } else {
      // All months in the year
      start = `${year}-01-01`;
      end = `${year}-12-31`;
    }

    const { data, error } = await supabase
      .from("work_logs")
      .select("id, task, hours, date, status, submitted_by, rejection_reason")
      .eq("employee_id", employee_id)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ work_logs: data || [] });
  }

  // POST - employee submits new work log
  if (req.method === "POST") {
    const { task, hours, date } = req.body;

    if (!task?.trim() || hours == null || !date) {
      return res.status(400).json({
        error: "task, hours, and date are required",
      });
    }

    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      return res.status(400).json({ error: "hours must be a positive number" });
    }

    const { data, error } = await supabaseAdmin
      .from("work_logs")
      .insert({
        employee_id,
        task: task.trim(),
        hours: parsedHours,
        date,
        status: "pending",
        submitted_by: "employee",
      })
      .select("id, task, hours, date, status, submitted_by")
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json(data);
  }

  // PUT - employee updates their pending/rejected work log
  if (req.method === "PUT") {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: "id query param required" });
    }

    const { task, hours, date } = req.body;

    if (!task?.trim() || hours == null || !date) {
      return res.status(400).json({
        error: "task, hours, and date are required",
      });
    }

    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      return res.status(400).json({ error: "hours must be a positive number" });
    }

    // Check if the work log belongs to the employee and is editable (pending or rejected)
    const { data: existing } = await supabaseAdmin
      .from("work_logs")
      .select("id, status")
      .eq("id", String(id))
      .eq("employee_id", employee_id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: "Work log not found" });
    }

    if (existing.status === "approved") {
      return res.status(403).json({
        error: "Cannot edit approved work logs. Contact admin.",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("work_logs")
      .update({
        task: task.trim(),
        hours: parsedHours,
        date,
        status: "pending",
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", String(id))
      .select("id, task, hours, date, status, submitted_by")
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  }

  // DELETE - employee cancels their pending submission
  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: "id query param required" });
    }

    // Check if the work log belongs to the employee and is not approved
    const { data: existing } = await supabaseAdmin
      .from("work_logs")
      .select("id, status")
      .eq("id", String(id))
      .eq("employee_id", employee_id)
      .eq("submitted_by", "employee")
      .single();

    if (!existing) {
      return res.status(404).json({ error: "Work log not found" });
    }

    if (existing.status === "approved") {
      return res.status(403).json({
        error: "Cannot delete approved work logs.",
      });
    }

    const { error } = await supabaseAdmin
      .from("work_logs")
      .delete()
      .eq("id", String(id));

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
