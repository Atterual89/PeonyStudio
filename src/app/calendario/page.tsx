import { SimpleContentPage } from "@/components/site/SimpleContentPage";
import { calendarContent } from "@/content/calendar";

export default function CalendarioPage() {
  return (
    <SimpleContentPage
      eyebrow={calendarContent.hero.eyebrow}
      title={calendarContent.title}
      intro={calendarContent.hero.intro}
    />
  );
}
