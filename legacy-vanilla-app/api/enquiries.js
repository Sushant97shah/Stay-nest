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

function normalizeEnquiry(payload = {}) {
  return {
    stay_id: String(payload.stay_id || "").trim(),
    stay_name: String(payload.stay_name || "").trim() || null,
    name: String(payload.name || "").trim(),
    phone: String(payload.phone || "").trim(),
    message: String(payload.message || "").trim() || null
  };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const supabase = getServiceClient();

    if (req.method === "POST") {
      const payload = normalizeEnquiry(typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}));
      if (!payload.stay_id || !payload.name || payload.phone.length < 6) {
        return res.status(400).json({ ok: false, error: "A stay, your name and a valid phone number are required." });
      }
      const { data, error } = await supabase.from("enquiries").insert(payload).select().single();
      if (error) throw error;
      return res.status(201).json({ ok: true, enquiry: data });
    }

    if (req.method === "GET") {
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
      const { data: ownProperties, error: propError } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", ownerId);
      if (propError) throw propError;
      const ids = (ownProperties || []).map((property) => property.id);
      if (!ids.length) {
        return res.status(200).json({ ok: true, enquiries: [] });
      }
      const { data, error } = await supabase
        .from("enquiries")
        .select("*")
        .in("stay_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ ok: true, enquiries: data || [] });
    }

    return res.status(405).json({ ok: false, error: "Unsupported method." });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Failed to process request." });
  }
};
