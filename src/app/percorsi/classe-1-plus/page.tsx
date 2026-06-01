import { ProgramDetailPage } from "@/components/programs/ProgramDetailPage";
import { programsContent } from "@/content/programs";

export default function ClasseUnoPlusPage() {
  return <ProgramDetailPage step={programsContent.structuredPaths[3]} />;
}
