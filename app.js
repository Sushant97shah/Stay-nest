const NOT_LISTED = "Not listed";
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=85";
const PAGE_SIZE = 24;
const STORAGE_KEYS = {
  auth: "staynest-auth-session",
  ownerProperties: "staynest-owner-properties",
  ownerProfile: "staynest-owner-profile",
  wishlist: "staynest-wishlist"
};
const baseDataset = Array.isArray(window.BANGALORE_PGS) ? window.BANGALORE_PGS : [];
const ownerSeed = [
  { id: "owner-1", name: "Sushant Residency", area: "Koramangala", city: "Bengaluru", type: "pg", rent: 12000, image: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=85", phone: "9876543210", status: "Live", roomsAvailable: 8 },
  { id: "owner-2", name: "Sunrise Co-Living", area: "HSR Layout", city: "Bengaluru", type: "co-living", rent: 15500, image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85", phone: "9988776655", status: "Live", roomsAvailable: 4 },
  { id: "owner-3", name: "Greenfield Hostel", area: "Whitefield", city: "Bengaluru", type: "hostel", rent: 9500, image: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=900&q=85", phone: "9765432100", status: "Pending review", roomsAvailable: 6 }
];

const getOwnerProperties = () => {
  const saved = localStorage.getItem(STORAGE_KEYS.ownerProperties);
  if (saved) return JSON.parse(saved);
  localStorage.setItem(STORAGE_KEYS.ownerProperties, JSON.stringify(ownerSeed));
  return ownerSeed;
};

const setOwnerProperties = (items) => localStorage.setItem(STORAGE_KEYS.ownerProperties, JSON.stringify(items));
const getUserSession = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.auth) || "null");
const setUserSession = (user) => localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(user));
const clearUserSession = () => localStorage.removeItem(STORAGE_KEYS.auth);
const typeName = (type) => type === "co-living" ? "Co-living" : type === "pg" ? "PG" : "Hostel";
const display = (value) => value === undefined || value === null || value === "" ? NOT_LISTED : value;
const money = (value) => typeof value === "number" ? `₹${value.toLocaleString("en-IN")}` : display(value);
const escapeHtml = (value) => String(display(value)).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

// ---------------------------------------------------------------------------
// Data merge: static dataset + real backend properties (or localStorage demo)
// ---------------------------------------------------------------------------

function normalizeDbProperty(property) {
  const rentNum = Number(property.rent);
  return {
    id: property.id,
    name: property.name || "New property",
    area: property.area || "Bengaluru",
    location: `${property.area || "Bengaluru"}, ${property.city || "Bengaluru"}`,
    type: property.type || "pg",
    rent: rentNum > 0 ? rentNum : null,
    rooms: property.rooms_available ? `${property.rooms_available} rooms available` : "Rooms available",
    amenities: Array.isArray(property.amenities) && property.amenities.length ? property.amenities : ["Wi-Fi", "Food", "Laundry", "Power backup"],
    image: property.image_url || FALLBACK_IMAGE,
    verified: property.status === "approved" || property.status === "Live",
    rating: 4.8,
    reviews: 18,
    status: property.status || "pending_review",
    ownerFlag: true,
    contactNumber: property.phone,
    phone: property.phone,
    latitude: null,
    longitude: null
  };
}

function normalizeLocalOwnerProperty(property, index) {
  const rentNum = Number(property.rent);
  return {
    id: property.id || `owner-${index + 1}`,
    name: property.name || "New property",
    area: property.area || property.locality || "Bengaluru",
    location: `${property.area || property.locality || "Bengaluru"}, ${property.city || "Bengaluru"}`,
    type: property.type || "pg",
    rent: rentNum > 0 ? rentNum : null,
    rooms: property.roomsAvailable ? `${property.roomsAvailable} rooms available` : "Rooms available",
    amenities: property.amenities || ["Wi-Fi", "Food", "Laundry", "Power backup"],
    image: property.image || FALLBACK_IMAGE,
    verified: property.status === "Live",
    rating: 4.8,
    reviews: 18,
    status: property.status || "Live",
    ownerFlag: true,
    contactNumber: property.phone,
    phone: property.phone,
    latitude: null,
    longitude: null
  };
}

