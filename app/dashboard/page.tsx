"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/components/AuthModalProvider";
import { FALLBACK_IMAGE } from "@/lib/data";
import type { Enquiry, OwnerProperty, StayType } from "@/types/stay";

type Tab = "overview" | "properties" | "enquiries";

export default function DashboardPage() {
  const { session, configured } = useAuth();
  const { openLogin } = useAuthModal();

  if (!configured) {
    return (
      <section className="section">
        <p className="location">Backend isn&apos;t configured yet — ask the site admin to set up Supabase.</p>
      </section>
    );
  }

  if (!session || session.role !== "owner") {
    return (
      <section className="section">
        <div className="owner-panel">
          <span className="eyebrow">OWNER DASHBOARD</span>
          <h2>Sign in to manage your properties</h2>
          <button className="btn btn-dark" type="button" onClick={() => openLogin("owner")}>
            Owner login →
          </button>
        </div>
      </section>
    );
  }

  return <DashboardContent accessToken={session.accessToken || ""} />;
}

function DashboardContent({ accessToken }: { accessToken: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [properties, setProperties] = useState<OwnerProperty[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadProperties = useCallback(async () => {
    try {
      const response = await fetch("/api/properties?mine=true", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json();
      if (response.ok && result.ok) setProperties(result.properties);
    } catch {
      setProperties([]);
    }
  }, [accessToken]);

  const loadEnquiries = useCallback(async () => {
    try {
      const response = await fetch("/api/enquiries", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json();
      if (response.ok && result.ok) setEnquiries(result.enquiries);
    } catch {
      setEnquiries([]);
    }
  }, [accessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    loadProperties();
    loadEnquiries();
  }, [loadProperties, loadEnquiries]);

  async function handleAddProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || "").trim(),
      area: String(form.get("area") || "").trim(),
      city: String(form.get("city") || "").trim() || "Bengaluru",
      type: String(form.get("type") || "pg") as StayType,
      rent: Number(form.get("rent") || 0),
      phone: String(form.get("phone") || "").trim(),
      image: String(form.get("image") || "") || FALLBACK_IMAGE,
      rooms_available: 5,
      status: "pending_review",
    };
    setSubmitting(true);
    try {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Property save failed.");
      event.currentTarget.reset();
      await loadProperties();
      setTab("properties");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save property.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await fetch(`/api/properties?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await loadProperties();
    } catch {
      alert("Could not remove property.");
    }
  }

  const stats = [
    { label: "Active properties", value: properties.length },
    { label: "Open beds", value: properties.reduce((total, p) => total + (Number(p.rooms_available) || 0), 0) },
    { label: "New enquiries", value: enquiries === null ? "…" : enquiries.length },
  ];

  return (
    <section className="section">
      <div className="owner-panel">
        <span className="eyebrow">OWNER DASHBOARD</span>
        <h2>Manage your properties</h2>
        <div className="stats">
          {stats.map((stat) => (
            <div className="stat" key={stat.label}>
              <strong>{stat.value}</strong>
              <small>{stat.label}</small>
            </div>
          ))}
        </div>

        <div className="dashboard-tabs">
          <button className={`dash-tab ${tab === "overview" ? "active" : ""}`} type="button" onClick={() => setTab("overview")}>
            Overview
          </button>
          <button className={`dash-tab ${tab === "properties" ? "active" : ""}`} type="button" onClick={() => setTab("properties")}>
            Properties
          </button>
          <button className={`dash-tab ${tab === "enquiries" ? "active" : ""}`} type="button" onClick={() => setTab("enquiries")}>
            Enquiries
          </button>
        </div>

        <div className={`dash-panel ${tab !== "overview" ? "hidden" : ""}`}>
          <h3>Add a new property</h3>
          <form className="owner-form" onSubmit={handleAddProperty}>
            <label>
              Property name
              <input required name="name" placeholder="e.g. Sunrise PG" />
            </label>
            <label>
              Locality
              <input required name="area" placeholder="e.g. Baner" />
            </label>
            <label>
              City
              <input required name="city" placeholder="e.g. Pune" />
            </label>
            <label>
              Property type
              <select name="type" defaultValue="pg">
                <option value="pg">PG</option>
                <option value="hostel">Hostel</option>
                <option value="co-living">Co-living</option>
              </select>
            </label>
            <label>
              Starting monthly rent
              <input required type="number" name="rent" placeholder="9000" />
            </label>
            <label>
              Owner phone number
              <input required name="phone" placeholder="10-digit number" />
            </label>
            <label className="wide-field">
              Property photo URL
              <input name="image" placeholder="Paste image URL" />
            </label>
            <button className="btn btn-dark" type="submit" disabled={submitting}>
              Submit for verification →
            </button>
          </form>
          {formError && <p className="otp-copy" style={{ color: "#c0392b" }}>{formError}</p>}
        </div>

        <div className={`dash-panel ${tab !== "properties" ? "hidden" : ""}`}>
          <h3>Your properties</h3>
          <div className="property-list">
            {properties.length ? (
              properties.map((property) => (
                <div className="property-row" key={property.id}>
                  <div className="property-thumb" style={{ backgroundImage: `url('${property.image_url || FALLBACK_IMAGE}')` }} />
                  <div>
                    <strong>{property.name}</strong>
                    <br />
                    <span>
                      {property.area} · {property.type || "pg"}
                    </span>
                    <br />
                    <span className="status-pill">{property.status || "Live"}</span>
                  </div>
                  <button className="btn btn-ghost inline-btn" type="button" onClick={() => handleRemove(property.id)}>
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="location">No properties listed yet.</p>
            )}
          </div>
        </div>

        <div className={`dash-panel ${tab !== "enquiries" ? "hidden" : ""}`}>
          <h3>Recent enquiries</h3>
          {enquiries === null ? (
            <p className="location">Loading enquiries…</p>
          ) : enquiries.length === 0 ? (
            <p className="location">No enquiries yet — they&apos;ll show up here as tenants reach out.</p>
          ) : (
            <div className="property-list">
              {enquiries.map((enquiry) => (
                <div className="property-row enquiry-row" key={enquiry.id}>
                  <div>
                    <strong>{enquiry.stay_name}</strong>
                    <br />
                    <span>
                      {enquiry.name} · {enquiry.phone}
                    </span>
                    <br />
                    <span className="status-pill">
                      {new Date(enquiry.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="enquiry-message">{enquiry.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
