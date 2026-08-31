const NOT_LISTED = "Not listed";
const STORAGE_KEYS = {
  auth: "staynest-auth-session",
  ownerProperties: "staynest-owner-properties",
  ownerProfile: "staynest-owner-profile",
  otp: "staynest-otp-pending"
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
const getCombinedStays = () => {
  const dataset = baseDataset.map((pg, index) => ({
    ...pg,
    id: pg.id || index + 1,
    name: pg.name || NOT_LISTED,
    location: `${pg.area || pg.locality || "Bengaluru"}, Bengaluru`,
    type: pg.type || "pg",
    rent: typeof pg.priceSingleSharing === "number" ? pg.priceSingleSharing : (Number(pg.priceSingleSharing) || 0),
    rooms: "Single / Double / Triple / 4 Sharing",
    amenities: Array.isArray(pg.amenities) && pg.amenities.length ? pg.amenities : [NOT_LISTED],
    image: pg.coverImage || pg.image || "",
    verified: pg.verified === true,
    area: pg.area || pg.locality || "Bengaluru",
    rating: pg.rating || 4.6,
    reviews: pg.reviews || 0
  }));
  const ownerProps = getOwnerProperties().map((property, index) => ({
    id: property.id || `owner-${index + 1}`,
    name: property.name || "New property",
    area: property.area || property.locality || "Bengaluru",
    location: `${property.area || property.locality || "Bengaluru"}, ${property.city || "Bengaluru"}`,
    type: property.type || "pg",
    rent: Number(property.rent) || 0,
    rooms: property.roomsAvailable ? `${property.roomsAvailable} rooms available` : "Rooms available",
    amenities: property.amenities || ["Wi-Fi", "Food", "Laundry", "Power backup"],
    image: property.image || "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=85",
    verified: property.status === "Live",
    rating: 4.8,
    reviews: 18,
    status: property.status || "Live",
    ownerFlag: true
  }));
  return [...dataset, ...ownerProps];
};

let activeFilter = "all";
let state = { authMode: "tenant", supabase: null, config: null };

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
      setUserSession({
        name: data.session.user?.user_metadata?.full_name || data.session.user?.email || "Owner",
        email: data.session.user?.email,
        role: data.session.user?.role || "owner",
        accessToken: data.session.access_token
      });
      renderHeaderUser();
    }
  } catch (error) {
    state.config = null;
  }
}

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

