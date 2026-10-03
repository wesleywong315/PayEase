import { PageHeader } from "@/components/PageHeader";
import { ProfileFinanceArcs } from "@/components/ProfileFinanceArcs";
import { requireSessionUser } from "@/server/auth/current-user";
import { getProfileFinanceArcs } from "@/server/services/profile-finance";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Report",
};

export default async function ProfileReportPage() {
  const user = await requireSessionUser("/profile/report");
  const metrics = await getProfileFinanceArcs(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        showBack={false}
        eyebrow="Profile"
        title="Report"
        description="Your personal payment tracking across communities."
      />

      <ProfileFinanceArcs metrics={metrics} />

      <p className="type-caption">
        Amounts are not automatically netted across communities. Payments due
        tracks contributions recorded against you; reimbursements track money
        returned when you fronted a team expense. PayEase does not process
        payments — it only tracks charges and confirmations. Each charge is
        recorded in full.
      </p>
    </div>
  );
}
