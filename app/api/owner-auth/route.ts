import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode = "signup", email, password, name } = body || {};
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
    }

    const supabase = createAnonClient();

    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name || email.split("@")[0], role: "owner" } },
          });

    if (result.error) throw result.error;

    if (result.data?.user) {
      await supabase.from("profiles").upsert({
        id: result.data.user.id,
        full_name: name || result.data.user.email?.split("@")[0] || "Owner",
        role: "owner",
        email: result.data.user.email,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ok: true,
      action: mode,
      user: result.data?.user || null,
      session: result.data?.session || null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Authentication failed." },
      { status: 400 }
    );
  }
}
