import { Button } from '@/components/ui/button';
import { createFileRoute } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient();

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="container mx-auto py-20 px-4">
        <h1 className="text-4xl font-bold mb-4">Scaffold</h1>
        <p className="text-xl mb-8">
          Open-source, TypeScript-based foundation for production applications.
        </p>
        {/* More hero content */}
      </section>

      {/* Features section */}
      <section id="features" className="bg-background py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12 text-center">Features</h2>
          {/* Features content */}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to get started?</h2>
          <Button size="lg">Sign Up Free</Button>
        </div>
      </section>
    </>
  );
}
