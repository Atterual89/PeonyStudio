import type { MetadataRoute } from "next";

const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export default function robots(): MetadataRoute.Robots {
  const isProduction =
    process.env.VERCEL_ENV === "production" ||
    (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production");

  if (!isProduction) {
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

function normalizeSiteUrl(value?: string) {
  return (value ?? "http://localhost:3000").replace(/\/$/, "");
}
