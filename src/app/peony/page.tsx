import fs from "node:fs";
import path from "node:path";

import { PeonyPageClient } from "@/components/peony/PeonyPageClient";

type GalleryImage = {
  src: string;
  alt: string;
};

export default function PeonyPage() {
  const galleryImages = getPeonyGalleryImages();

  return <PeonyPageClient galleryImages={galleryImages} />;
}

function getPeonyGalleryImages(): GalleryImage[] {
  const galleryDirectory = path.join(
    process.cwd(),
    "public",
    "images",
    "peony-gallery",
  );
  const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

  if (!fs.existsSync(galleryDirectory)) {
    return [];
  }

  return fs
    .readdirSync(galleryDirectory)
    .filter((fileName) =>
      allowedExtensions.has(path.extname(fileName).toLowerCase()),
    )
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => ({
      src: `/images/peony-gallery/${fileName}`,
      alt: formatGalleryAlt(fileName),
    }));
}

function formatGalleryAlt(fileName: string) {
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
