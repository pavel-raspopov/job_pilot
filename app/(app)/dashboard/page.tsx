import { createInsforgeServer } from '@/lib/insforge-server';

export default async function DashboardPage() {
  const insforge = await createInsforgeServer();
  const { data } = await insforge.auth.getCurrentUser();
  const user = data?.user;

  return (
    <div className="mx-auto max-w-[1440px] px-8 py-8">
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-card">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">
          Dashboard
        </h1>
        <p className="text-sm text-text-secondary">
          Welcome{user?.email ? `, ${user.email}` : ''}.
        </p>
      </div>
    </div>
  );
}
