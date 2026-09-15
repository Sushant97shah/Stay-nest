import Link from "next/link";
import Image from "next/image";
import type { Stay } from "@/types/stay";
import { money, typeName } from "@/lib/format";

export function ListingCard({
  stay,
  wishlisted,
  onToggleWishlist,
}: {
  stay: Stay;
  wishlisted: boolean;
  onToggleWishlist: (id: string) => void;
}) {
  return (
    <article className="listing-card" style={{ position: "relative" }}>
      <Link href={`/pg/${stay.id}`} style={{ display: "contents", color: "inherit", textDecoration: "none" }}>
        <div className="listing-image">
          {stay.image && (
            <Image
              src={stay.image}
              alt={stay.name}
              fill
              sizes="(max-width: 560px) 100vw, (max-width: 850px) 50vw, 33vw"
              style={{ objectFit: "cover" }}
            />
          )}
          {stay.verified ? <span className="badge">✓ VERIFIED</span> : <span className="badge badge-ghost">NEW</span>}
        </div>
        <div className="listing-info">
          <h3>{stay.name}</h3>
          <div className="location">⌖ {stay.location}</div>
          <div className="card-meta">
            <span>{typeName(stay.type)}</span>
            <span>•</span>
            <span>{stay.rooms}</span>
          </div>
          <div className="card-bottom">
            <div className="price">
              {money(stay.rent)} <small>{typeof stay.rent === "number" ? "/ month" : ""}</small>
            </div>
            <div className="rating">
              ★ {Number(stay.rating || 4.7).toFixed(1)} · {Number(stay.reviews || 0).toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      </Link>
      <button
        className={`heart ${wishlisted ? "active" : ""}`}
        aria-label="Save stay"
        type="button"
        onClick={() => onToggleWishlist(stay.id)}
      >
        {wishlisted ? "♥" : "♡"}
      </button>
    </article>
  );
}
