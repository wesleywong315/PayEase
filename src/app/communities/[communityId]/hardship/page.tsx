import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

/** Legacy /hardship route → PayAid. */
export default async function HardshipRedirectPage({ params }: PageProps) {
  const { communityId } = await params;
  redirect(`/communities/${communityId}/payaid`);
}
