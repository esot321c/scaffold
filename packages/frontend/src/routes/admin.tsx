import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { Shield } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import {
  AdminSidebar,
  AdminSidebarTrigger,
  AdminSidebarProvider,
} from '@/components/layouts/admin/sidebar';

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});

export function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect non-admin users
  if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    navigate({ to: '/' });
    return null;
  }

  return (
    <AdminSidebarProvider>
      <div className="grid min-h-screen lg:grid-cols-[240px_1fr] -mt-6">
        {/* Sidebar */}
        <AdminSidebar />

        {/* Content area */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b bg-background flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AdminSidebarTrigger />
              <h1 className="text-xl font-semibold mb-0">Admin Portal</h1>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-blue-500" />
              <span className="text-sm">
                {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} Mode
              </span>
            </div>
          </div>
          <div className="flex-1 p-4 md:p-6 overflow-auto">
            <Outlet />
          </div>
        </div>
      </div>
    </AdminSidebarProvider>
  );
}
