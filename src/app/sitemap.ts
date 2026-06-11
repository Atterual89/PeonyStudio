import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

const publicRoutes = [
  "",
  "/come-iniziare",
  "/percorsi",
  "/percorsi/foundation",
  "/percorsi/foundation-2",
  "/percorsi/classe-1",
  "/percorsi/classe-1-plus",
  "/pratica",
  "/workshop",
  "/workshop-exploration",
  "/calendario",
  "/peony",
  "/shop",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/calendario" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/calendario" ? 0.9 : 0.7,
  }));
}
