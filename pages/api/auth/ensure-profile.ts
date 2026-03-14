import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("id", user.id).single();
  if (existing) return res.status(200).json({ ok: true });

  await supabaseAdmin.from("profiles").insert({ id: user.id, role: "employee" });
  return res.status(201).json({ ok: true });
}
