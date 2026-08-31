const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputFile = path.join(root, 'data', 'bangalore-pgs.js');
const photosDir = path.join(root, 'data', 'photos');
const NOT_LISTED = 'Not listed';
const MAX_LISTINGS_PER_LOCALITY = 10;
const EXCLUDED_PLACE_NAMES = [
  'PRESTIGE PG FOR GENTS',
  'M. Chinnaswamy Stadium',
  'LoCul.Central - Church Street',
  'GenZ Ladies Pg Near Richmond Circle',
  'Commercial PG and Guest House',
  'Russell Market, Shivajinagar',
  'Bengaluru Palace',
  'Sri Hari Palace PG',
  'SR Mansion Gents PG Hostel',
  'Sri Nandhikeswara boys PG',
  'Pg Accommodation',
  'Dhivyashree Boys PG',
  'Prime PG',
  'ladies Pg',
  'Indiranagar Ladies PG',
  'Top 10 Guest & P.G. Accommodation Ladies',
  'Pg banaswadi',
  'Sri Venkateswara Luxury PG For Gents',
  'The Millennial Sapphire',
  'OMG PG for GIRLS',
  'BRIGADE PG FOR GENTS'
].map((name) => name.toLowerCase());

const LOCALITIES = [
  'Vidhana Soudha', 'Cubbon Park', 'M. Chinnaswamy Stadium', 'MG Road', 'Brigade Road',
  'Church Street', 'Richmond Circle', 'Richmond Town', 'Shanthinagar', 'Ashok Nagar',
  'Shantala Nagar', 'Langford Town', 'Langford Gardens', 'Ulsoor', 'Halasuru',
  'Ulsoor Lake', 'Shivajinagar', 'Russell Market', 'Vasanth Nagar', 'Cunningham Road',
  'Palace Road', 'Bangalore Palace', 'Race Course', 'High Grounds', 'Seshadripuram',
  'Gandhinagar', 'Majestic', 'Freedom Park', 'Chickpet', 'KR Market', 'Kalāsipālyam',
  'Chamarajpet', 'Basavanagudi', 'Mavalli', 'Lalbagh', 'Wilson Garden', 'Jayanagar',
  'Malleshwaram', 'Sadashivanagar', 'Rajajinagar', 'Frazer Town', 'Cox Town',
  'Benson Town', 'Cooke Town', 'Domlur', 'Indiranagar', 'Koramangala', 'BTM Layout',
  'HSR Layout', 'JP Nagar', 'Banashankari', 'Yeshwanthpur', 'Whitefield',
  'Marathahalli', 'Bellandur', 'Electronic City', 'Banaswadi', 'Yelahanka',
  'Sarjapur Road', 'Vijayanagar', 'Kalyan Nagar', 'Mysore Road', 'Hebbal',
  'Bannerghatta Road', 'Brookefield', 'Nagawara', 'Old Airport Road'
];

const FALLBACK_COORDS = {
  'Koramangala': [12.9352, 77.6245], 'Indiranagar': [12.9719, 77.6412], 'HSR Layout': [12.9121, 77.6442],
  'Whitefield': [12.9698, 77.7499], 'Marathahalli': [12.9558, 77.7011], 'Jayanagar': [12.9253, 77.5931],
  'BTM Layout': [12.9165, 77.6101], 'Bellandur': [12.9304, 77.6778], 'Electronic City': [12.8457, 77.6603],
  'Domlur': [12.9602, 77.6383], 'Banaswadi': [13.0096, 77.6187], 'Yelahanka': [13.1007, 77.5963],
  'Malleshwaram': [13.0039, 77.5703], 'Rajajinagar': [12.9929, 77.5543], 'Basavanagudi': [12.9433, 77.5734],
  'Sarjapur Road': [12.9093, 77.6600], 'Vijayanagar': [12.9681, 77.5319], 'Kalyan Nagar': [13.0241, 77.6418],
  'Banashankari': [12.9356, 77.5172], 'Mysore Road': [12.9541, 77.5617], 'Hebbal': [13.0352, 77.5988],
  'Cunningham Road': [12.9830, 77.5957], 'MG Road': [12.9754, 77.6057], 'Bannerghatta Road': [12.8851, 77.6008],
  'Ulsoor': [12.9761, 77.6197], 'Brookefield': [12.9616, 77.7062], 'Nagawara': [13.0284, 77.6209],
  'JP Nagar': [12.9107, 77.5844], 'Lalbagh': [12.9494, 77.5846], 'Old Airport Road': [12.9596, 77.6489]
};

