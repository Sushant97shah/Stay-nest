import type { MetadataRoute } from "next";
import { getStaticStays } from "@/lib/data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://staynest-henna.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const stayEntries: MetadataRoute.Sitemap = getStaticStays().map((stay) => ({
    url: `${siteUrl}/pg/${stay.id}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    {
      url: siteUrl,
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...stayEntries,
  ];
}
