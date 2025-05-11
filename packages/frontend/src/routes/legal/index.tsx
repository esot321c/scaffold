import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PrivacyPolicy } from '@/components/legal/privacy-policy';
import { TermsOfService } from '@/components/legal/terms-of-service';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Define the valid tab values
type TabValue = 'privacy' | 'terms';

// Validate search params
export const Route = createFileRoute('/legal/')({
  validateSearch: (search) => {
    return {
      tab: (search.tab as TabValue) || 'privacy',
    };
  },
  component: LegalPage,
});

function LegalPage() {
  // Get the tab from URL query params
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  // Handle tab change
  const handleTabChange = (value: string) => {
    // Use the type-safe method by specifying the exact search object
    navigate({
      to: '/legal',
      search: { tab: value as TabValue },
      replace: true,
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-6"
          onClick={() => navigate({ to: '/' })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to home
        </Button>

        <div className="bg-card rounded-lg border shadow">
          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <div className="border-b px-6 py-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="privacy">Privacy Policy</TabsTrigger>
                <TabsTrigger value="terms">Terms of Service</TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6">
              <TabsContent value="privacy">
                <PrivacyPolicy />
              </TabsContent>
              <TabsContent value="terms">
                <TermsOfService />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
