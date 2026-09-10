"use client";
import { PageHeader } from "@/components/ui/page-header";
import { ResearchEvidencePanel } from "@/components/research/evidence-panel";
export default function QuestionsPage() {
  return <div className="space-y-5"><PageHeader title="Customer questions" description="Find questions people ask, inspect the answer sources and turn useful gaps into content work." /><ResearchEvidencePanel features={["questions"]} title="Saved question research" /></div>;
}
