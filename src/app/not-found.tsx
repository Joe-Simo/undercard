import type { Metadata } from "next";
import { StatePage } from "@/components/undercard/state-page";

export const metadata: Metadata = { title: "Page not found | Undercard" };

export default function NotFound() {
  return <StatePage eyebrow="404" title="Nothing on the bill here." body="This page does not exist. Start a new brief, or open one of the featured briefs from the home page." />;
}