const getCombinedStays = () => {
  const dataset = baseDataset.map((pg, index) => ({
    ...pg,
    id: pg.id || index + 1,
    name: pg.name || NOT_LISTED,
    location: `${pg.area || pg.locality || "Bengaluru"}, Bengaluru`,
    type: pg.type || "pg",
    rent: typeof pg.priceSingleSharing === "number" && pg.priceSingleSharing > 0 ? pg.priceSingleSharing : null,
    rooms: "Single / Double / Triple / 4 Sharing",
    amenities: Array.isArray(pg.amenities) && pg.amenities.length ? pg.amenities : [NOT_LISTED],
    image: pg.coverImage || pg.image || "",
    verified: pg.verified === true,
    area: pg.area || pg.locality || "Bengaluru",
    rating: pg.rating || 4.6,
    reviews: pg.reviews || 0,
    latitude: typeof pg.latitude === "number" ? pg.latitude : null,
    longitude: typeof pg.longitude === "number" ? pg.longitude : null
  }));
  const ownerProps = state.supabase
    ? state.dbProperties.map(normalizeDbProperty)
    : getOwnerProperties().map(normalizeLocalOwnerProperty);
  return [...dataset, ...ownerProps];
};

let activeFilter = "all";
let currentPage = 1;
let searchDebounceTimer = null;
let wishlistCache = new Set();
let state = { authMode: "tenant", supabase: null, config: null, dbProperties: [], supabaseUserId: null };

async function loadSupabaseConfig() {
  try {
    const response = await fetch("/api/config");
    const config = await response.json();
    if (!config.configured || !config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
      return;
    }
    state.config = config;
    state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    const { data } = await state.supabase.auth.getSession();
    if (data.session) {
      const metaRole = data.session.user?.user_metadata?.role;
      state.supabaseUserId = data.session.user.id;
      setUserSession({
        name: data.session.user?.user_metadata?.full_name || data.session.user?.email || "Owner",
        email: data.session.user?.email,
        phone: data.session.user?.phone,
        role: metaRole || (data.session.user?.phone ? "tenant" : "owner"),
        accessToken: data.session.access_token
      });
      renderHeaderUser();
    }
  } catch (error) {
    state.config = null;
  }
}

async function refreshDbProperties() {
  if (!state.supabase) {
    state.dbProperties = [];
    return;
  }
  try {
    const response = await fetch("/api/properties");
    const result = await response.json();
    state.dbProperties = response.ok && result.ok ? result.properties : [];
  } catch (error) {
    state.dbProperties = [];
  }
}

// ---------------------------------------------------------------------------
// Wishlist
// ---------------------------------------------------------------------------

function getLocalWishlist() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.wishlist) || "[]"));
  } catch {
    return new Set();
  }
}
const setLocalWishlist = (set) => localStorage.setItem(STORAGE_KEYS.wishlist, JSON.stringify([...set]));

async function loadWishlist() {
  if (state.supabase && state.supabaseUserId) {
    try {
      const { data, error } = await state.supabase.from("wishlists").select("stay_id").eq("user_id", state.supabaseUserId);
      if (!error) {
        wishlistCache = new Set((data || []).map((row) => row.stay_id));
        return;
      }
    } catch {
      // fall through to local
    }
  }
  wishlistCache = getLocalWishlist();
}

async function toggleWishlist(stayId, heartButton) {
  const id = String(stayId);
  const wasSaved = wishlistCache.has(id);
  heartButton.textContent = wasSaved ? "♡" : "♥";
  heartButton.classList.toggle("active", !wasSaved);
  wasSaved ? wishlistCache.delete(id) : wishlistCache.add(id);

  if (state.supabase && state.supabaseUserId) {
    try {
      if (wasSaved) {
        await state.supabase.from("wishlists").delete().eq("user_id", state.supabaseUserId).eq("stay_id", id);
      } else {
        await state.supabase.from("wishlists").insert({ user_id: state.supabaseUserId, stay_id: id });
      }
    } catch (error) {
      wasSaved ? wishlistCache.add(id) : wishlistCache.delete(id);
      heartButton.textContent = wasSaved ? "♥" : "♡";
      heartButton.classList.toggle("active", wasSaved);
    }
    return;
  }
  setLocalWishlist(wishlistCache);
}

// ---------------------------------------------------------------------------
// Header / auth
// ---------------------------------------------------------------------------

function renderHeaderUser() {
  const session = getUserSession();
  const headerActions = document.querySelector(".header-actions");
  if (!headerActions) return;
  const existing = headerActions.querySelector(".user-pod");
  if (existing) existing.remove();
  if (!session) {
    headerActions.insertAdjacentHTML("beforeend", '<button class="btn btn-dark user-pod" data-action="login">Sign in</button>');
    return;
  }
  const safeName = session.name || "Resident";
  headerActions.insertAdjacentHTML("beforeend", `<div class="user-pod" data-user-role="${session.role || "tenant"}"><span>Hi, ${escapeHtml(safeName)}</span><button class="mini-logout" data-action="logout">Logout</button></div>`);
}

