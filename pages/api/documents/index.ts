import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const { data: profile } = await supabaseAuth
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as { role?: string })?.role;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    if (role === "admin") {
      // Admin: can optionally filter by employee_id via query param
      const { employee_id } = req.query;
      let query = supabaseAdmin
        .from("employee_documents")
        .select("id, employee_id, file_name, file_url, document_type, year, created_at, employees(name, email)")
        .order("created_at", { ascending: false });

      if (employee_id && typeof employee_id === "string") {
        query = query.eq("employee_id", employee_id);
      }

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ documents: data || [] });
    } else {
      // Employee: only their own documents
      const { data: emp } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!emp) return res.status(200).json({ documents: [] });

      const { data, error } = await supabaseAdmin
        .from("employee_documents")
        .select("id, file_name, file_url, document_type, year, created_at")
        .eq("employee_id", (emp as { id: string }).id)
        .order("created_at", { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ documents: data || [] });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch documents" });
  }
}
