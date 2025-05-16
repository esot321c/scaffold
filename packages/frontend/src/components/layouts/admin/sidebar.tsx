import { Link } from '@tanstack/react-router';
import { Activity, Bell, LogOut, Settings, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';

export function AdminSidebar() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="border-r flex flex-col">
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          <li>
            <Link
              to="/admin"
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted"
              activeProps={{ className: 'bg-muted' }}
              activeOptions={{ exact: true }}
            >
              <Activity size={16} />
              <span>Dashboard</span>
            </Link>
          </li>
          <li>
            <Link
              to="/admin/users"
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted"
              activeProps={{ className: 'bg-muted' }}
            >
              <Users size={16} />
              <span>User Management</span>
            </Link>
          </li>
          <li>
            <Link
              to="/admin/logs"
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted"
              activeProps={{ className: 'bg-muted' }}
            >
              <Activity size={16} />
              <span>Security Logs</span>
            </Link>
          </li>
          <li>
            <Link
              to="/admin/settings"
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted"
              activeProps={{ className: 'bg-muted' }}
              activeOptions={{ exact: true }}
            >
              <Settings size={16} />
              <span>System Config</span>
            </Link>
          </li>
          <li>
            <Link
              to="/admin/settings/notifications"
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted"
              activeProps={{ className: 'bg-muted' }}
            >
              <Bell size={16} />
              <span>Notifications</span>
            </Link>
          </li>
        </ul>
      </nav>

      <div className="p-4 border-t mt-auto">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">{user?.email}</div>
          <div className="text-xs text-muted-foreground">
            {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut size={14} className="mr-2" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
