import { ProgramDetailPage } from "@/components/programs/ProgramDetailPage";
import { programsContent } from "@/content/programs";

export default function FoundationPage() {
  return <ProgramDetailPage step={programsContent.structuredPaths[0]} />;
}