// ---------------------------------------------------------------------------
// Geolocation "PGs near me" (replaces the old fake area-pin map)
// ---------------------------------------------------------------------------

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function nearMeIdleMarkup(message) {
  return `
    <div class="nearme-card">
      <div class="nearme-icon">📍</div>
      <h3>Find PGs near you</h3>
      <p>${message || "Allow location access to see the nearest PGs to you, sorted by distance."}</p>
      <button class="btn btn-dark" id="locate-btn" type="button">Use my current location</button>
    </div>`;
}

function renderMapPanel() {
  const mapPanel = document.querySelector("#map-panel");
  if (!mapPanel) return;
  mapPanel.innerHTML = nearMeIdleMarkup();
  document.querySelector("#locate-btn")?.addEventListener("click", locateNearMe);
}

function locateNearMe() {
  const mapPanel = document.querySelector("#map-panel");
  if (!mapPanel) return;

  if (!("geolocation" in navigator)) {
    mapPanel.innerHTML = nearMeIdleMarkup("Your browser doesn't support location access — please search by locality using the box above instead.");
    return;
  }

  mapPanel.innerHTML = `<div class="nearme-card"><div class="nearme-spinner" aria-hidden="true"></div><p>Getting your location…</p></div>`;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const nearest = getCombinedStays()
        .filter((stay) => typeof stay.latitude === "number" && typeof stay.longitude === "number")
        .map((stay) => ({ ...stay, distanceKm: haversineKm(latitude, longitude, stay.latitude, stay.longitude) }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 15);
      renderNearMeResults(nearest);
    },
    (error) => {
      const message = error.code === error.PERMISSION_DENIED
        ? "Location access denied — you can still search by locality using the box above."
        : "Couldn't get your location. Please try again, or search by locality instead.";
      mapPanel.innerHTML = nearMeIdleMarkup(message);
      document.querySelector("#locate-btn")?.addEventListener("click", locateNearMe);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function renderNearMeResults(stays) {
  const mapPanel = document.querySelector("#map-panel");
  if (!mapPanel) return;
  if (!stays.length) {
    mapPanel.innerHTML = nearMeIdleMarkup("No nearby PGs with known coordinates were found. Try searching by locality instead.");
    document.querySelector("#locate-btn")?.addEventListener("click", locateNearMe);
    return;
  }
  mapPanel.innerHTML = `
    <div class="nearme-header">
      <h3>📍 Nearest PGs to you</h3>
      <button class="text-link" id="locate-again" type="button">Refresh location</button>
    </div>
    <div class="nearme-list">${stays.map((stay) => `
      <article class="nearme-item" data-id="${escapeHtml(String(stay.id))}">
        <div class="nearme-thumb" ${stay.image ? `style="background-image:url('${stay.image}')"` : ""}></div>
        <div class="nearme-info">
          <strong>${escapeHtml(stay.name)}</strong>
          <span>${escapeHtml(stay.area || stay.location)}</span>
          <span class="nearme-price">${money(stay.rent)}${typeof stay.rent === "number" ? " / month" : ""}</span>
        </div>
        <div class="nearme-distance">${stay.distanceKm < 1 ? `${Math.round(stay.distanceKm * 1000)} m` : `${stay.distanceKm.toFixed(1)} km`} away</div>
      </article>`).join("")}
    </div>`;
  mapPanel.querySelectorAll(".nearme-item").forEach((item) => {
    item.addEventListener("click", () => showDetail(item.dataset.id));
  });
  document.querySelector("#locate-again")?.addEventListener("click", locateNearMe);
}

// ---------------------------------------------------------------------------
// Listing grid (filter, sort, paginate)
// ---------------------------------------------------------------------------

function resetAndRender() {
  currentPage = 1;
  render();
}

function render() {
  const stays = getCombinedStays();
  const grid = document.querySelector("#listing-grid");
  const empty = document.querySelector("#empty-state");
  const loadMoreBtn = document.querySelector("#load-more");
  if (!grid || !empty) return;
  const query = (document.querySelector("#filter-location")?.value || "").toLowerCase();
  const budget = Number(document.querySelector("#hero-search [name=budget]")?.value || 0);
  const sort = document.querySelector("#sort-stays")?.value;
  let items = stays.filter((stay) =>
    (activeFilter === "all" || stay.type === activeFilter) &&
    `${stay.name} ${stay.location}`.toLowerCase().includes(query) &&
    (!budget || typeof stay.rent === "number" && stay.rent <= budget)
  );
  if (sort === "price") items.sort((a, b) => (typeof a.rent === "number" ? a.rent : Infinity) - (typeof b.rent === "number" ? b.rent : Infinity));
  if (sort === "rating") items.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const visibleItems = items.slice(0, currentPage * PAGE_SIZE);

  grid.innerHTML = visibleItems.map((stay) => `<article class="listing-card" data-id="${escapeHtml(String(stay.id))}">
    <div class="listing-image">
      ${stay.image ? `<img src="${stay.image}" alt="${escapeHtml(stay.name)}" loading="lazy" decoding="async">` : ""}
      ${stay.verified ? '<span class="badge">✓ VERIFIED</span>' : '<span class="badge badge-ghost">NEW</span>'}
      <button class="heart ${wishlistCache.has(String(stay.id)) ? "active" : ""}" aria-label="Save stay" type="button">${wishlistCache.has(String(stay.id)) ? "♥" : "♡"}</button>
    </div>
    <div class="listing-info"><h3>${escapeHtml(stay.name)}</h3>
      <div class="location">⌖ ${escapeHtml(stay.location)}</div>
      <div class="card-meta"><span>${typeName(stay.type)}</span><span>•</span><span>${escapeHtml(stay.rooms)}</span></div>
      <div class="card-bottom"><div class="price">${money(stay.rent)} <small>${typeof stay.rent === "number" ? "/ month" : ""}</small></div><div class="rating">★ ${Number(stay.rating || 4.7).toFixed(1)} · ${Number(stay.reviews || 0).toLocaleString("en-IN")}</div></div>
    </div></article>`).join("");
  empty.classList.toggle("hidden", items.length > 0);
  grid.querySelectorAll(".listing-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (!event.target.closest(".heart")) showDetail(card.dataset.id);
    });
    card.querySelector(".heart")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleWishlist(card.dataset.id, event.currentTarget);
    });
  });

  if (loadMoreBtn) {
    loadMoreBtn.classList.toggle("hidden", visibleItems.length >= items.length);
  }
}

