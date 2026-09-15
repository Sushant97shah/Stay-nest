import bangalorePgs from "@/data/bangalore-pgs.json";
import indiaPgs from "@/data/india-pgs.json";
import type { RawStayRecord, Stay, StayType } from "@/types/stay";

const NOT_LISTED = "Not listed";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=85";

const rawDataset = [...(bangalorePgs as RawStayRecord[]), ...(indiaPgs as RawStayRecord[])];

function normalizeStay(pg: RawStayRecord, index: number): Stay {
  const singlePrice = typeof pg.priceSingleSharing === "number" && pg.priceSingleSharing > 0 ? pg.priceSingleSharing : null;
  return {
    id: String(pg.id ?? index + 1),
    name: pg.name || NOT_LISTED,
    area: pg.area || pg.locality || "Bengaluru",
    city: pg.city || "Bengaluru",
    location: `${pg.area || pg.locality || "Bengaluru"}, ${pg.city || "Bengaluru"}`,
    address: pg.address,
    type: (pg.type as StayType) || "pg",
    rent: singlePrice,
    rooms: "Single / Double / Triple / 4 Sharing",
    amenities: Array.isArray(pg.amenities) && pg.amenities.length ? pg.amenities : [NOT_LISTED],
    image: pg.coverImage || pg.image || FALLBACK_IMAGE,
    coverImage: pg.coverImage || pg.image,
    gallery: Array.isArray(pg.gallery) ? pg.gallery.filter(Boolean) : [],
    verified: pg.verified === true,
    rating: pg.rating || 4.6,
    reviews: pg.reviews || 0,
    latitude: typeof pg.latitude === "number" ? pg.latitude : null,
    longitude: typeof pg.longitude === "number" ? pg.longitude : null,
    pincode: pg.pincode,
    nearestLandmark: pg.nearestLandmark,
    googleMapUrl: pg.googleMapUrl,
    contactNumber: pg.contactNumber,
    phone: pg.phone,
    meals: pg.meals,
    gym: pg.gym,
    parking: pg.parking,
    deposit: pg.deposit,
    prices: pg.prices,
    priceSingleSharing: pg.priceSingleSharing,
    priceDoubleSharing: pg.priceDoubleSharing,
    priceTripleSharing: pg.priceTripleSharing,
    priceFourSharing: pg.priceFourSharing,
  };
}

let cachedStays: Stay[] | null = null;

/** All static-dataset stays (Bangalore + All India), normalized. Does not include live owner-added properties. */
export function getStaticStays(): Stay[] {
  if (!cachedStays) {
    cachedStays = rawDataset.map(normalizeStay);
  }
  return cachedStays;
}

export function getStayById(id: string): Stay | undefined {
  return getStaticStays().find((stay) => stay.id === id);
}

export { NOT_LISTED, FALLBACK_IMAGE };
