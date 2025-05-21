import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/utils/api-client';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface RateLimits {
  auth: number;
  admin: number;
  api: number;
}

export function RateLimitSettings() {
  const [limits, setLimits] = useState<RateLimits>({
    auth: 10,
    admin: 30,
    api: 60,
  });

  // Fetch current rate limits
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'rate-limits'],
    queryFn: () => apiClient.get<RateLimits>('admin/rate-limits'),
  });

  // Update rate limits when data is loaded
  useEffect(() => {
    if (data) {
      setLimits(data);
    }
  }, [data]);

  // Mutation for updating rate limits
  const updateLimitsMutation = useMutation({
    mutationFn: (newLimits: RateLimits) =>
      apiClient.put('admin/rate-limits', newLimits),
    onSuccess: () => {
      toast.success('Rate limits updated successfully');
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to update rate limits');
      console.error(error);
    },
  });

  // Handle input changes
  const handleChange = (key: keyof RateLimits, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      setLimits((prev) => ({
        ...prev,
        [key]: numValue,
      }));
    }
  };

  // Handle save
  const handleSave = () => {
    updateLimitsMutation.mutate(limits);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate Limit Settings</CardTitle>
        <CardDescription>
          Configure request limits to protect your API from abuse
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="authLimit">
            Authentication Endpoints (requests per minute)
          </Label>
          <Input
            id="authLimit"
            type="number"
            min="1"
            value={limits.auth}
            onChange={(e) => handleChange('auth', e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Applies to all /auth/* endpoints including login, token refresh, and
            OAuth flows
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adminLimit">
            Admin Endpoints (requests per minute)
          </Label>
          <Input
            id="adminLimit"
            type="number"
            min="1"
            value={limits.admin}
            onChange={(e) => handleChange('admin', e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Applies to all /admin/* endpoints for administrative functions
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiLimit">
            General API Endpoints (requests per minute)
          </Label>
          <Input
            id="apiLimit"
            type="number"
            min="1"
            value={limits.api}
            onChange={(e) => handleChange('api', e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Default limit applied to all other API endpoints
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={updateLimitsMutation.isPending}>
          {updateLimitsMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
