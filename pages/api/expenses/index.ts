import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (req.method === "GET") {
    const year = req.query.year ? parseInt(String(req.query.year), 10) : new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ expenses: data || [] });
  }

  if (req.method === "POST") {
    const { date, vendor, category, description, amount, payment_method, receipt_url, payment_id } = req.body;
    if (!date || !vendor || !category || amount == null) {
      return res.status(400).json({ error: "date, vendor, category, and amount are required" });
    }

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        date,
        vendor,
        category,
        description: description || null,
        amount: parseFloat(amount),
        payment_method: payment_method || null,
        receipt_url: receipt_url || null,
        payment_id: payment_id || null,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
