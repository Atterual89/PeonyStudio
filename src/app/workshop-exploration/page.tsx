import { SimpleContentPage } from "@/components/site/SimpleContentPage";
import { workshopsExplorationContent } from "@/content/workshops-exploration";

export default function WorkshopExplorationPage() {
  return (
    <SimpleContentPage
      eyebrow={workshopsExplorationContent.hero.eyebrow}
      title={workshopsExplorationContent.title}
      intro={workshopsExplorationContent.hero.intro}
    />
  );
}
