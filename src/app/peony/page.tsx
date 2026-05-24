import { SimpleContentPage } from "@/components/site/SimpleContentPage";
import { peonyAboutContent } from "@/content/peony-about";

export default function PeonyPage() {
  return (
    <SimpleContentPage
      eyebrow={peonyAboutContent.hero.eyebrow}
      title={peonyAboutContent.title}
      intro={peonyAboutContent.hero.intro}
    />
  );
}