// ---------------------------------------------------------------------------
// Modal helpers
// ---------------------------------------------------------------------------

function openModal(html) {
  document.querySelector("#modal-content").innerHTML = `<button class="modal-close" data-action="close">×</button>${html}`;
  document.querySelector("#modal").classList.remove("hidden");
}

function closeModal() {
  document.querySelector("#modal").classList.add("hidden");
  if (/^#stay-/.test(location.hash)) {
    history.pushState(null, "", location.pathname + location.search);
  }
}

// ---------------------------------------------------------------------------
// Auth: owner (email/password via Supabase) + tenant (real phone SMS OTP)
// ---------------------------------------------------------------------------

async function ownerAuthRequest(email, password, name) {
  const signinResponse = await fetch("/api/owner-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "signin", email, password })
  });
  const signinResult = await signinResponse.json();
  if (signinResponse.ok && signinResult.ok) return signinResult;

  const signupResponse = await fetch("/api/owner-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "signup", email, password, name })
  });
  const signupResult = await signupResponse.json();
  if (!signupResponse.ok || !signupResult.ok) {
    throw new Error(signupResult.error || signinResult.error || "Owner sign-in/sign-up failed.");
  }
  return signupResult;
}

function openLoginModal(mode = "tenant") {
  state.authMode = mode;
  const isOwner = mode === "owner";
  const form = `
    <div class="auth-card">
      <div class="auth-header">
        <span class="eyebrow">WELCOME</span>
        <h2>${isOwner ? "Owner login" : "Tenant login"}</h2>
      </div>
      <div class="auth-toggle">
        <button class="auth-tab ${!isOwner ? "active" : ""}" data-auth-mode="tenant" type="button">Tenant</button>
        <button class="auth-tab ${isOwner ? "active" : ""}" data-auth-mode="owner" type="button">Owner</button>
      </div>
      ${isOwner ? `
      <form id="auth-form" class="auth-form">
        <label>Full name<input required name="name" placeholder="Owner name"></label>
        <label>Email<input required type="email" name="email" placeholder="owner@email.com"></label>
        <label>Password<input required type="password" name="password" placeholder="Create a secure password"></label>
        <button class="btn btn-dark auth-submit" type="submit">${state.supabase ? "Sign up / Sign in" : "Create owner account"}</button>
      </form>
      ` : `
      <form id="auth-form" class="auth-form">
        <label>Mobile number<input required type="tel" name="phone" placeholder="Enter 10-digit mobile number" maxlength="10"></label>
        <label>Name<input required name="name" placeholder="Full name"></label>
        <button class="btn btn-dark auth-submit" type="submit">${state.supabase ? "Send OTP" : "Continue"}</button>
      </form>
      <p class="otp-copy">${state.supabase ? "We'll text you a 6-digit verification code." : "Phone login needs the backend configured — ask the site admin."}</p>
      `}
    </div>
  `;
  openModal(form);
  document.querySelectorAll(".auth-tab").forEach((button) => {
    button.addEventListener("click", () => openLoginModal(button.dataset.authMode));
  });
  document.querySelector("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = event.target.querySelector(".auth-submit");
    const form = new FormData(event.target);

    if (isOwner) {
      const email = String(form.get("email") || "").trim();
      const password = String(form.get("password") || "");
      const name = String(form.get("name") || "").trim();
      if (!email || !password || !name) return;

      if (!state.supabase) {
        setUserSession({ name, email, role: "owner" });
        renderHeaderUser();
        closeModal();
        showOwnerDashboard();
        return;
      }

      submitBtn.disabled = true;
      try {
        const result = await ownerAuthRequest(email, password, name);
        const accessToken = result.session?.access_token || "";
        const refreshToken = result.session?.refresh_token || "";
        if (accessToken && refreshToken) {
          await state.supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
        state.supabaseUserId = result.user?.id || null;
        setUserSession({ name, email, role: "owner", accessToken });
        renderHeaderUser();
        await loadWishlist();
        closeModal();
        showOwnerDashboard();
      } catch (error) {
        alert(error.message || "Owner auth failed.");
      } finally {
        submitBtn.disabled = false;
      }
      return;
    }

    const phone = String(form.get("phone") || "").replace(/\D/g, "");
    const name = String(form.get("name") || "").trim();
    if (phone.length !== 10 || !name) return;

    if (!state.supabase) {
      alert("Phone login needs the backend to be configured (Supabase keys not set yet).");
      return;
    }

    submitBtn.disabled = true;
    const e164Phone = `+91${phone}`;
    try {
      const { error } = await state.supabase.auth.signInWithOtp({ phone: e164Phone });
      if (error) throw error;
      openOtpVerifyModal({ phone: e164Phone, name });
    } catch (error) {
      alert(error.message || "Could not send OTP. Make sure an SMS provider is configured in Supabase Auth settings.");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function openOtpVerifyModal({ phone, name }) {
  openModal(`
    <div class="auth-card">
      <div class="auth-header"><span class="eyebrow">VERIFY</span><h2>Enter verification code</h2></div>
      <p class="otp-copy">We sent a 6-digit code via SMS to <strong>${escapeHtml(phone)}</strong>.</p>
      <form id="otp-form" class="auth-form">
        <label>OTP<input required name="otp" inputmode="numeric" maxlength="6" placeholder="123456"></label>
        <button class="btn btn-dark auth-submit" type="submit">Verify</button>
      </form>
    </div>
  `);
  document.querySelector("#otp-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = String(new FormData(event.target).get("otp") || "").replace(/\D/g, "");
    try {
      const { data, error } = await state.supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
      if (error) throw error;
      const user = data.user;
      await state.supabase.from("profiles").upsert({
        id: user.id,
        full_name: name,
        role: "tenant",
        phone,
        updated_at: new Date().toISOString()
      });
      state.supabaseUserId = user.id;
      setUserSession({ name, phone, role: "tenant", verifiedAt: Date.now(), accessToken: data.session?.access_token || "" });
      renderHeaderUser();
      await loadWishlist();
      closeModal();
    } catch (error) {
      alert(error.message || "OTP verification failed. Please try again.");
    }
  });
}

// ---------------------------------------------------------------------------
// Stay detail modal: pricing, reviews (Supabase-backed with local fallback),
// and a real enquiry/callback-request form.
// ---------------------------------------------------------------------------

async function fetchReviews(stayId) {
  if (state.supabase) {
    try {
      const { data, error } = await state.supabase
        .from("reviews")
        .select("*")
        .eq("stay_id", String(stayId))
        .order("created_at", { ascending: false });
      if (!error) return (data || []).map((row) => ({ name: row.reviewer_name, rating: row.rating, text: row.review_text }));
    } catch {
      // fall through to local
    }
  }
  return JSON.parse(localStorage.getItem(`reviews-${stayId}`) || "[]");
}

async function submitReview(stayId, { name, rating, text }) {
  if (state.supabase) {
    try {
      const { error } = await state.supabase.from("reviews").insert({
        stay_id: String(stayId),
        reviewer_name: name,
        rating,
        review_text: text
      });
      if (!error) return;
    } catch {
      // fall through to local
    }
  }
  const current = JSON.parse(localStorage.getItem(`reviews-${stayId}`) || "[]");
  current.push({ name, rating, text });
  localStorage.setItem(`reviews-${stayId}`, JSON.stringify(current));
}

async function submitEnquiry(stay, { name, phone, message }) {
  if (!state.supabase) {
    alert(`Backend isn't configured yet — please call ${stay.contactNumber || stay.phone || "the property"} directly.`);
    return;
  }
  const response = await fetch("/api/enquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stay_id: String(stay.id), stay_name: stay.name, name, phone, message })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    alert(result.error || "Could not send your enquiry. Please try again.");
    return;
  }
  alert("Thanks! The owner/manager will reach out to you soon.");
}

async function showDetail(id) {
  const stays = getCombinedStays();
  const stay = stays.find((item) => String(item.id) === String(id));
  if (!stay) return;
  history.pushState(null, "", `#stay-${stay.id}`);

  const cover = stay.coverImage || stay.image;
  const gallery = Array.isArray(stay.gallery) ? stay.gallery.filter(Boolean) : [];
  const prices = stay.prices || {};
  const reviews = await fetchReviews(stay.id);
  const reviewMarkup = reviews.length ? reviews.map((review) => `<li><strong>${escapeHtml(review.name)}</strong> · ${"★".repeat(Number(review.rating || 5))}<br>${escapeHtml(review.text)}</li>`).join("") : `<li>${NOT_LISTED}</li>`;
  const imageMarkup = cover ? `<img src="${cover}" alt="${escapeHtml(stay.name)}" class="photo-thumb main-photo">` : `<div class="missing-image">${NOT_LISTED}</div>`;
  const propertyMeta = `${stay.area || stay.locality || "Bengaluru"} · ${stay.address || stay.location || "Bengaluru"}`;
  openModal(`<div class="detail-head">${imageMarkup}<div><span class="eyebrow">VERIFIED STAY</span><h2>${escapeHtml(stay.name)}</h2>
    <p class="location">⌖ ${escapeHtml(propertyMeta)}</p>
    <p class="rating">★ ${(stay.rating || 4.7).toFixed(1)} · ${(stay.reviews || 0).toLocaleString("en-IN")} reviews</p>
    <p class="location">Pincode: ${escapeHtml(stay.pincode || "Not listed")} · Landmark: ${escapeHtml(stay.nearestLandmark || NOT_LISTED)}</p>
    <p class="contact-top"><strong>Contact:</strong> ${escapeHtml(stay.contactNumber || stay.phone || NOT_LISTED)}</p>
  </div></div>
  ${gallery.length ? `<div class="photo-gallery">${gallery.map((image) => `<img src="${image}" alt="${escapeHtml(stay.name)}" class="photo-thumb" loading="lazy">`).join("")}</div>` : ""}
  <div class="amenities">${(stay.amenities || [NOT_LISTED]).map((item) => `<span>✓ ${escapeHtml(item)}</span>`).join("")}</div>
  <div class="booking-box"><h3>Pricing & house details</h3><div class="booking-grid">
    <label>Single sharing<input value="${money(prices.singleSharing || stay.priceSingleSharing || stay.rent)}" readonly></label>
    <label>Double sharing<input value="${money(prices.doubleSharing || stay.priceDoubleSharing)}" readonly></label>
    <label>Triple sharing<input value="${money(prices.tripleSharing || stay.priceTripleSharing)}" readonly></label>
    <label>4 sharing<input value="${money(prices.fourSharing || stay.priceFourSharing)}" readonly></label>
    <label>Meals<input value="${escapeHtml(stay.meals || "Not listed")}" readonly></label><label>Deposit<input value="${money(stay.deposit || "Not listed")}" readonly></label>
  </div><p class="location">Gym: <strong>${escapeHtml(stay.gym || NOT_LISTED)}</strong> · Parking: <strong>${escapeHtml(stay.parking || NOT_LISTED)}</strong></p>
  <a class="btn btn-dark" href="${stay.googleMapUrl || "#"}" target="_blank" rel="noopener noreferrer">Open in Google Maps →</a></div>
  <div class="booking-box"><h3>Contact this property</h3>
    <p class="location">Prefer a callback? Leave your number and the owner will reach out.</p>
    <form id="enquiry-form" class="booking-grid">
      <label>Your name<input required name="name" maxlength="60"></label>
      <label>Your phone<input required type="tel" name="phone" maxlength="15"></label>
      <label class="wide-field">Message (optional)<textarea name="message" maxlength="300" rows="2"></textarea></label>
      <button class="btn btn-dark">Request a callback</button>
    </form>
  </div>
  <div class="booking-box"><h3>Leave a review</h3><form id="review-form" class="booking-grid">
    <label>Your name<input required name="name" maxlength="60"></label><label>Rating<select required name="rating"><option value="">Select</option><option value="5">★★★★★</option><option value="4">★★★★</option><option value="3">★★★</option><option value="2">★★</option><option value="1">★</option></select></label>
    <label class="wide-field">Your review<textarea required name="text" maxlength="500" rows="3"></textarea></label><button class="btn btn-dark">Submit review</button>
  </form></div>
  <div class="booking-box"><h3>User reviews</h3><ul class="review-list">${reviewMarkup}</ul></div>`);

  document.querySelector("#enquiry-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const submitBtn = event.target.querySelector("button");
    submitBtn.disabled = true;
    await submitEnquiry(stay, { name: form.get("name"), phone: form.get("phone"), message: form.get("message") });
    submitBtn.disabled = false;
    event.target.reset();
  });

  document.querySelector("#review-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    await submitReview(stay.id, { name: form.get("name"), rating: Number(form.get("rating")), text: form.get("text") });
    showDetail(stay.id);
  });
}

// ---------------------------------------------------------------------------
// Owner dashboard: real property CRUD + enquiries tab
// ---------------------------------------------------------------------------

async function fetchOwnerProperties(session) {
  if (state.supabase && session?.accessToken) {
    try {
      const response = await fetch("/api/properties?mine=true", {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      const result = await response.json();
      if (response.ok && result.ok) {
        return result.properties.map((p) => ({
          id: p.id,
          name: p.name,
          area: p.area,
          type: p.type,
          status: p.status,
          image: p.image_url,
          roomsAvailable: p.rooms_available
        }));
      }
    } catch {
      // fall through to local
    }
  }
  return getOwnerProperties();
}

function renderEnquiriesTab(enquiries) {
  const panel = document.querySelector('[data-panel="enquiries"]');
  if (!panel) return;
  if (!enquiries.length) {
    panel.innerHTML = '<p class="location">No enquiries yet — they\'ll show up here as tenants reach out.</p>';
    return;
  }
  panel.innerHTML = `<div class="property-list">${enquiries.map((enquiry) => `
    <div class="property-row enquiry-row">
      <div><strong>${escapeHtml(enquiry.stay_name)}</strong><br>
      <span>${escapeHtml(enquiry.name)} · ${escapeHtml(enquiry.phone)}</span><br>
      <span class="status-pill">${new Date(enquiry.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div>
      <div class="enquiry-message">${escapeHtml(enquiry.message)}</div>
    </div>`).join("")}</div>`;
}

async function showOwnerDashboard() {
  const session = getUserSession();
  const properties = await fetchOwnerProperties(session);
  const stats = [
    { label: "Active properties", value: properties.length },
    { label: "Open beds", value: properties.reduce((total, property) => total + (Number(property.roomsAvailable) || 0), 0) },
    { label: "New enquiries", value: state.supabase && session?.accessToken ? "…" : "0", statKey: "enquiries" }
  ];
  openModal(`
    <div class="owner-panel">
      <span class="eyebrow">OWNER DASHBOARD</span>
      <h2>Manage your properties</h2>
      <div class="stats">${stats.map((stat) => `<div class="stat"><strong ${stat.statKey ? `data-stat="${stat.statKey}"` : ""}>${stat.value}</strong><small>${stat.label}</small></div>`).join("")}</div>
      <div class="dashboard-tabs">
        <button class="dash-tab active" data-tab="overview" type="button">Overview</button>
        <button class="dash-tab" data-tab="properties" type="button">Properties</button>
        <button class="dash-tab" data-tab="enquiries" type="button">Enquiries</button>
      </div>
      <div class="dash-panel" data-panel="overview">
        <h3>Add a new property</h3>
        <form class="owner-form" id="owner-form">
          <label>Property name<input required name="name" placeholder="e.g. Sunrise PG"></label>
          <label>Locality and city<input required name="area" placeholder="e.g. Baner, Pune"></label>
          <label>Property type<select name="type"><option value="pg">PG</option><option value="hostel">Hostel</option><option value="co-living">Co-living</option></select></label>
          <label>Starting monthly rent<input required type="number" name="rent" placeholder="9000"></label>
          <label>Owner phone number<input required name="phone" placeholder="10-digit number"></label>
          <label class="wide-field">Property photo URL<input name="image" placeholder="Paste image URL"></label>
          <button class="btn btn-dark" type="submit">Submit for verification →</button>
        </form>
      </div>
      <div class="dash-panel" data-panel="properties">
        <h3>Your properties</h3>
        <div class="property-list">${properties.map((property) => `
          <div class="property-row">
            <div class="property-thumb" style="background-image:url('${property.image || FALLBACK_IMAGE}')"></div>
            <div><strong>${escapeHtml(property.name)}</strong><br><span>${escapeHtml(property.area)} · ${escapeHtml(property.type || "pg")}</span><br><span class="status-pill">${escapeHtml(property.status || "Live")}</span></div>
            <button class="btn btn-ghost inline-btn" data-owner-remove="${escapeHtml(String(property.id))}" type="button">Remove</button>
          </div>
        `).join("") || '<p class="location">No properties listed yet.</p>'}</div>
      </div>
      <div class="dash-panel hidden" data-panel="enquiries">
        <h3>Recent enquiries</h3>
        <p class="location">Loading enquiries…</p>
      </div>
    </div>
  `);

  document.querySelectorAll(".dash-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".dash-tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".dash-panel").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== tab.dataset.tab));
    });
  });

  if (state.supabase && session?.accessToken) {
    fetch("/api/enquiries", { headers: { Authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((result) => {
        if (!result.ok) return;
        const statEl = document.querySelector('[data-stat="enquiries"]');
        if (statEl) statEl.textContent = result.enquiries.length;
        renderEnquiriesTab(result.enquiries);
      })
      .catch(() => {
        const panel = document.querySelector('[data-panel="enquiries"]');
        if (panel) panel.innerHTML = '<p class="location">Could not load enquiries right now.</p>';
      });
  } else {
    renderEnquiriesTab([]);
  }

  document.querySelector("#owner-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const payload = {
      name: String(form.get("name") || "").trim(),
      area: String(form.get("area") || "").trim(),
      city: "Bengaluru",
      type: String(form.get("type") || "pg"),
      rent: Number(form.get("rent") || 0),
      phone: String(form.get("phone") || "").trim(),
      image: String(form.get("image") || "") || FALLBACK_IMAGE,
      rooms_available: 5,
      roomsAvailable: 5,
      status: "Pending review"
    };

    const currentSession = getUserSession();
    const useBackend = state.supabase && !!currentSession?.accessToken;

    if (useBackend) {
      try {
        const response = await fetch("/api/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentSession.accessToken}` },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || "Property save failed.");
        await refreshDbProperties();
        resetAndRender();
        showOwnerDashboard();
      } catch (error) {
        alert(error.message || "Could not save property.");
      }
      return;
    }

    const next = { id: `owner-${Date.now()}`, ...payload };
    setOwnerProperties([next, ...getOwnerProperties()]);
    resetAndRender();
    showOwnerDashboard();
  });

  document.querySelectorAll("[data-owner-remove]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.ownerRemove;
      const currentSession = getUserSession();
      if (state.supabase && currentSession?.accessToken) {
        try {
          await fetch(`/api/properties?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${currentSession.accessToken}` }
          });
          await refreshDbProperties();
        } catch {
          alert("Could not remove property.");
          return;
        }
      } else {
        setOwnerProperties(getOwnerProperties().filter((property) => property.id !== id));
      }
      resetAndRender();
      showOwnerDashboard();
    });
  });
}

