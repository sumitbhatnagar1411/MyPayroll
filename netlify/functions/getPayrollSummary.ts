import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { count: employeeCount } = await supabase
      .from("employees")
      .select("*", { count: "exact", head: true });

    const { count: runCount } = await supabase
      .from("payroll_runs")
      .select("*", { count: "exact", head: true });

    const { data: runs } = await supabase.from("payroll_runs").select("gross_pay");
    const totalWages = (runs || []).reduce((s, r) => s + Number(r.gross_pay || 0), 0);

    const summary = {
      total_wages: totalWages,
      total_employees: employeeCount || 0,
      total_payroll_runs: runCount || 0,
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
