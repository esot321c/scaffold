import { NotificationSettings } from '@/components/admin/notification-settings';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/settings/notifications/')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Notification Settings</h1>
      <p className="text-muted-foreground">
        Configure how and when you receive admin alerts and notifications
      </p>

      <NotificationSettings />
    </div>
  );
}
