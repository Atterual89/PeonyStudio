import { ProgramDetailPage } from "@/components/programs/ProgramDetailPage";
import { programsContent } from "@/content/programs";

export default function ClasseUnoPage() {
  return <ProgramDetailPage step={programsContent.structuredPaths[2]} />;
}
