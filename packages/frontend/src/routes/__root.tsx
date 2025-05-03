import { Outlet, createRootRoute } from '@tanstack/react-router';
import { Navbar } from '@/components/layouts/main/navbar';
import { Footer } from '@/components/layouts/main/footer';
import { Toaster } from '@/components/ui/sonner';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-grow pt-6">
        <Outlet />
      </main>
      <Footer />
      <Toaster />
      {/* {env.VITE_APP_ENV !== 'production' && <TanStackRouterDevtools />} */}
    </div>
  );
}
