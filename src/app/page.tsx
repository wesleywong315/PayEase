import { redirect } from "next/navigation";
import Link from "next/link";
import { LandingTagline } from "@/components/LandingTagline";
import { Logo } from "@/components/Logo";
import { getSessionUser } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/profile/communities");
  }

  return (
    <main className="min-h-[calc(100vh-2.5rem)] bg-landing text-[#f3efe6]">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-3xl flex-col justify-center gap-10 px-6 py-16 sm:px-10">
        <Logo
          invert
          showWordmark={false}
          className="landing-rise self-start"
          markClassName="h-12 w-12"
        />

        <div className="landing-rise landing-rise-delay-1 space-y-4">
          <h1 className="type-h1 text-[#f3efe6]">PayEase</h1>
          <LandingTagline />
        </div>

        <div className="landing-rise landing-rise-delay-3 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="focus-ring inline-flex items-center justify-center rounded-full bg-[#f3efe6] px-6 py-3 text-sm font-semibold text-landing transition hover:bg-white"
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
