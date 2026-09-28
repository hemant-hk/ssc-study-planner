import { requireAdmin } from "@/lib/auth-store";
import AdminClient, { type AdminUser } from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdmin();
  const adminUser: AdminUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    targetExam: user.targetExam,
    dailyGoal: user.dailyGoal,
    createdAt: user.createdAt,
  };
  return <AdminClient user={adminUser} />;
}