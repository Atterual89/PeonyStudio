import { SimpleContentPage } from "@/components/site/SimpleContentPage";
import { shopContent } from "@/content/shop";

export default function ShopPage() {
  return (
    <SimpleContentPage
      eyebrow={shopContent.hero.eyebrow}
      title={shopContent.title}
      intro={shopContent.hero.intro}
    />
  );
}
