// Supabase Edge Function (Deno). Deploy with:
//   supabase functions deploy notify-nearby-shelters
//
// Called from the app whenever a "stray_found" post is created.
//
// Matching now uses real geographic radius matching (Haversine distance via
// the public.nearby_animal_shelters RPC added in
// supabase/migration_09_geo_radius.sql), instead of the previous
// city-string comparison. The radius is configurable below — change
// DEFAULT_RADIUS_KM (or pass a different `radiusKm` in the request body) to
// reconfigure it without touching the matching logic.
//
// Fallback: if the report has no lat/lng (older client, denied location
// permission, etc.), this falls back to the previous city-match behaviour
// so those users are not silently dropped.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const DEFAULT_RADIUS_KM = 15;

serve(async (req) => {
  try {
    const { city, latitude, longitude, radiusKm } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let shelters: { profile_id: string; org_name?: string }[] = [];

    if (typeof latitude === "number" && typeof longitude === "number") {
      // Real geo-radius matching, computed in the database.
      const { data, error } = await supabaseAdmin.rpc("nearby_animal_shelters", {
        p_lat: latitude,
        p_lng: longitude,
        p_radius_km: typeof radiusKm === "number" ? radiusKm : DEFAULT_RADIUS_KM,
      });
      if (error) throw error;
      shelters = data ?? [];
    } else if (city) {
      // No coordinates on this report — fall back to the original
      // city-string match rather than sending nobody a notification.
      const { data, error } = await supabaseAdmin
        .from("ngos")
        .select("profile_id, org_name, profiles!inner(verification_status)")
        .ilike("category", "%animal%")
        .eq("city", city)
        .eq("profiles.verification_status", "approved");
      if (error) throw error;
      shelters = (data as any[]) ?? [];
    }

    if (shelters.length > 0) {
      const rows = shelters.map((s) => ({
        recipient_id: s.profile_id,
        type: "stray_found_alert",
        message: city
          ? `New stray/found report near ${city}. Open the app to respond.`
          : `New stray/found report near you. Open the app to respond.`,
        read_status: false,
      }));
      await supabaseAdmin.from("notifications").insert(rows);
    }

    return new Response(JSON.stringify({ notified: shelters.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 400 });
  }
});
