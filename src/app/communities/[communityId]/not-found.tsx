import { BackButton } from "@/components/BackButton";

export default function CommunityNotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <BackButton href="/profile/communities" label="Back to My communities" />
      <h1 className="type-h1">Community not found</h1>
      <p className="text-muted">
        That community ID does not exist in the demo database.
      </p>
    </main>
  );
}
