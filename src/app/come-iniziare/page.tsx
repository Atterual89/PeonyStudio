import { SimpleContentPage } from "@/components/site/SimpleContentPage";
import { howToStartContent } from "@/content/how-to-start";

export default function ComeIniziarePage() {
  return (
    <SimpleContentPage
      eyebrow={howToStartContent.hero.eyebrow}
      title={howToStartContent.title}
      intro={howToStartContent.hero.intro}
    />
  );
}