// ---------------------------------------------------------------------------
// Hash deep-links for shareable stay detail pages
// ---------------------------------------------------------------------------

function maybeOpenHashStay() {
  const match = location.hash.match(/^#stay-(.+)$/);
  if (!match) return;
  const id = match[1];
  const stay = getCombinedStays().find((item) => String(item.id) === id);
  if (stay) showDetail(stay.id);
}

// ---------------------------------------------------------------------------
// Global event wiring
// ---------------------------------------------------------------------------

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  const view = event.target.closest("[data-view]");
  if (action && action.dataset.action === "close") {
    closeModal();
    return;
  }
  if (action && action.dataset.action === "close-menu") {
    document.querySelector("#mobile-nav")?.classList.remove("open");
    return;
  }
  if (action && action.dataset.action === "login") {
    openLoginModal("tenant");
    return;
  }
  if (action && action.dataset.action === "logout") {
    clearUserSession();
    state.supabaseUserId = null;
    if (state.supabase) state.supabase.auth.signOut().catch(() => {});
    renderHeaderUser();
    loadWishlist().then(resetAndRender);
    return;
  }
  if (view && view.dataset.view === "owner") {
    const user = getUserSession();
    if (!user) {
      openLoginModal("owner");
      return;
    }
    showOwnerDashboard();
  }
  if (event.target.id === "modal") {
    closeModal();
  }
});

