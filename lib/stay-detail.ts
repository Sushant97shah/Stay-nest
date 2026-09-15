import "server-only";
import { getStayById } from "@/lib/data";
import { normalizeDbProperty } from "@/lib/normalize";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createAnonServerClient } from "@/lib/supabase/server";
import type { Review, Stay } from "@/types/stay";

/** Looks up a stay for the detail page — the static dataset first, then live owner-added properties. */
export async function getStayForDetail(id: string): Promise<Stay | null> {
  const staticStay = getStayById(id);
  if (staticStay) return staticStay;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();
    if (error || !data) return null;
    return normalizeDbProperty(data);
  } catch {
    return null;
  }
}

export async function getStayReviews(stayId: string): Promise<Review[]> {
  try {
    const supabase = await createAnonServerClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("stay_id", String(stayId))
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data || []).map((row) => ({ name: row.reviewer_name, rating: row.rating, text: row.review_text }));
  } catch {
    return [];
  }
}