function renderMap() {
  const mapPanel = document.querySelector("#map-panel");
  if (!mapPanel) return;
  const areas = Object.entries(
    getCombinedStays().reduce((acc, item) => {
      const region = item.area || "Bengaluru";
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {})
  ).slice(0, 5);
  const pinsMarkup = areas.map(([label, count], index) => {
    const left = [15, 42, 68, 62, 30][index % 5];
    const top = [25, 48, 28, 65, 58][index % 5];
    return `<button class="map-pin" data-area="${escapeHtml(label)}" style="left:${left}%;top:${top}%"><strong>${count}</strong><span>${escapeHtml(label)}</span></button>`;
  }).join("");
  mapPanel.innerHTML = `
    <div class="map-wrapper">
      <div class="map-grid"></div>
      ${pinsMarkup}
    </div>
    <div class="map-list">${areas.map(([label, count]) => `<button class="map-area" data-area="${escapeHtml(label)}"><span>${escapeHtml(label)}</span><strong>${count} listings</strong></button>`).join("")}</div>
  `;
  mapPanel.querySelectorAll(".map-area, .map-pin").forEach((button) => {
    button.addEventListener("click", () => {
      const area = button.dataset.area;
      const field = document.querySelector("#filter-location");
      if (field) field.value = area;
      activeFilter = "all";
      render();
      document.querySelector("#explore")?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

function render() {
  const stays = getCombinedStays();
  const grid = document.querySelector("#listing-grid");
  const empty = document.querySelector("#empty-state");
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
  grid.innerHTML = items.map((stay) => `<article class="listing-card" data-id="${stay.id}">
    <div class="listing-image" ${stay.image ? `style="background-image:url('${stay.image}')"` : ""}>
      ${stay.verified ? '<span class="badge">✓ VERIFIED</span>' : '<span class="badge badge-ghost">NEW</span>'}
      <button class="heart" aria-label="Save stay">♡</button>
    </div>
    <div class="listing-info"><h3>${escapeHtml(stay.name)}</h3>
      <div class="location">⌖ ${escapeHtml(stay.location)}</div>
      <div class="card-meta"><span>${typeName(stay.type)}</span><span>•</span><span>${escapeHtml(stay.rooms)}</span></div>
      <div class="card-bottom"><div class="price">${money(stay.rent)} <small>${typeof stay.rent === "number" ? "/ month" : ""}</small></div><div class="rating">★ ${Number(stay.rating || 4.7).toFixed(1)} · ${Number(stay.reviews || 0).toLocaleString("en-IN")}</div></div>
    </div></article>`).join("");
  empty.classList.toggle("hidden", items.length > 0);
  grid.querySelectorAll(".listing-card").forEach((card) => card.addEventListener("click", (event) => {
    if (!event.target.closest(".heart")) showDetail(Number(card.dataset.id));
  }));
  renderMap();
}

function openModal(html) {
  document.querySelector("#modal-content").innerHTML = `<button class="modal-close" data-action="close">×</button>${html}`;
  document.querySelector("#modal").classList.remove("hidden");
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
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
        <button class="auth-tab ${!isOwner ? "active" : ""}" data-auth-mode="tenant">Tenant</button>
        <button class="auth-tab ${isOwner ? "active" : ""}" data-auth-mode="owner">Owner</button>
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
        <button class="btn btn-dark auth-submit" type="submit">Send OTP</button>
      </form>
      `}
    </div>
  `;
  openModal(form);
  document.querySelectorAll(".auth-tab").forEach((button) => {
    button.addEventListener("click", () => openLoginModal(button.dataset.authMode));
  });
  document.querySelector("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);

    if (isOwner) {
      const email = String(form.get("email") || "").trim();
      const password = String(form.get("password") || "");
      const name = String(form.get("name") || "").trim();
      if (!email || !password || !name) return;
      if (!state.supabase) {
        const session = { name, email, role: "owner" };
        setUserSession(session);
        renderHeaderUser();
        document.querySelector("#modal").classList.add("hidden");
        showOwnerDashboard();
        return;
      }
      try {
        const response = await fetch("/api/owner-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "signup", email, password, name })
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Owner sign-up failed.");
        }
        const accessToken = result.session?.access_token || "";
        const session = { name, email, role: "owner", accessToken };
        setUserSession(session);
        renderHeaderUser();
        document.querySelector("#modal").classList.add("hidden");
        showOwnerDashboard();
      } catch (error) {
        alert(error.message || "Owner auth failed.");
      }
      return;
    }

    const phone = String(form.get("phone") || "").replace(/\D/g, "");
    const name = String(form.get("name") || "").trim();
    if (phone.length !== 10 || !name) return;
    const otp = generateOtp();
    localStorage.setItem(STORAGE_KEYS.otp, JSON.stringify({ phone, name, role: state.authMode, otp, createdAt: Date.now() }));
    openOtpModal({ phone, name, role: state.authMode, otp });
  });
}

function openOtpModal({ phone, name, role, otp }) {
  const hint = `Use OTP: <strong>${otp}</strong> (demo only)`;
  openModal(`
    <div class="auth-card">
      <div class="auth-header"><span class="eyebrow">VERIFY</span><h2>Enter verification code</h2></div>
      <p class="otp-copy">We sent a 6-digit code to <strong>${escapeHtml(phone)}</strong>. ${hint}</p>
      <form id="otp-form" class="auth-form">
        <label>OTP<input required name="otp" inputmode="numeric" maxlength="6" placeholder="123456"></label>
        <button class="btn btn-dark auth-submit" type="submit">Verify</button>
      </form>
    </div>
  `);
  document.querySelector("#otp-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = String(new FormData(event.target).get("otp") || "").replace(/\D/g, "");
    const pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.otp) || "null");
    if (!pending || code !== pending.otp) {
      alert("OTP does not match. Demo value is shown in the modal.");
      return;
    }
    const session = { name, phone, role, verifiedAt: Date.now() };
    setUserSession(session);
    localStorage.removeItem(STORAGE_KEYS.otp);
    renderHeaderUser();
    document.querySelector("#modal").classList.add("hidden");
    if (role === "owner") showOwnerDashboard();
  });
}

function showDetail(id) {
  const stays = getCombinedStays();
  const stay = stays.find((item) => item.id === id);
  if (!stay) return;
  const cover = stay.coverImage || stay.image;
  const gallery = Array.isArray(stay.gallery) ? stay.gallery.filter(Boolean) : [];
  const prices = stay.prices || {};
  const reviews = JSON.parse(localStorage.getItem(`reviews-${stay.id}`) || "[]");
  const reviewMarkup = reviews.length ? reviews.map((review) => `<li><strong>${escapeHtml(review.name)}</strong> · ${"★".repeat(Number(review.rating || 5))}<br>${escapeHtml(review.text)}</li>`).join("") : `<li>${NOT_LISTED}</li>`;
  const imageMarkup = cover ? `<img src="${cover}" alt="${escapeHtml(stay.name)}" class="photo-thumb main-photo">` : `<div class="missing-image">${NOT_LISTED}</div>`;
  const propertyMeta = `${stay.area || stay.locality || "Bengaluru"} · ${stay.address || stay.location || "Bengaluru"}`;
  openModal(`<div class="detail-head">${imageMarkup}<div><span class="eyebrow">VERIFIED STAY</span><h2>${escapeHtml(stay.name)}</h2>
    <p class="location">⌖ ${escapeHtml(propertyMeta)}</p>
    <p class="rating">★ ${(stay.rating || 4.7).toFixed(1)} · ${(stay.reviews || 0).toLocaleString("en-IN")} reviews</p>
    <p class="location">Pincode: ${escapeHtml(stay.pincode || "Not listed")} · Landmark: ${escapeHtml(stay.nearestLandmark || NOT_LISTED)}</p>
    <p class="contact-top"><strong>Contact:</strong> ${escapeHtml(stay.contactNumber || stay.phone || NOT_LISTED)}</p>
  </div></div>
  ${gallery.length ? `<div class="photo-gallery">${gallery.map((image) => `<img src="${image}" alt="${escapeHtml(stay.name)}" class="photo-thumb">`).join("")}</div>` : ""}
  <div class="amenities">${(stay.amenities || [NOT_LISTED]).map((item) => `<span>✓ ${escapeHtml(item)}</span>`).join("")}</div>
  <div class="booking-box"><h3>Pricing & house details</h3><div class="booking-grid">
    <label>Single sharing<input value="${money(prices.singleSharing || stay.priceSingleSharing || stay.rent)}" readonly></label>
    <label>Double sharing<input value="${money(prices.doubleSharing || stay.priceDoubleSharing)}" readonly></label>
    <label>Triple sharing<input value="${money(prices.tripleSharing || stay.priceTripleSharing)}" readonly></label>
    <label>4 sharing<input value="${money(prices.fourSharing || stay.priceFourSharing)}" readonly></label>
    <label>Meals<input value="${escapeHtml(stay.meals || "Not listed")}" readonly></label><label>Deposit<input value="${money(stay.deposit || "Not listed")}" readonly></label>
  </div><p class="location">Gym: <strong>${escapeHtml(stay.gym || NOT_LISTED)}</strong> · Parking: <strong>${escapeHtml(stay.parking || NOT_LISTED)}</strong></p>
  <a class="btn btn-dark" href="${stay.googleMapUrl || "#"}" target="_blank" rel="noopener noreferrer">Open in Google Maps →</a></div>
  <div class="booking-box"><h3>Leave a review</h3><form id="review-form" class="booking-grid">
    <label>Your name<input required name="name" maxlength="60"></label><label>Rating<select required name="rating"><option value="">Select</option><option value="5">★★★★★</option><option value="4">★★★★</option><option value="3">★★★</option><option value="2">★★</option><option value="1">★</option></select></label>
    <label class="wide-field">Your review<textarea required name="text" maxlength="500" rows="3"></textarea></label><button class="btn btn-dark">Submit review</button>
  </form></div>
  <div class="booking-box"><h3>User reviews</h3><ul class="review-list">${reviewMarkup}</ul></div>`);
  const reviewForm = document.querySelector("#review-form");
  if (reviewForm) {
    reviewForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      const current = JSON.parse(localStorage.getItem(`reviews-${stay.id}`) || "[]");
      current.push({ name: form.get("name"), rating: Number(form.get("rating")), text: form.get("text") });
      localStorage.setItem(`reviews-${stay.id}`, JSON.stringify(current));
      showDetail(stay.id);
    });
  }
}

