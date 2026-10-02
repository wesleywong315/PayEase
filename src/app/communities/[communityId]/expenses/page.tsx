import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ communityId: string }>;
};

/** Expenses list moved into Finance hub. */
export default async function ExpensesRedirectPage({ params }: PageProps) {
  const { communityId } = await params;
  redirect(`/communities/${communityId}/finance`);
}
