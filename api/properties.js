const { createClient } = require("@supabase/supabase-js");

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role key is not configured.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function normalizePayload(payload = {}) {
  return {
    name: String(payload.name || "New property").trim(),
    city: String(payload.city || "Bengaluru").trim(),
    area: String(payload.area || "Bengaluru").trim(),
    type: ["pg", "hostel", "co-living"].includes(payload.type) ? payload.type : "pg",
    rent: Number(payload.rent || 0),
    phone: String(payload.phone || "").trim(),
    image_url: String(payload.image_url || payload.image || "").trim(),
    rooms_available: Number(payload.rooms_available || payload.roomsAvailable || 1),
    amenities: Array.isArray(payload.amenities) ? payload.amenities : ["Wi-Fi", "Food", "Laundry"],
    status: String(payload.status || "pending_review")
  };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const supabase = getServiceClient();

    if (req.method === "GET") {
      const { data, error } = await supabase.from("properties").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ ok: true, properties: data || [] });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ ok: false, error: "You must be logged in as an owner." });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ ok: false, error: "Invalid or expired session." });
    }

    const ownerId = userData.user.id;

    if (req.method === "POST") {
      const payload = normalizePayload(typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}));
      const { data, error } = await supabase.from("properties").insert({
        owner_id: ownerId,
        ...payload
      }).select().single();
      if (error) throw error;
      return res.status(201).json({ ok: true, property: data });
    }

    if (req.method === "PATCH") {
      const payload = normalizePayload(typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}));
      const id = payload.id || req.query.id;
      if (!id) {
        return res.status(400).json({ ok: false, error: "Property id is required." });
      }
      const { data, error } = await supabase.from("properties").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id).eq("owner_id", ownerId).select().single();
      if (error) throw error;
      return res.status(200).json({ ok: true, property: data });
    }

    if (req.method === "DELETE") {
      const id = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})).id || req.query.id;
      if (!id) {
        return res.status(400).json({ ok: false, error: "Property id is required for deletion." });
      }
      const { error } = await supabase.from("properties").delete().eq("id", id).eq("owner_id", ownerId);
      if (error) throw error;
      return res.status(200).json({ ok: true, deleted: true });
    }

    return res.status(405).json({ ok: false, error: "Unsupported method." });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Failed to process request." });
  }
};
