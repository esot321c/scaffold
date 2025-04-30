import { createFileRoute } from '@tanstack/react-router';
import { SessionsManagement } from '@/components/profile/sessions-management';
import { ActivityLog } from '@/components/profile/activity-log';

export const Route = createFileRoute('/profile/security/')({
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <div className="container mx-auto px-4 mb-6">
      <h1 className="text-3xl font-bold mb-6">Security Settings</h1>

      <div className="grid gap-6">
        <SessionsManagement />
        <ActivityLog />
      </div>
    </div>
  );
}
