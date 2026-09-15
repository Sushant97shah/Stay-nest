import Link from "next/link";
import { getStaticStays } from "@/lib/data";
import { HomeClient } from "@/components/HomeClient";

export default function HomePage() {
  const staticStays = getStaticStays();

  return (
    <>
      <HomeClient staticStays={staticStays} />

      <section className="feature-band" id="how-it-works">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SIMPLE BY DESIGN</span>
            <h2>Compare with confidence</h2>
          </div>
        </div>
        <div className="steps">
          <div className="step">
            <span>01</span>
            <h3>Discover</h3>
            <p>Browse Google listing photos, locations and review counts for PGs across India.</p>
          </div>
          <div className="step">
            <span>02</span>
            <h3>Shortlist</h3>
            <p>Compare only the rent, amenities and house details that are actually listed.</p>
          </div>
          <div className="step">
            <span>03</span>
            <h3>Review</h3>
            <p>Read Google reviews and share your own experience on a property page.</p>
          </div>
        </div>
      </section>

      <section className="owner-cta" id="owner">
        <div>
          <span className="eyebrow">GROW WITH STAYNEST</span>
          <h2>Have a space to share?</h2>
          <p>Reach genuine residents looking for their next long-term home. List your property in minutes.</p>
          <Link className="btn btn-dark" href="/dashboard">
            List your property <span>→</span>
          </Link>
        </div>
        <div className="owner-art">
          <div className="mini-building">⌂</div>
          <div className="owner-stat">
            <strong>2,500+</strong>
            <small>happy residents</small>
          </div>
        </div>
      </section>
    </>
  );
}
