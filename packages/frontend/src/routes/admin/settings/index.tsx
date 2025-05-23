import { LoggingSettings } from '@/components/admin/logging-settings';
import { RateLimitSettings } from '@/components/admin/rate-limit-settings';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/settings/')({
  component: SystemSettings,
});

function SystemSettings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System Configuration</h1>

      <section>
        <h2 className="text-xl font-semibold mb-4">Logging Configuration</h2>
        <LoggingSettings />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">API Rate Limits</h2>
        <RateLimitSettings />
      </section>

      {/* Other system settings sections go here */}
    </div>
  );
}
