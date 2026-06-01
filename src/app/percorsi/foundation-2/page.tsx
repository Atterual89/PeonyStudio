import { ProgramDetailPage } from "@/components/programs/ProgramDetailPage";
import { programsContent } from "@/content/programs";

export default function FoundationDuePage() {
  return <ProgramDetailPage step={programsContent.structuredPaths[1]} />;
}
