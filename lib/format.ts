const NOT_LISTED = "Not listed";

export const display = (value: unknown): string =>
  value === undefined || value === null || value === "" ? NOT_LISTED : String(value);

export const money = (value: unknown): string =>
  typeof value === "number" ? `₹${value.toLocaleString("en-IN")}` : display(value);

export const typeName = (type: string): string =>
  type === "co-living" ? "Co-living" : type === "pg" ? "PG" : "Hostel";
