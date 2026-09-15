"use client";

import { useState } from "react";
import Link from "next/link";
import type { Stay } from "@/types/stay";
import { haversineKm } from "@/lib/geo";
import { money } from "@/lib/format";

type PanelState =
  | { kind: "idle"; message?: string }
  | { kind: "loading" }
  | { kind: "results"; stays: (Stay & { distanceKm: number })[] };

export function NearMePanel({ stays }: { stays: Stay[] }) {
  const [state, setState] = useState<PanelState>({ kind: "idle" });

  function locate() {
    if (!("geolocation" in navigator)) {
      setState({ kind: "idle", message: "Your browser doesn't support location access — please search by locality using the box above instead." });
      return;
    }
    setState({ kind: "loading" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const nearest = stays
          .filter((stay) => typeof stay.latitude === "number" && typeof stay.longitude === "number")
          .map((stay) => ({
            ...stay,
            distanceKm: haversineKm(latitude, longitude, stay.latitude as number, stay.longitude as number),
          }))
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 15);
        setState({ kind: "results", stays: nearest });
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location access denied — you can still search by locality using the box above."
            : "Couldn't get your location. Please try again, or search by locality instead.";
        setState({ kind: "idle", message });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
    <div className="map-panel" aria-label="Find PGs near your current location">
      {state.kind !== "results" ? (
        <div className="nearme-card">
          {state.kind === "loading" ? (
            <>
              <div className="nearme-spinner" aria-hidden="true" />
              <p>Getting your location…</p>
            </>
          ) : (
            <>
              <div className="nearme-icon">📍</div>
              <h3>Find PGs near you</h3>
              <p>{state.message || "Allow location access to see the nearest PGs to you, sorted by distance."}</p>
              <button className="btn btn-dark" type="button" onClick={locate}>
                Use my current location
              </button>
            </>
          )}
        </div>
      ) : state.stays.length === 0 ? (
        <div className="nearme-card">
          <div className="nearme-icon">📍</div>
          <h3>Find PGs near you</h3>
          <p>No nearby PGs with known coordinates were found. Try searching by locality instead.</p>
          <button className="btn btn-dark" type="button" onClick={locate}>
            Use my current location
          </button>
        </div>
      ) : (
        <>
          <div className="nearme-header">
            <h3>📍 Nearest PGs to you</h3>
            <button className="text-link" type="button" onClick={locate}>
              Refresh location
            </button>
          </div>
          <div className="nearme-list">
            {state.stays.map((stay) => (
              <Link
                className="nearme-item"
                href={`/pg/${stay.id}`}
                key={stay.id}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                <div
                  className="nearme-thumb"
                  style={stay.image ? { backgroundImage: `url('${stay.image}')` } : undefined}
                />
                <div className="nearme-info">
                  <strong>{stay.name}</strong>
                  <span>{stay.area || stay.location}</span>
                  <span className="nearme-price">
                    {money(stay.rent)}
                    {typeof stay.rent === "number" ? " / month" : ""}
                  </span>
                </div>
                <div className="nearme-distance">
                  {stay.distanceKm < 1 ? `${Math.round(stay.distanceKm * 1000)} m` : `${stay.distanceKm.toFixed(1)} km`} away
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
