import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { StayType } from "@/types/stay";

const STAY_TYPES: StayType[] = ["pg", "hostel", "co-living"];

interface PropertyPayload {
  name?: string;
  city?: string;
  area?: string;
  type?: string;
  rent?: number | string;
  phone?: string;
  image_url?: string;
  image?: string;
  rooms_available?: number | string;
  roomsAvailable?: number | string;
  amenities?: string[];
  status?: string;
  id?: string;
}

function normalizePayload(payload: PropertyPayload = {}) {
  return {
    name: String(payload.name || "New property").trim(),
    city: String(payload.city || "Bengaluru").trim(),
    area: String(payload.area || "Bengaluru").trim(),
    type: STAY_TYPES.includes(payload.type as StayType) ? (payload.type as StayType) : "pg",
    rent: Number(payload.rent || 0),
    phone: String(payload.phone || "").trim(),
    image_url: String(payload.image_url || payload.image || "").trim(),
    rooms_available: Number(payload.rooms_available || payload.roomsAvailable || 1),
    amenities: Array.isArray(payload.amenities) ? payload.amenities : ["Wi-Fi", "Food", "Laundry"],
    status: String(payload.status || "pending_review"),
  };
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function GET(request: Request) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    let query = supabase.from("properties").select("*").order("created_at", { ascending: false });

    if (searchParams.get("mine") === "true") {
      const token = bearerToken(request);
      if (!token) {
        return NextResponse.json({ ok: false, error: "You must be logged in as an owner." }, { status: 401 });
      }
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        return NextResponse.json({ ok: false, error: "Invalid or expired session." }, { status: 401 });
      }
      query = query.eq("owner_id", userData.user.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok: true, properties: data || [] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load properties." },
      { status: 500 }
    );
  }
}

async function requireOwner(request: Request, supabase: ReturnType<typeof createServiceClient>) {
  const token = bearerToken(request);
  if (!token) return { error: NextResponse.json({ ok: false, error: "You must be logged in as an owner." }, { status: 401 }) };
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return { error: NextResponse.json({ ok: false, error: "Invalid or expired session." }, { status: 401 }) };
  }
  return { ownerId: userData.user.id };
}

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const auth = await requireOwner(request, supabase);
    if (auth.error) return auth.error;

    const payload = normalizePayload(await request.json());
    const { data, error } = await supabase
      .from("properties")
      .insert({ owner_id: auth.ownerId, ...payload })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, property: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to process request." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createServiceClient();
    const auth = await requireOwner(request, supabase);
    if (auth.error) return auth.error;

    const body = await request.json();
    const payload = normalizePayload(body);
    const { searchParams } = new URL(request.url);
    const id = body.id || searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "Property id is required." }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("properties")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", auth.ownerId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, property: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to process request." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createServiceClient();
    const auth = await requireOwner(request, supabase);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id || null;
    }
    if (!id) {
      return NextResponse.json({ ok: false, error: "Property id is required for deletion." }, { status: 400 });
    }
    const { error } = await supabase.from("properties").delete().eq("id", id).eq("owner_id", auth.ownerId);
    if (error) throw error;
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to process request." },
      { status: 500 }
    );
  }
}
