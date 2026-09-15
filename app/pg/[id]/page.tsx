import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStaticStays } from "@/lib/data";
import { getStayForDetail, getStayReviews } from "@/lib/stay-detail";
import { money } from "@/lib/format";
import { EnquiryForm } from "@/components/EnquiryForm";
import { ReviewForm } from "@/components/ReviewForm";

const NOT_LISTED = "Not listed";

export function generateStaticParams() {
  return getStaticStays().map((stay) => ({ id: stay.id }));
}

export async function generateMetadata({ params }: PageProps<"/pg/[id]">): Promise<Metadata> {
  const { id } = await params;
  const stay = await getStayForDetail(id);
  if (!stay) return {};

  const title = `${stay.name} — ${stay.location} | StayNest`;
  const description = `${stay.name} in ${stay.location}. ${
    typeof stay.rent === "number" ? `Starting from ₹${stay.rent.toLocaleString("en-IN")}/month.` : ""
  } Verified pricing, amenities and photos on StayNest.`;

  return {
    title,
    description,
    alternates: { canonical: `/pg/${stay.id}` },
    openGraph: { title, description, images: stay.image ? [stay.image] : undefined, type: "website" },
    twitter: { card: "summary_large_image", title, description, images: stay.image ? [stay.image] : undefined },
  };
}

export default async function StayDetailPage({ params }: PageProps<"/pg/[id]">) {
  const { id } = await params;
  const stay = await getStayForDetail(id);
  if (!stay) notFound();

  const reviews = await getStayReviews(stay.id);
  const prices = stay.prices || {};
  const propertyMeta = `${stay.area || "Bengaluru"} · ${stay.address || stay.location}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: stay.name,
    description: `${stay.name} — ${stay.type} in ${stay.location}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: stay.area,
      addressRegion: stay.city,
      postalCode: stay.pincode,
      addressCountry: "IN",
    },
    ...(stay.latitude && stay.longitude
      ? { geo: { "@type": "GeoCoordinates", latitude: stay.latitude, longitude: stay.longitude } }
      : {}),
    ...(stay.image ? { image: stay.image } : {}),
    ...(stay.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: stay.rating, reviewCount: stay.reviews || 1 } } : {}),
  };

  return (
    <section className="section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="detail-head">
        {stay.image ? (
          <Image src={stay.image} alt={stay.name} width={220} height={180} className="photo-thumb main-photo" />
        ) : (
          <div className="missing-image">{NOT_LISTED}</div>
        )}
        <div className="detail-info">
          <span className="eyebrow">VERIFIED STAY</span>
          <h2>{stay.name}</h2>
          <p className="location">⌖ {propertyMeta}</p>
          <p className="rating">
            ★ {(stay.rating || 4.7).toFixed(1)} · {(stay.reviews || 0).toLocaleString("en-IN")} reviews
          </p>
          <p className="location">
            Pincode: {stay.pincode || NOT_LISTED} · Landmark: {stay.nearestLandmark || NOT_LISTED}
          </p>
          <p className="contact-top">
            <strong>Contact:</strong> {stay.contactNumber || stay.phone || NOT_LISTED}
          </p>
        </div>
      </div>

      {stay.gallery.length > 0 && (
        <div className="photo-gallery">
          {stay.gallery.map((image) => (
            <Image key={image} src={image} alt={stay.name} width={220} height={110} className="photo-thumb" loading="lazy" />
          ))}
        </div>
      )}

      <div className="amenities">
        {stay.amenities.map((item) => (
          <span key={item}>✓ {item}</span>
        ))}
      </div>

      <div className="booking-box">
        <h3>Pricing &amp; house details</h3>
        <div className="booking-grid">
          <label>
            Single sharing
            <input value={money(prices.singleSharing || stay.priceSingleSharing || stay.rent)} readOnly />
          </label>
          <label>
            Double sharing
            <input value={money(prices.doubleSharing || stay.priceDoubleSharing)} readOnly />
          </label>
          <label>
            Triple sharing
            <input value={money(prices.tripleSharing || stay.priceTripleSharing)} readOnly />
          </label>
          <label>
            4 sharing
            <input value={money(prices.fourSharing || stay.priceFourSharing)} readOnly />
          </label>
          <label>
            Meals
            <input value={stay.meals || NOT_LISTED} readOnly />
          </label>
          <label>
            Deposit
            <input value={money(stay.deposit || NOT_LISTED)} readOnly />
          </label>
        </div>
        <p className="location">
          Gym: <strong>{stay.gym || NOT_LISTED}</strong> · Parking: <strong>{stay.parking || NOT_LISTED}</strong>
        </p>
        {stay.googleMapUrl && (
          <a className="btn btn-dark" href={stay.googleMapUrl} target="_blank" rel="noopener noreferrer">
            Open in Google Maps →
          </a>
        )}
      </div>

      <EnquiryForm stayId={stay.id} stayName={stay.name} contactNumber={stay.contactNumber || stay.phone} />
      <ReviewForm stayId={stay.id} />

      <div className="booking-box">
        <h3>User reviews</h3>
        <ul className="review-list">
          {reviews.length ? (
            reviews.map((review, index) => (
              <li key={index}>
                <strong>{review.name}</strong> · {"★".repeat(Number(review.rating || 5))}
                <br />
                {review.text}
              </li>
            ))
          ) : (
            <li>{NOT_LISTED}</li>
          )}
        </ul>
      </div>

      <p style={{ marginTop: 20 }}>
        <Link className="text-link" href="/#explore">
          ← Back to all listings
        </Link>
      </p>
    </section>
  );
}