document.querySelector(".menu-btn")?.addEventListener("click", () => {
  document.querySelector("#mobile-nav")?.classList.toggle("open");
});

document.querySelector("#hero-search")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const field = document.querySelector("#filter-location");
  if (field) field.value = String(form.get("location") || "");
  activeFilter = form.get("type") || "all";
  document.querySelectorAll(".filter-chip").forEach((button) => { button.classList.toggle("active", button.dataset.filter === activeFilter); });
  resetAndRender();
  document.querySelector("#explore")?.scrollIntoView({ behavior: "smooth" });
});

document.querySelector("#filter-location")?.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(resetAndRender, 200);
});
document.querySelector("#sort-stays")?.addEventListener("change", resetAndRender);
document.querySelectorAll(".filter-chip").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter-chip").forEach((item) => item.classList.toggle("active", item === button));
    resetAndRender();
  });
});
document.querySelector("#load-more")?.addEventListener("click", () => {
  currentPage += 1;
  render();
});
window.addEventListener("popstate", maybeOpenHashStay);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function init() {
  renderHeaderUser();
  renderMapPanel();
  resetAndRender();
  if (window.supabase) {
    await loadSupabaseConfig();
  }
  await refreshDbProperties();
  await loadWishlist();
  resetAndRender();
  maybeOpenHashStay();
}

init();
