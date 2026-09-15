export type StayType = "pg" | "hostel" | "co-living";

export interface RawStayRecord {
  id: number | string;
  name?: string;
  area?: string;
  locality?: string;
  city?: string;
  address?: string;
  googleMapUrl?: string;
  pincode?: string;
  nearestLandmark?: string;
  latitude?: number;
  longitude?: number;
  facility?: string;
  prices?: {
    singleSharing?: number | string;
    doubleSharing?: number | string;
    tripleSharing?: number | string;
    fourSharing?: number | string;
  };
  priceSingleSharing?: number | string;
  priceDoubleSharing?: number | string;
  priceTripleSharing?: number | string;
  priceFourSharing?: number | string;
  meals?: string;
  otherFacilities?: string[];
  gym?: string;
  parking?: string;
  deposit?: string | number;
  rules?: string[];
  contactNumber?: string;
  phone?: string;
  amenities?: string[];
  image?: string;
  coverImage?: string;
  gallery?: string[];
  photos?: string[];
  type?: StayType;
  rating?: number;
  reviews?: number;
  website?: string;
  verified?: boolean;
}

/** Normalized shape used everywhere in the UI — mirrors the old app.js getCombinedStays() output. */
export interface Stay {
  id: string;
  name: string;
  area: string;
  city: string;
  location: string;
  address?: string;
  type: StayType;
  rent: number | null;
  rooms: string;
  amenities: string[];
  image: string;
  coverImage?: string;
  gallery: string[];
  verified: boolean;
  rating: number;
  reviews: number;
  latitude: number | null;
  longitude: number | null;
  pincode?: string;
  nearestLandmark?: string;
  googleMapUrl?: string;
  contactNumber?: string;
  phone?: string;
  meals?: string;
  gym?: string;
  parking?: string;
  deposit?: string | number;
  prices?: {
    singleSharing?: number | string;
    doubleSharing?: number | string;
    tripleSharing?: number | string;
    fourSharing?: number | string;
  };
  priceSingleSharing?: number | string;
  priceDoubleSharing?: number | string;
  priceTripleSharing?: number | string;
  priceFourSharing?: number | string;
  ownerFlag?: boolean;
  status?: string;
}

export interface Review {
  name: string;
  rating: number;
  text: string;
}

export interface OwnerProperty {
  id: string;
  name: string;
  area: string;
  city?: string;
  type: StayType;
  rent: number;
  rooms_available?: number;
  amenities?: string[];
  image_url?: string;
  phone?: string;
  status?: string;
  owner_id?: string;
  created_at?: string;
}

export interface Enquiry {
  id: string;
  stay_id: string;
  stay_name: string;
  name: string;
  phone: string;
  message: string;
  created_at: string;
}
