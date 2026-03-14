import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
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
  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { data: profile } = await supabaseAuth.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string })?.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  const { name, email, role, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password required" });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  const authUserId = authData.user.id;

  await supabaseAdmin.from("profiles").upsert(
    { id: authUserId, role: role === "admin" ? "admin" : "employee", updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );

  const { data: emp, error: empError } = await supabaseAdmin
    .from("employees")
    .insert({
      auth_user_id: authUserId,
      name,
      email,
    })
    .select()
    .single();

  if (empError) {
    return res.status(500).json({ error: empError.message });
  }

  return res.status(201).json(emp);
}
