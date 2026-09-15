"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function ReviewForm({ stayId }: { stayId: string }) {
  const { supabase } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "");
    const rating = Number(data.get("rating") || 0);
    const text = String(data.get("text") || "");

    setBusy(true);
    let savedRemotely = false;
    if (supabase) {
      try {
        const { error } = await supabase.from("reviews").insert({
          stay_id: String(stayId),
          reviewer_name: name,
          rating,
          review_text: text,
        });
        savedRemotely = !error;
      } catch {
        savedRemotely = false;
      }
    }
    if (!savedRemotely) {
      const key = `reviews-${stayId}`;
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      current.push({ name, rating, text });
      localStorage.setItem(key, JSON.stringify(current));
    }
    setBusy(false);
    form.reset();
    router.refresh();
  }

  return (
    <div className="booking-box">
      <h3>Leave a review</h3>
      <form className="booking-grid" onSubmit={handleSubmit}>
        <label>
          Your name
          <input required name="name" maxLength={60} />
        </label>
        <label>
          Rating
          <select required name="rating" defaultValue="">
            <option value="">Select</option>
            <option value="5">★★★★★</option>
            <option value="4">★★★★</option>
            <option value="3">★★★</option>
            <option value="2">★★</option>
            <option value="1">★</option>
          </select>
        </label>
        <label className="wide-field">
          Your review
          <textarea required name="text" maxLength={500} rows={3} />
        </label>
        <button className="btn btn-dark" disabled={busy}>
          Submit review
        </button>
      </form>
    </div>
  );
}
