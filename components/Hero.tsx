"use client";

import type { FormEvent } from "react";
import type { StayType } from "@/types/stay";

export function Hero({
  onSearch,
}: {
  onSearch: (params: { location: string; type: StayType | ""; budget: number }) => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSearch({
      location: String(form.get("location") || ""),
      type: (form.get("type") as StayType) || "",
      budget: Number(form.get("budget") || 0),
    });
    document.querySelector("#explore")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section id="home" className="hero">
      <div className="hero-copy">
        <span className="eyebrow">MONTHLY LIVING, MADE SIMPLE</span>
        <h1>
          Live better,
          <br />
          <em>stay brighter.</em>
        </h1>
        <p>Real All India PG listings with verified pricing, locality details, amenities and photos</p>
        <form className="search-card" onSubmit={handleSubmit}>
          <label className="search-field">
            <span className="field-icon">⌖</span>
            <span>
              <small>WHERE</small>
              <input name="location" placeholder="Koramangala, Andheri, Hauz Khas, or any city" autoComplete="off" />
            </span>
          </label>
          <label className="search-field">
            <span className="field-icon">₹</span>
            <span>
              <small>MONTHLY BUDGET</small>
              <select name="budget" defaultValue="">
                <option value="">Any budget</option>
                <option value="10000">Under ₹10,000</option>
                <option value="15000">Under ₹15,000</option>
                <option value="20000">Under ₹20,000</option>
              </select>
            </span>
          </label>
          <label className="search-field">
            <span className="field-icon">♙</span>
            <span>
              <small>STAY TYPE</small>
              <select name="type" defaultValue="">
                <option value="">Any type</option>
                <option value="co-living">Co-living</option>
                <option value="hostel">Hostel</option>
                <option value="pg">PG</option>
              </select>
            </span>
          </label>
          <button className="search-btn" type="submit">
            Search stays <span>→</span>
          </button>
        </form>
        <div className="trust-row">
          <span>✓ Verified properties</span>
          <span>✓ Zero hidden charges</span>
          <span>✓ Local support</span>
        </div>
      </div>
      <div className="hero-art" aria-label="Live All India PG directory">
        <div className="directory-note">
          <strong>Live All India directory</strong>
          <span>Google Places details, photos and review counts</span>
        </div>
      </div>
    </section>
  );
}