function showOwnerDashboard() {
  const properties = getOwnerProperties();
  const stats = [
    { label: "Active properties", value: properties.length },
    { label: "Open beds", value: properties.reduce((total, property) => total + (Number(property.roomsAvailable) || 0), 0) },
    { label: "New enquiries", value: 12 }
  ];
  openModal(`
    <div class="owner-panel">
      <span class="eyebrow">OWNER DASHBOARD</span>
      <h2>Manage your properties</h2>
      <div class="stats">${stats.map((stat) => `<div class="stat"><strong>${stat.value}</strong><small>${stat.label}</small></div>`).join("")}</div>
      <div class="dashboard-tabs"><button class="active">Overview</button><button>Properties</button><button>Enquiries</button></div>
      <h3>Add a new property</h3>
      <form class="owner-form" id="owner-form">
        <label>Property name<input required name="name" placeholder="e.g. Sunrise PG"></label>
        <label>Locality and city<input required name="area" placeholder="e.g. Baner, Pune"></label>
        <label>Property type<select name="type"><option value="pg">PG</option><option value="hostel">Hostel</option><option value="co-living">Co-living</option></select></label>
        <label>Starting monthly rent<input required type="number" name="rent" placeholder="9000"></label>
        <label>Owner phone number<input required name="phone" placeholder="10-digit number"></label>
        <label class="wide-field">Property photo URL<input name="image" placeholder="Paste image URL"></label>
        <button class="btn btn-dark">Submit for verification →</button>
      </form>
      <div class="property-list">${properties.map((property) => `
        <div class="property-row">
          <div class="property-thumb" style="background-image:url('${property.image || 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=85'}')"></div>
          <div><strong>${escapeHtml(property.name)}</strong><br><span>${escapeHtml(property.area)} · ${escapeHtml(property.type || "pg")}</span><br><span class="status-pill">${escapeHtml(property.status || "Live")}</span></div>
          <button class="btn btn-ghost inline-btn" data-owner-remove="${property.id}">Remove</button>
        </div>
      `).join("")}</div>
    </div>
  `);
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
      image: String(form.get("image") || "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=85"),
      rooms_available: 5,
      roomsAvailable: 5,
      status: "Pending review"
    };

    const session = getUserSession();
    const useBackend = !!session?.accessToken;

    if (useBackend) {
      try {
        const response = await fetch("/api/properties", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.accessToken}`
          },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Property save failed.");
        }
      } catch (error) {
        alert(error.message || "Could not save property.");
      }
    }

    const next = {
      id: `owner-${Date.now()}`,
      ...payload,
      image: payload.image,
      roomsAvailable: payload.roomsAvailable || payload.rooms_available || 5,
      status: payload.status || "Pending review"
    };
    const updated = [next, ...getOwnerProperties()];
    setOwnerProperties(updated);
    render();
    showOwnerDashboard();
  });
  document.querySelectorAll("[data-owner-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.ownerRemove;
      const remaining = getOwnerProperties().filter((property) => property.id !== id);
      setOwnerProperties(remaining);
      render();
      showOwnerDashboard();
    });
  });
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  const view = event.target.closest("[data-view]");
  if (action && action.dataset.action === "close") {
    document.querySelector("#modal").classList.add("hidden");
    return;
  }
  if (action && action.dataset.action === "login") {
    openLoginModal("tenant");
    return;
  }
  if (action && action.dataset.action === "logout") {
    clearUserSession();
    renderHeaderUser();
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
    document.querySelector("#modal").classList.add("hidden");
  }
});

document.querySelector("#hero-search")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const field = document.querySelector("#filter-location");
  if (field) field.value = String(form.get("location") || "");
  activeFilter = form.get("type") || "all";
  document.querySelectorAll(".filter-chip").forEach((button) => { button.classList.toggle("active", button.dataset.filter === activeFilter); });
  render();
  document.querySelector("#explore")?.scrollIntoView({ behavior: "smooth" });
});

document.querySelector("#filter-location")?.addEventListener("input", render);
document.querySelector("#sort-stays")?.addEventListener("change", render);
document.querySelectorAll(".filter-chip").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter-chip").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

renderHeaderUser();
if (window.supabase) {
  loadSupabaseConfig();
}
render();
