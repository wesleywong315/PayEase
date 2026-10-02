import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getSessionUser } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getSessionUser();

  return (
    <main className="min-h-[calc(100vh-2.5rem)] bg-landing text-[#f3efe6]">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-3xl flex-col justify-center gap-10 px-6 py-16 sm:px-10">
        <Logo invert showWordmark className="self-start" />

        <div className="space-y-4">
          <h1 className="type-h1 text-[#f3efe6]">PayEase</h1>
          <p className="max-w-xl text-lg text-[#f3efe6]/90 sm:text-xl">
            Fair shared spending for student teams.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {user ? (
            <Link
              href="/communities"
              className="focus-ring inline-flex items-center justify-center rounded-full bg-[#f3efe6] px-6 py-3 text-sm font-semibold text-landing transition hover:bg-white"
            >
              Open my communities
            </Link>
          ) : (
            <Link
              href="/login"
              className="focus-ring inline-flex items-center justify-center rounded-full bg-[#f3efe6] px-6 py-3 text-sm font-semibold text-landing transition hover:bg-white"
            >
              Log in
            </Link>
          )}
        </div>

        <p className="type-caption text-[#f3efe6]/80">
          <span aria-hidden="true" className="mr-1">
            ⚠
          </span>
          Hackathon prototype — no real payments.
        </p>
      </div>
    </main>
  );
}
