"use client";

import type { StayType } from "@/types/stay";

type FilterValue = StayType | "all";
type SortValue = "recommended" | "price" | "rating";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All stays" },
  { value: "co-living", label: "Co-living" },
  { value: "hostel", label: "Hostels" },
  { value: "pg", label: "PGs" },
];

export function FilterBar({
  query,
  onQueryChange,
  activeFilter,
  onFilterChange,
  sort,
  onSortChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  activeFilter: FilterValue;
  onFilterChange: (value: FilterValue) => void;
  sort: SortValue;
  onSortChange: (value: SortValue) => void;
}) {
  return (
    <div className="filter-bar">
      <div className="filter-search">
        ⌕{" "}
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search locality, city or property"
        />
      </div>
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          className={`filter-chip ${activeFilter === filter.value ? "active" : ""}`}
          type="button"
          onClick={() => onFilterChange(filter.value)}
        >
          {filter.label}
        </button>
      ))}
      <select
        className="sort-select"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as SortValue)}
      >
        <option value="recommended">Recommended</option>
        <option value="price">Price: low to high</option>
        <option value="rating">Top rated</option>
      </select>
    </div>
  );
}
