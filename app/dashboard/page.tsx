import { PageHeader } from "@/components/ui/page-header";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome to Sinag Ukit Business Management System."
      />
      <p className="text-[--color-text-muted] text-sm">
        Welcome to Sinag Ukit Business Management System.
      </p>
    </div>
  );
}
