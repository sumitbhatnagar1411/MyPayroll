import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const { data: profile } = await supabaseAuth
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((profile as { role?: string })?.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  const { employee_id, document_type, year, file_name, base64 } = req.body as {
    employee_id?: string;
    document_type?: string;
    year?: number;
    file_name?: string;
    base64?: string;
  };

  if (!employee_id || !document_type || !year || !file_name || !base64) {
    return res.status(400).json({ error: "employee_id, document_type, year, file_name, and base64 are required" });
  }

  // Validate allowed file extensions
  const allowedExts = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];
  const ext = file_name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() || "";
  if (!allowedExts.includes(ext)) {
    return res.status(400).json({ error: "Only PDF, Word (.doc/.docx), and Excel (.xls/.xlsx) files are allowed" });
  }

  try {
    const buffer = Buffer.from(base64, "base64");
    const safeName = `${employee_id}/${year}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from("documents")
      .upload(safeName, buffer, { contentType: "application/octet-stream", upsert: false });

    if (storageError) {
      return res.status(500).json({ error: storageError.message });
    }

    // Generate a long-lived signed URL (7 years = 220,752,000 seconds)
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(storageData.path, 220752000);

    if (signedError || !signedData?.signedUrl) {
      return res.status(500).json({ error: "Failed to generate file URL" });
    }

    const { data: doc, error: dbError } = await supabaseAdmin
      .from("employee_documents")
      .insert({
        employee_id,
        uploaded_by: user.id,
        file_name,
        file_url: signedData.signedUrl,
        document_type,
        year,
      })
      .select()
      .single();

    if (dbError) return res.status(500).json({ error: dbError.message });

    return res.status(200).json({ document: doc });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Upload failed" });
  }
}
