import type { MetadataRoute } from "next";

import { getSiteUrl, isProductionDeployment } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  if (!isProductionDeployment()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      sitemap: `${siteUrl}/sitemap.xml`,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/area-personale/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
