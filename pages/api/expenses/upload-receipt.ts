import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { base64, filename } = req.body as { base64?: string; filename?: string };
  if (!base64) {
    return res.status(400).json({ error: "No file data" });
  }

  try {
    const buffer = Buffer.from(base64, "base64");
    const ext = filename?.match(/\.[a-z0-9]+$/i)?.[0] || ".pdf";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.storage.from("receipts").upload(name, buffer, {
      contentType: "application/octet-stream",
      upsert: false,
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(data.path);
    return res.status(200).json({ receipt_url: urlData.publicUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Upload failed" });
  }
}
