"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Stay, StayType } from "@/types/stay";
import { Hero } from "@/components/Hero";
import { FilterBar } from "@/components/FilterBar";
import { NearMePanel } from "@/components/NearMePanel";
import { ListingCard } from "@/components/ListingCard";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/lib/auth-context";
import { normalizeDbProperty } from "@/lib/normalize";

const PAGE_SIZE = 24;

type FilterValue = StayType | "all";
type SortValue = "recommended" | "price" | "rating";

export function HomeClient({ staticStays }: { staticStays: Stay[] }) {
  const { supabase } = useAuth();
  const { wishlist, toggle } = useWishlist();

  const [ownerStays, setOwnerStays] = useState<Stay[]>([]);
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
  const [sort, setSort] = useState<SortValue>("recommended");
  const [page, setPage] = useState(1);

  const loadOwnerStays = useCallback(async () => {
    try {
      const response = await fetch("/api/properties");
      const result = await response.json();
      if (response.ok && result.ok) {
        setOwnerStays((result.properties || []).map(normalizeDbProperty));
      }
    } catch {
      setOwnerStays([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    loadOwnerStays();
  }, [loadOwnerStays, supabase]);

  const allStays = useMemo(() => [...staticStays, ...ownerStays], [staticStays, ownerStays]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let items = allStays.filter(
      (stay) =>
        (activeFilter === "all" || stay.type === activeFilter) &&
        `${stay.name} ${stay.location}`.toLowerCase().includes(q) &&
        (!budget || (typeof stay.rent === "number" && stay.rent <= budget))
    );
    if (sort === "price") {
      items = [...items].sort(
        (a, b) => (typeof a.rent === "number" ? a.rent : Infinity) - (typeof b.rent === "number" ? b.rent : Infinity)
      );
    }
    if (sort === "rating") {
      items = [...items].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    return items;
  }, [allStays, query, activeFilter, budget, sort]);

  const visible = filtered.slice(0, page * PAGE_SIZE);

  function resetAndRender() {
    setPage(1);
  }

  return (
    <>
      <Hero
        onSearch={({ location, type, budget: heroBudget }) => {
          setQuery(location);
          setActiveFilter((type as FilterValue) || "all");
          setBudget(heroBudget);
          resetAndRender();
        }}
      />

      <section className="section" id="explore">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CURATED FOR YOU</span>
            <h2>Popular PGs across India</h2>
          </div>
          <a className="text-link" href="#explore">
            View all listings →
          </a>
        </div>

        <FilterBar
          query={query}
          onQueryChange={(value) => {
            setQuery(value);
            resetAndRender();
          }}
          activeFilter={activeFilter}
          onFilterChange={(value) => {
            setActiveFilter(value);
            resetAndRender();
          }}
          sort={sort}
          onSortChange={(value) => {
            setSort(value);
            resetAndRender();
          }}
        />

        <NearMePanel stays={allStays} />

        {filtered.length === 0 ? (
          <div className="empty-state">
            <span>⌕</span>
            <h3>No stays found</h3>
            <p>Try another locality or remove a filter.</p>
          </div>
        ) : (
          <div className="listing-grid">
            {visible.map((stay) => (
              <ListingCard key={stay.id} stay={stay} wishlisted={wishlist.has(stay.id)} onToggleWishlist={toggle} />
            ))}
          </div>
        )}

        {visible.length < filtered.length && (
          <button className="btn btn-ghost load-more" type="button" onClick={() => setPage((p) => p + 1)}>
            Load more stays ↓
          </button>
        )}
      </section>
    </>
  );
}
