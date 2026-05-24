import { SimpleContentPage } from "@/components/site/SimpleContentPage";
import { programsContent } from "@/content/programs";

export default function ProgrammiPage() {
  return (
    <SimpleContentPage
      eyebrow={programsContent.hero.eyebrow}
      title={programsContent.title}
      intro={programsContent.hero.intro}
    />
  );
}
