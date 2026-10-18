import { notFound, redirect } from "next/navigation";
import { featuredId, getOrBuildFeatured } from "@/lib/featured";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function FeaturedPage(props: PageProps<"/featured/[slug]">) {
  const { slug } = await props.params;
  const b = await getOrBuildFeatured(slug);
  if (!b) notFound();
  redirect(`/brief/${featuredId(slug)}`);
}
