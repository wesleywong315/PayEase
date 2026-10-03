import { redirect } from "next/navigation";

/** Legacy inbox → profile Communities tab. */
export default function CommunitiesRedirectPage() {
  redirect("/profile/communities");
}
