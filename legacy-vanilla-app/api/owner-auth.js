const { createClient } = require("@supabase/supabase-js");

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not configured.");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST is allowed." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { mode = "signup", email, password, name } = body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const supabase = getSupabaseClient();
    let result;

    if (mode === "signin") {
      result = await supabase.auth.signInWithPassword({ email, password });
    } else {
      result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name || email.split("@")[0], role: "owner" }
        }
      });
    }

    if (result.error) {
      throw result.error;
    }

    if (result.data?.user) {
      await supabase.from("profiles").upsert({
        id: result.data.user.id,
        full_name: name || result.data.user.email?.split("@")[0] || "Owner",
        role: "owner",
        email: result.data.user.email,
        updated_at: new Date().toISOString()
      });
    }

    return res.status(200).json({
      ok: true,
      action: mode,
      user: result.data?.user || null,
      session: result.data?.session || null
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Authentication failed."
    });
  }
};
