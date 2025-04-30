import { BarChart2 } from 'lucide-react';

export function Footer() {
  return (
    <footer className="py-12 bg-muted">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between">
          <div className="mb-8 md:mb-0">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="h-6 w-6 text-blue-400" />
              <span className="text-xl font-bold">Scaffold</span>
            </div>
            <p className="text-muted-foreground max-w-md">
              Open-source, TypeScript-based foundation for production
              applications.
            </p>
          </div>
          {/* Footer links here */}
        </div>
        <div className="border-t border-border mt-12 pt-8 text-muted-foreground text-sm">
          <p>
            &copy; {new Date().getFullYear()} Scaffold. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
