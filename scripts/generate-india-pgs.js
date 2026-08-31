/**
 * Multi-city PG dataset generator ("all India" expansion).
 *
 * Same methodology as scripts/generate-bangalore-pgs.js (Google Places
 * Text Search + Place Details + Tavily pricing enrichment + downloaded
 * Place Photos), generalized to run across a list of cities instead of a
 * single city's hand-curated locality list. Bangalore's existing verified
 * dataset (data/bangalore-pgs.js) is left untouched -- this script only
 * produces NEW cities' data, written to data/all-india-pgs.js
 * (window.INDIA_PGS), so Bangalore is never re-fetched / re-billed.
 *
 * Usage:
 *   node scripts/generate-india-pgs.js                  # all cities in CITIES
 *   node scripts/generate-india-pgs.js "Delhi,Mumbai"    # only these cities
 *
 * Requires GOOGLE_API_KEY and TAVILY_API_KEY (loaded from .env if present).
 * Progress is written incrementally to data/all-india-pgs.js after each
 * city finishes, so an interrupted run keeps whatever completed so far.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputFile = path.join(root, 'data', 'all-india-pgs.js');
const photosDir = path.join(root, 'data', 'photos');
const NOT_LISTED = 'Not listed';

const MIN_LISTINGS_PER_CITY = 50;
const CANDIDATE_TARGET_PER_CITY = 90;
const PROCESS_CAP_PER_CITY = 85;
const MAX_PHOTOS_PER_LISTING = 2;
const MAX_PAGES_PER_QUERY = 3;

const QUERY_TEMPLATES = [
  'PG accommodation in {city}',
  'hostel for students in {city}',
  'co-living space in {city}',
  'PG for working professionals in {city}'
];

const CITIES = [
  'Delhi', 'Mumbai', 'Pune', 'Hyderabad', 'Chennai', 'Gurugram', 'Noida', 'Kolkata',
  'Ahmedabad', 'Jaipur', 'Lucknow', 'Indore', 'Kota', 'Navi Mumbai', 'Thane', 'Chandigarh',
  'Mohali', 'Coimbatore', 'Surat', 'Nagpur', 'Bhopal', 'Bhubaneswar', 'Visakhapatnam',
  'Patna', 'Vadodara', 'Mysuru', 'Mangaluru', 'Dehradun', 'Vijayawada', 'Kochi',
  'Thiruvananthapuram', 'Guwahati', 'Ranchi', 'Kanpur', 'Varanasi', 'Prayagraj', 'Agra',
  'Nashik', 'Chhatrapati Sambhajinagar', 'Rajkot', 'Jodhpur', 'Udaipur', 'Amritsar',
  'Ludhiana', 'Jamshedpur', 'Salem', 'Tiruchirappalli', 'Manipal', 'Vellore'
];

function slugify(value) {
  return String(value || 'pg')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'pg';
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
    if (value && value > 3000 && value < 30000 && (previous === null || value < previous)) {
      result[key] = value;
      previous = value;
    } else {
      break;
    }
  }
  return result;
}

function extractWebAmenities(tavilyData) {
  const text = [tavilyData.answer || '', ...(tavilyData.results || []).map((r) => r.content || r.title || '')].join(' ').toLowerCase();
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
      const startsAtMatch = cleanedText.match(new RegExp(`starts?\\s*(?:at|from)?[^0-9]{0,30}([0-9][0-9,]{2,8})`, 'i'));
      if (startsAtMatch && startsAtMatch[1]) {
        const amount = normalizePriceNumber(startsAtMatch[1]);
        if (amount) result[pattern.key] = amount;
      }
    }
  }

  return result;
}

function extractPincodeFromAddress(address) {
  if (!address) return '';
  const match = String(address).match(/\b(\d{6})\b/);
  return match ? match[1] : '';
}

function toGoogleMapUrl(name, address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`;
}

function normalizeLocality(address, cityName) {
  if (!address) return cityName;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const cityIndex = parts.findIndex((part) => part.toLowerCase().includes(cityName.toLowerCase()));
  if (cityIndex > 0) return parts[cityIndex - 1] || cityName;
  return parts[parts.length - 3] || parts[parts.length - 2] || cityName;
}

function isLikelyAccommodation(entry) {
  const types = Array.isArray(entry.types) ? entry.types : [];
  if (types.includes('lodging')) return true;
  const nameLower = String(entry.name || '').toLowerCase();
  return /\b(pg|hostel|co-?living|paying guest|boys|girls|ladies|gents|men'?s|women'?s|stay|residency|nest)\b/.test(nameLower);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) return null;
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
  for (let i = 0; i < Math.min(refs.length, MAX_PHOTOS_PER_LISTING); i += 1) {
    const fileName = `${slugify(placeName)}-${i + 1}.jpg`;
    const localUrl = await downloadGooglePhoto(refs[i], fileName);
    if (localUrl) gallery.push(localUrl);
  }
  return gallery;
}

async function getTavilyBreadth(propertyName, locality) {
  const apiKey = process.env.TAVILY_API_KEY || process.env.TAVILY_KEY;
  if (!apiKey) return { answer: '', results: [] };
  const searchTerm = `${propertyName} ${locality} PG rent price monthly sharing`;
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

function extractWebPricing(tavilyData) {
  const text = [tavilyData.answer || '', ...(tavilyData.results || []).map((r) => r.content || r.title || '')].join(' ');
  if (!text) return { single: null, double: null, triple: null, four: null };
  const candidate = parseRoomPricesFromText(text, { single: null, double: null, triple: null, four: null });
  return validateSharingPrices(candidate);
}

async function searchCityCandidates(cityName, apiKey) {
  const candidates = new Map();

  for (const template of QUERY_TEMPLATES) {
    if (candidates.size >= CANDIDATE_TARGET_PER_CITY) break;
    const query = template.replace('{city}', cityName);
    let pageToken = null;
    for (let page = 0; page < MAX_PAGES_PER_QUERY; page += 1) {
      if (candidates.size >= CANDIDATE_TARGET_PER_CITY) break;
      const url = pageToken
        ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${pageToken}&key=${apiKey}`
        : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
      try {
        if (pageToken) await sleep(2200); // next_page_token needs a short delay before it activates
        const data = await requestJson(url);
        const results = Array.isArray(data.results) ? data.results : [];
        for (const entry of results) {
          if (!entry.place_id || candidates.has(entry.place_id)) continue;
          if (!isLikelyAccommodation(entry)) continue;
          candidates.set(entry.place_id, entry);
        }
        pageToken = data.next_page_token || null;
        if (!pageToken) break;
      } catch (error) {
        console.warn(`Search failed for "${query}" (page ${page + 1}): ${error.message}`);
        break;
      }
    }
  }

  return [...candidates.values()];
}

async function buildCityDataset(cityName, startId) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_KEY;
  const rows = [];
  console.log(`\n=== ${cityName} ===`);
  const candidates = await searchCityCandidates(cityName, apiKey);
  console.log(`  found ${candidates.length} candidate places, processing up to ${PROCESS_CAP_PER_CITY}`);

  for (const entry of candidates.slice(0, PROCESS_CAP_PER_CITY)) {
    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(entry.place_id)}&fields=name,formatted_address,formatted_phone_number,geometry,url,address_components,photos,rating,user_ratings_total,website&key=${apiKey}`;
      const details = await requestJson(detailsUrl);
      const detailsResult = details.result || {};
      const area = normalizeLocality(detailsResult.formatted_address || entry.formatted_address, cityName);
      const gallery = await fetchPlacePhotos(entry.name, detailsResult);
      const coverImage = gallery[0] || '';

      const tavilyData = await getTavilyBreadth(entry.name, area);
      const webPricing = extractWebPricing(tavilyData);
      const commonAmenities = ['Wi-Fi', 'Hot water', 'Fridge', 'Drinking water', 'Washing machine'];
      const extraAmenities = extractWebAmenities(tavilyData).filter((amenity) => !commonAmenities.includes(amenity));

      rows.push({
        id: `${slugify(cityName)}-${rows.length + 1}`,
        name: entry.name,
        area,
        locality: area,
        city: cityName,
        address: detailsResult.formatted_address || entry.formatted_address || `${entry.name}, ${cityName}`,
        googleMapUrl: detailsResult.url || toGoogleMapUrl(entry.name, detailsResult.formatted_address || cityName),
        pincode: extractPincodeFromAddress(detailsResult.formatted_address || entry.formatted_address),
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
        image: coverImage,
        coverImage,
        gallery,
        photos: gallery,
        type: 'pg',
        rating: detailsResult.rating ?? null,
        reviews: detailsResult.user_ratings_total ?? 0,
        website: detailsResult.website || '',
        verified: true
      });
    } catch (error) {
      console.warn(`  skipped "${entry.name}": ${error.message}`);
    }
  }

  if (rows.length < MIN_LISTINGS_PER_CITY) {
    console.warn(`  WARNING: only ${rows.length} verified listings for ${cityName} (target was ${MIN_LISTINGS_PER_CITY})`);
  } else {
    console.log(`  done: ${rows.length} verified listings for ${cityName}`);
  }

  return rows;
}

function writeDataset(rows) {
  const payload = `window.INDIA_PGS = ${JSON.stringify(rows, null, 2)};\n`;
  fs.writeFileSync(outputFile, payload, 'utf8');
}

async function main() {
  loadEnvFromFile();
  await ensurePhotoFolder();

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_KEY;
  if (!apiKey) {
    console.error('GOOGLE_API_KEY is required for the multi-city dataset generation. Aborting.');
    process.exitCode = 1;
    return;
  }

  const cliCities = process.argv[2] ? process.argv[2].split(',').map((c) => c.trim()).filter(Boolean) : null;
  const cities = cliCities && cliCities.length ? cliCities : CITIES;

  let allRows = [];
  if (fs.existsSync(outputFile)) {
    try {
      const win = {};
      new Function('window', fs.readFileSync(outputFile, 'utf8'))(win);
      allRows = Array.isArray(win.INDIA_PGS) ? win.INDIA_PGS : [];
      console.log(`Resuming: ${allRows.length} existing records loaded from ${outputFile}`);
    } catch {
      allRows = [];
    }
  }

  const alreadyDoneCities = new Set(allRows.map((r) => r.city));

  for (const city of cities) {
    if (alreadyDoneCities.has(city)) {
      console.log(`Skipping ${city} (already present in ${path.basename(outputFile)} -- delete its rows first to re-run it)`);
      continue;
    }
    const cityRows = await buildCityDataset(city, allRows.length + 1);
    allRows = allRows.concat(cityRows);
    writeDataset(allRows);
  }

  console.log(`\nWrote ${allRows.length} total records across ${new Set(allRows.map((r) => r.city)).size} cities to ${outputFile}`);
}

main().catch((error) => {
  console.error('India PG dataset generation failed:', error);
  process.exitCode = 1;
});