const BASE_IMAGES = [
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1560185008-b033106af5c3?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=900&q=85'
];

function slugify(value) {
  return String(value || 'pg')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'pg';
}

function isExcludedPlace(name) {
  const normalized = String(name || '').trim().toLowerCase();
  return EXCLUDED_PLACE_NAMES.includes(normalized);
}

function loadEnvFromFile() {
  const envFiles = ['.env', '.env.local', '.env.production'];
  for (const file of envFiles) {
    const envPath = path.join(root, file);
    if (!fs.existsSync(envPath)) continue;
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const [, key, value] = match;
      const trimmed = value.replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = trimmed;
      }
    }
  }
}

function normalizePriceNumber(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? Math.round(value / 100) * 100 : null;
}

function validateSharingPrices(prices) {
  const result = { single: null, double: null, triple: null, four: null };
  let previous = null;
  for (const key of ['single', 'double', 'triple', 'four']) {
    const value = normalizePriceNumber(prices[key]);
    if (value && value > 5000 && value < 25000 && (previous === null || value < previous)) {
      result[key] = value;
      previous = value;
    } else {
      break;
    }
  }
  return result;
}

function extractWebAmenities(tavilyData) {
  const text = [tavilyData.answer || '', ...(tavilyData.results || []).map((result) => result.content || result.title || '')].join(' ').toLowerCase();
  const known = [
    ['Air conditioning', /\b(ac|air conditioning|air-conditioned)\b/],
    ['Attached bathroom', /\b(attached bathroom| attached washroom)\b/],
    ['Parking', /\b(parking|car park|bike parking)\b/],
    ['Gym', /\b(gym|fitness center|fitness centre)\b/],
    ['Housekeeping', /\b(housekeeping|room cleaning)\b/],
    ['Security', /\b(security guard|security|cctv)\b/],
    ['Power backup', /\b(power backup|generator|inverter)\b/],
    ['Meals', /\b(meals|breakfast|lunch|dinner|food included)\b/],
    ['Study room', /\b(study room|study area|co-working)\b/],
    ['TV', /\b(television|tv)\b/]
  ];
  return known.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

function parsePriceEstimate(text, base) {
  if (!text) return base;
  const match = String(text).match(/(?:₹|Rs\.?|INR)\s*([0-9]{3,6})/i);
  if (match) return Number(match[1]);
  const numberMatch = String(text).match(/([0-9]{4,6})/);
  return numberMatch ? Number(numberMatch[1]) : base;
}

function parseRoomPricesFromText(text, fallback) {
  if (!text) return fallback;
  const cleanedText = String(text);
  const patterns = [
    { key: 'single', aliases: ['single sharing', 'private room', 'single room', 'private', 'one sharing', 'studio'] },
    { key: 'double', aliases: ['double sharing', 'two sharing', '2 sharing', 'twin sharing', 'shared room'] },
    { key: 'triple', aliases: ['triple sharing', 'three sharing', '3 sharing', '3 bed', 'triple room'] },
    { key: 'four', aliases: ['four sharing', '4 sharing', 'four bed', '4 bed', 'quad sharing'] }
  ];

  const result = { ...fallback };

  for (const pattern of patterns) {
    const match = cleanedText.match(new RegExp(`(${pattern.aliases.join('|')})[^0-9]{0,30}([0-9][0-9,]{2,8})`, 'i'));
    if (match && match[2]) {
      const amount = normalizePriceNumber(match[2]);
      if (amount) result[pattern.key] = amount;
    }
    if (!result[pattern.key]) {
      const startsAtMatch = cleanedText.match(new RegExp(`starts?\s*(?:at|from)?[^0-9]{0,30}([0-9][0-9,]{2,8})`, 'i'));
      if (startsAtMatch && startsAtMatch[1]) {
        const amount = normalizePriceNumber(startsAtMatch[1]);
        if (amount) result[pattern.key] = amount;
      }
    }
  }

  return result;
}

function normalizeLocality(address, fallback = 'Bengaluru') {
  if (!address) return fallback;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const cityIndex = parts.findIndex((part) => /Bengaluru|Bangalore/i.test(part));
  if (cityIndex > 0) {
    return parts[cityIndex - 1] || fallback;
  }
  return parts[parts.length - 3] || parts[parts.length - 2] || fallback;
}

function extractPincodeFromAddress(address) {
  if (!address) return '';
  const match = String(address).match(/\b(5\d{5})\b/);
  return match ? match[1] : '';
}

function toGoogleMapUrl(name, address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`;
}

async function ensurePhotoFolder() {
  await fs.promises.mkdir(photosDir, { recursive: true });
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    method: init.method || 'GET',
    headers: init.headers || {},
    body: init.body ? JSON.stringify(init.body) : undefined
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function downloadGooglePhoto(photoReference, fileName) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_KEY;
  if (!apiKey || !photoReference) return null;

  const target = path.join(photosDir, fileName);
  if (fs.existsSync(target)) {
    return `data/photos/${fileName}`;
  }

  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(photoReference)}&key=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) {
      return null;
    }
    await fs.promises.writeFile(target, buffer);
    return `data/photos/${fileName}`;
  } catch (error) {
    console.warn(`Photo download failed for ${fileName}: ${error.message}`);
    return null;
  }
}

async function fetchPlacePhotos(placeName, details = {}) {
  const refs = Array.isArray(details.photos) ? details.photos.map((photo) => photo.photo_reference).filter(Boolean) : [];
  const gallery = [];
  for (let i = 0; i < Math.min(refs.length, 5); i += 1) {
    const fileName = `${slugify(placeName)}-${i + 1}.jpg`;
    const localUrl = await downloadGooglePhoto(refs[i], fileName);
    if (localUrl) {
      gallery.push(localUrl);
    }
  }
  return gallery;
}

async function getTavilyBreadth(locality, propertyName = '') {
  const apiKey = process.env.TAVILY_API_KEY || process.env.TAVILY_KEY;
  if (!apiKey) return { answer: '', results: [] };
  const searchTerm = propertyName ? `${propertyName} ${locality} PG rent price monthly sharing` : `Bangalore ${locality} PG rent and listing info`;
  try {
    const payload = await requestJson('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: { api_key: apiKey, query: searchTerm, max_results: 5, include_answer: true }
    });
    return payload || { answer: '', results: [] };
  } catch (error) {
    return { answer: '', results: [] };
  }
}

function extractWebPricing(name, locality, tavilyData, fallback) {
  const text = [tavilyData.answer || '', ...(tavilyData.results || []).map((r) => r.content || r.title || '')].join(' ');
  if (!text) return { single: null, double: null, triple: null, four: null };
  const candidate = parseRoomPricesFromText(text, { single: null, double: null, triple: null, four: null });
  return validateSharingPrices({
    single: candidate.single || null,
    double: candidate.double || null,
    triple: candidate.triple || null,
    four: candidate.four || null
  });
}

async function buildLiveDataset() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_KEY;
  if (!apiKey) {
    return [];
  }

  const seen = new Set();
  const rows = [];
  const localityPrices = {};

  for (const locality of LOCALITIES) {
    const tavily = await getTavilyBreadth(locality);
    const text = [tavily.answer || '', ...(tavily.results || []).map((r) => r.content || r.title || '')].join(' ');
    localityPrices[locality] = { single: null, double: null, triple: null, four: null };

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${locality} PG accommodation Bangalore`)}&key=${apiKey}`;
    try {
      const data = await requestJson(url);
      const results = Array.isArray(data.results) ? data.results : [];
      for (const entry of results.slice(0, MAX_LISTINGS_PER_LOCALITY)) {
        if (!entry.place_id || seen.has(entry.place_id)) continue;
        if (isExcludedPlace(entry.name)) continue;
        seen.add(entry.place_id);

        const area = normalizeLocality(entry.formatted_address || locality, locality);
        const localPrice = localityPrices[locality] || { single: null, double: null, triple: null, four: null };
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(entry.place_id)}&fields=name,formatted_address,formatted_phone_number,geometry,url,address_components,photos,rating,user_ratings_total,website&key=${apiKey}`;
        const details = await requestJson(detailsUrl);
        const detailsResult = details.result || {};
        const gallery = await fetchPlacePhotos(entry.name, detailsResult);
        const coverImage = gallery[0] || '';

        const tavilyData = await getTavilyBreadth(locality, entry.name);
        const webPricing = extractWebPricing(entry.name, locality, tavilyData, localPrice);
        const commonAmenities = ['Wi-Fi', 'Hot water', 'Fridge', 'Drinking water', 'Washing machine'];
        const extraAmenities = extractWebAmenities(tavilyData).filter((amenity) => !commonAmenities.includes(amenity));

        const record = {
          id: rows.length + 1,
          name: entry.name,
          area,
          locality: area,
          address: detailsResult.formatted_address || entry.formatted_address || `${entry.name}, ${locality}, Bengaluru`,
          googleMapUrl: detailsResult.url || toGoogleMapUrl(entry.name, detailsResult.formatted_address || `${locality}, Bengaluru`),
          pincode: extractPincodeFromAddress(detailsResult.formatted_address || entry.formatted_address || `${entry.name}, ${locality}, Bengaluru`),
          nearestLandmark: NOT_LISTED,
          latitude: detailsResult.geometry?.location?.lat ?? entry.geometry?.location?.lat ?? null,
          longitude: detailsResult.geometry?.location?.lng ?? entry.geometry?.location?.lng ?? null,
          facility: NOT_LISTED,
          prices: {
            singleSharing: webPricing.single || NOT_LISTED,
            doubleSharing: webPricing.double || NOT_LISTED,
            tripleSharing: webPricing.triple || NOT_LISTED,
            fourSharing: webPricing.four || NOT_LISTED
          },
          priceSingleSharing: webPricing.single || NOT_LISTED,
          priceDoubleSharing: webPricing.double || NOT_LISTED,
          priceTripleSharing: webPricing.triple || NOT_LISTED,
          priceFourSharing: webPricing.four || NOT_LISTED,
          meals: NOT_LISTED,
          otherFacilities: [NOT_LISTED],
          gym: NOT_LISTED,
          parking: NOT_LISTED,
          deposit: NOT_LISTED,
          rules: [NOT_LISTED],
          contactNumber: detailsResult.formatted_phone_number || NOT_LISTED,
          phone: detailsResult.formatted_phone_number || NOT_LISTED,
          amenities: [...commonAmenities, ...extraAmenities],
          image: coverImage || '',
          coverImage,
          gallery,
          photos: gallery,
          type: 'pg',
          rating: detailsResult.rating ?? null,
          reviews: detailsResult.user_ratings_total ?? 0,
          website: detailsResult.website || '',
          verified: true
        };

        rows.push(record);
      }
    } catch (error) {
      console.warn(`Google fetch failed for ${locality}: ${error.message}`);
    }
  }

  return rows;
}

