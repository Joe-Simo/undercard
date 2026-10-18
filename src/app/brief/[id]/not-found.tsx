import type { Metadata } from "next";
import { StatePage } from "@/components/undercard/state-page";

export const metadata: Metadata = { title: "Brief not found | Undercard" };

export default function BriefNotFound() {
  return <StatePage eyebrow="Brief not found" title="We could not find this brief." body="The link may be mistyped or incomplete. Featured briefs are always available from the home page." />;
}
