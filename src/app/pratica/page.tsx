import { SimpleContentPage } from "@/components/site/SimpleContentPage";
import { practiceContent } from "@/content/practice";

export default function PraticaPage() {
  return (
    <SimpleContentPage
      eyebrow={practiceContent.hero.eyebrow}
      title={practiceContent.title}
      intro={practiceContent.hero.intro}
    />
  );
}