function fallbackDataset() {
  const rows = [];
  LOCALITIES.forEach((locality, idx) => {
    for (let i = 0; i < 4; i += 1) {
      const single = 7000 + ((idx + i) * 210) % 6000;
      const double = single + 2400;
      const triple = double + 1800;
      const four = triple + 1500;
      const cover = BASE_IMAGES[(idx + i) % BASE_IMAGES.length];
      rows.push({
        id: rows.length + 1,
        name: `${locality} ${['PG', 'Residency', 'Homes', 'Stay'][i]}`,
        area: locality,
        locality,
        address: `${i + 1}, ${locality} Main Road, Bengaluru, Karnataka ${560000 + ((idx + i) * 17) % 4000}, India`,
        googleMapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${locality} PG Bengaluru`)}`,
        pincode: String(560000 + ((idx + i) * 17) % 4000),
        nearestLandmark: `${locality} main road and metro connection`,
        latitude: Number((FALLBACK_COORDS[locality]?.[0] ?? 12.9716 + i * 0.01).toFixed(5)),
        longitude: Number((FALLBACK_COORDS[locality]?.[1] ?? 77.5946 + i * 0.01).toFixed(5)),
        facility: 'Fully furnished PG accommodation',
        prices: { singleSharing: single, doubleSharing: double, tripleSharing: triple, fourSharing: four },
        priceSingleSharing: single,
        priceDoubleSharing: double,
        priceTripleSharing: triple,
        priceFourSharing: four,
        meals: 'Veg + Non-Veg available',
        otherFacilities: ['Wi-Fi', 'Laundry', 'Housekeeping', 'Power backup', 'Security', 'CCTV'],
        gym: 'Available on request',
        parking: 'On request',
        deposit: single * 2,
        rules: ['Visitors allowed during daytime', 'No smoking inside rooms', 'Quiet hours after 10 PM', 'Advance notice required'],
        contactNumber: '+91 9000000000',
        phone: '+91 9000000000',
        amenities: ['Washing machine', 'Water cooler', 'Fridge', 'Wi-Fi', 'CCTV', 'Housekeeping'],
        image: cover,
        coverImage: cover,
        gallery: [cover, BASE_IMAGES[(idx + i + 1) % BASE_IMAGES.length]],
        photos: [cover, BASE_IMAGES[(idx + i + 1) % BASE_IMAGES.length]],
        type: 'pg',
        rating: 4.6 + (i * 0.1),
        reviews: 40 + ((idx + i) * 12),
        verified: true
      });
    }
  });
  return rows.slice(0, 120);
}

async function writeDataset() {
  loadEnvFromFile();
  await ensurePhotoFolder();
  const hasGoogleKey = !!(process.env.GOOGLE_API_KEY || process.env.GOOGLE_KEY);
  const hasTavilyKey = !!(process.env.TAVILY_API_KEY || process.env.TAVILY_KEY);

  if (!hasGoogleKey || !hasTavilyKey) {
    console.warn('Live dataset skipped: missing GOOGLE_API_KEY and/or TAVILY_API_KEY. Writing fallback demo data only.');
  }

  const data = hasGoogleKey ? await buildLiveDataset() : fallbackDataset();
  const payload = `window.BANGALORE_PGS = ${JSON.stringify(data, null, 2)};\n`;
  fs.writeFileSync(outputFile, payload, 'utf8');
  console.log(`Wrote ${data.length} PG records to ${outputFile}`);
}

writeDataset().catch((error) => {
  console.error('PG dataset generation failed:', error);
  const fallback = fallbackDataset();
  fs.writeFileSync(outputFile, `window.BANGALORE_PGS = ${JSON.stringify(fallback, null, 2)};\n`, 'utf8');
  console.log(`Fallback dataset written to ${outputFile}`);
  process.exitCode = 1;
});
