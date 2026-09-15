import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

interface EnquiryPayload {
  stay_id?: string;
  stay_name?: string;
  name?: string;
  phone?: string;
  message?: string;
}

function normalizeEnquiry(payload: EnquiryPayload = {}) {
  return {
    stay_id: String(payload.stay_id || "").trim(),
    stay_name: String(payload.stay_name || "").trim() || null,
    name: String(payload.name || "").trim(),
    phone: String(payload.phone || "").trim(),
    message: String(payload.message || "").trim() || null,
  };
}

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const payload = normalizeEnquiry(await request.json());
    if (!payload.stay_id || !payload.name || payload.phone.length < 6) {
      return NextResponse.json(
        { ok: false, error: "A stay, your name and a valid phone number are required." },
        { status: 400 }
      );
    }
    const { data, error } = await supabase.from("enquiries").insert(payload).select().single();
    if (error) throw error;
    return NextResponse.json({ ok: true, enquiry: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to process request." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createServiceClient();
    const header = request.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "You must be logged in as an owner." }, { status: 401 });
    }
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ ok: false, error: "Invalid or expired session." }, { status: 401 });
    }
    const ownerId = userData.user.id;
    const { data: ownProperties, error: propError } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", ownerId);
    if (propError) throw propError;
    const ids = (ownProperties || []).map((property) => property.id);
    if (!ids.length) {
      return NextResponse.json({ ok: true, enquiries: [] });
    }
    const { data, error } = await supabase
      .from("enquiries")
      .select("*")
      .in("stay_id", ids)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ ok: true, enquiries: data || [] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to process request." },
      { status: 500 }
    );
  }
}
