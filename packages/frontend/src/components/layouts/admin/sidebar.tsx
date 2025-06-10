import { Link } from '@tanstack/react-router';
import { Activity, Bell, LogOut, Settings, Users, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

const menuItems = [
  {
    title: 'Dashboard',
    url: '/admin',
    icon: Activity,
    exact: true,
  },
  {
    title: 'User Management',
    url: '/admin/users',
    icon: Users,
  },
  {
    title: 'Logs',
    url: '/admin/logs',
    icon: Activity,
  },
  {
    title: 'System Config',
    url: '/admin/settings',
    icon: Settings,
    exact: true,
  },
  {
    title: 'Notifications',
    url: '/admin/settings/notifications',
    icon: Bell,
  },
];

// Context for mobile menu state
const MobileMenuContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
});

export function AdminSidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <MobileMenuContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </MobileMenuContext.Provider>
  );
}

export function AdminSidebar() {
  const { user, logout } = useAuth();
  const { isOpen, setIsOpen } = useContext(MobileMenuContext);

  const handleLogout = async () => {
    await logout();
  };

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, setIsOpen]);

  const SidebarContent = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <div className="border-r flex flex-col h-full bg-background">
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.title}>
              <Link
                to={item.url}
                className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted transition-colors"
                activeProps={{ className: 'bg-muted' }}
                activeOptions={{ exact: item.exact }}
                onClick={onLinkClick}
              >
                <item.icon size={16} />
                <span>{item.title}</span>
              </Link>
            </li>
          ))}
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

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <SidebarContent />
      </div>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`
        fixed top-0 left-0 h-full w-64 z-50 transform transition-transform duration-300 ease-in-out lg:hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      >
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <h2 className="font-semibold">Admin Panel</h2>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            <X size={16} />
          </Button>
        </div>
        <SidebarContent onLinkClick={() => setIsOpen(false)} />
      </div>
    </>
  );
}

export function AdminSidebarTrigger() {
  const { setIsOpen } = useContext(MobileMenuContext);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="lg:hidden"
      onClick={() => setIsOpen(true)}
    >
      <Menu size={16} />
      <span className="sr-only">Open menu</span>
    </Button>
  );
}
