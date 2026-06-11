const PRODUCTION_SITE_URL = "https://peonystudio.net";
const LOCAL_SITE_URL = "http://localhost:3000";
const PREVIEW_HOSTS = ["peony-studio-preview.netlify.app"];

export function isProductionDeployment() {
  if (process.env.NETLIFY === "true" || process.env.CONTEXT) {
    return process.env.CONTEXT === "production";
  }

  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === "production";
  }

  return process.env.NODE_ENV === "production";
}

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL;

  if (isProductionDeployment()) {
    if (configuredUrl && !isKnownPreviewUrl(configuredUrl)) {
      return normalizeSiteUrl(configuredUrl);
    }

    return PRODUCTION_SITE_URL;
  }

  return normalizeSiteUrl(configuredUrl ?? process.env.URL ?? LOCAL_SITE_URL);
}

function normalizeSiteUrl(value: string) {
  return value.replace(/\/$/, "");
}

function isKnownPreviewUrl(value: string) {
  try {
    const hostname = new URL(value).hostname;

    return PREVIEW_HOSTS.includes(hostname);
  } catch {
    return PREVIEW_HOSTS.some((host) => value.includes(host));
  }
}
