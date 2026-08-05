// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy notify-nearby-shelters
//
// Called from the app whenever a "stray_found" post is created. For the
// prototype this uses simple city-string matching (per Section 4.2 / Phase 2
// of the proposal); swap in PostGIS + lat/lng for real geo-radius matching later.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  try {
    const { city } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find approved NGOs categorised as animal shelters in the same city.
    const { data: shelters, error } = await supabaseAdmin
      .from("ngos")
      .select("profile_id, org_name, city, category")
      .ilike("category", "%animal%")
      .eq("city", city);

    if (error) throw error;

    if (shelters && shelters.length > 0) {
      const rows = shelters.map((s: { profile_id: string }) => ({
        recipient_id: s.profile_id,
        type: "stray_found_alert",
        message: `New stray/found report near ${city}. Open the app to respond.`,
        read_status: false,
      }));
      await supabaseAdmin.from("notifications").insert(rows);
    }

    return new Response(JSON.stringify({ notified: shelters?.length ?? 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 400 });
  }
});
