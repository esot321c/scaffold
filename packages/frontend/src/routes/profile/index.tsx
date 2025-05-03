import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import { Shield } from 'lucide-react';
import { apiClient, ErrorType, type ApiError } from '@/lib/utils/api-client';
import { useMutation } from '@tanstack/react-query';
import { FormError } from '@/components/ui/form-error';

export const Route = createFileRoute('/profile/')({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name ?? '',
    companyName: user?.companyName ?? '',
    phone: user?.phone ?? '',
    address: user?.address ?? '',
    website: user?.website ?? '',
  });
  const [error, setError] = useState<ApiError | null>(null);

  // Update form data when user data changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name ?? '',
        companyName: user.companyName ?? '',
        phone: user.phone ?? '',
        address: user.address ?? '',
        website: user.website ?? '',
      });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiClient.patch('users/profile', data),
    onSuccess: () => {
      refreshUser();
      setError(null);
      toast('Profile updated', {
        description: 'Your profile information has been saved successfully.',
      });
    },
    onError: (error) => {
      setError(error as ApiError);
      if ((error as ApiError).type !== ErrorType.VALIDATION) {
        toast('Update failed', {
          description:
            error instanceof Error ? error.message : 'Something went wrong',
        });
      }
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-3xl font-bold mb-6">Profile Settings</h1>

      <div className="grid gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Update your personal and company details.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.email ?? ''}
                  disabled
                  className="bg-muted/50"
                />
                <p className="text-sm text-muted-foreground">
                  Your email cannot be changed as it's used for authentication.
                </p>
                <FormError error={error} field="email" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                />
                <FormError error={error} field="name" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Your company name"
                />
                <FormError error={error} field="companyName" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Your phone number"
                  />
                  <FormError error={error} field="phone" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="Your website URL"
                  />
                  <FormError error={error} field="website" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Business Address</Label>
                <Textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Your business address"
                  rows={3}
                />
                <FormError error={error} field="address" />
              </div>
            </CardContent>

            <CardFooter className="flex justify-end">
              <Button type="submit" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Company Logo</CardTitle>
            <CardDescription>
              Upload your company logo to display on your quotes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="h-24 w-24 rounded-md border flex items-center justify-center bg-muted">
                {user?.companyLogo ? (
                  <img
                    src={user.companyLogo}
                    alt="Company logo"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-muted-foreground">No logo</span>
                )}
              </div>

              <div>
                <Button variant="outline" className="mb-2">
                  Upload Logo
                </Button>
                <p className="text-sm text-muted-foreground">
                  Recommended size: 400x400px. Max file size: 2MB.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Security</CardTitle>
            <CardDescription>
              Manage your account security and sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Active Sessions</h3>
              <p className="text-sm text-muted-foreground mb-2">
                You're currently signed in on this device.
              </p>
              <Link to="/profile/security">
                <Button variant="outline" size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  Manage Security Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
