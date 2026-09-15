import type { OwnerProperty, Stay, StayType } from "@/types/stay";
import { FALLBACK_IMAGE } from "@/lib/data";

/** Mirrors the old app.js normalizeDbProperty() — turns a `properties` table row into a Stay. */
export function normalizeDbProperty(property: OwnerProperty): Stay {
  const rentNum = Number(property.rent);
  const area = property.area || "Bengaluru";
  const city = property.city || "Bengaluru";
  return {
    id: String(property.id),
    name: property.name || "New property",
    area,
    city,
    location: `${area}, ${city}`,
    type: (property.type as StayType) || "pg",
    rent: rentNum > 0 ? rentNum : null,
    rooms: property.rooms_available ? `${property.rooms_available} rooms available` : "Rooms available",
    amenities:
      Array.isArray(property.amenities) && property.amenities.length
        ? property.amenities
        : ["Wi-Fi", "Food", "Laundry", "Power backup"],
    image: property.image_url || FALLBACK_IMAGE,
    gallery: [],
    verified: property.status === "approved" || property.status === "Live",
    rating: 4.8,
    reviews: 18,
    status: property.status || "pending_review",
    ownerFlag: true,
    contactNumber: property.phone,
    phone: property.phone,
    latitude: null,
    longitude: null,
  };
}
