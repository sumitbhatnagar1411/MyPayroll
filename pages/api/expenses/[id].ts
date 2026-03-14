import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: "id required" });

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (req.method === "DELETE") {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  if (req.method === "PATCH") {
    const { date, vendor, category, description, amount, payment_method, receipt_url } = req.body;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (date != null) updates.date = date;
    if (vendor != null) updates.vendor = vendor;
    if (category != null) updates.category = category;
    if (description != null) updates.description = description;
    if (amount != null) updates.amount = parseFloat(amount);
    if (payment_method != null) updates.payment_method = payment_method;
    if (receipt_url != null) updates.receipt_url = receipt_url;

    const { data, error } = await supabase.from("expenses").update(updates).eq("id", id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
