import { requireUser } from "@/lib/auth-store";
import DashboardClient, { type DashUser } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const dashUser: DashUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    targetExam: user.targetExam,
    dailyGoal: user.dailyGoal,
    createdAt: user.createdAt,
  };
  return <DashboardClient user={dashUser} />;
}