import { AuthErrorAlert } from '@/components/auth/auth-error-alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/auth/success')({
  component: AuthSuccess,
});

function AuthSuccess() {
  const navigate = useNavigate();
  const { refreshUser, isLoading, error } = useAuth();
  const [countdown, setCountdown] = useState(5);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Trigger an update when the component mounts
    refreshUser()
      .then(() => {
        // After refreshing user data, start countdown timer
        // Navigation will happen from the timer effect
      })
      .catch((err) => {
        console.error('Auth refresh failed:', err);
        navigate({
          to: '/login',
          search: { error: 'auth_failed' },
          replace: true,
        });
      });
  }, []);

  useEffect(() => {
    // Timer effect for countdown
    if (countdown > 0 && !isLoading && !error && !isPaused) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (countdown === 0 && !isPaused) {
      navigate({ to: '/' });
    }
  }, [countdown, isLoading, error, isPaused]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
        <p className="text-muted-foreground">Completing login...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full">
          <AuthErrorAlert title="Authentication Error" message={error} />
          <p className="mb-4 text-center">
            Check the console for more details.
          </p>
          <Button
            onClick={() =>
              navigate({
                to: '/login',
                search: { error: undefined },
              })
            }
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Success UI with countdown
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-card p-6 rounded-lg shadow-md max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Login Successful!</h2>
        <p className="mb-6">
          Redirecting you to the dashboard in {countdown} seconds...
        </p>
        <div className="flex gap-2">
          <Button onClick={() => navigate({ to: '/' })} className="flex-1">
            Continue Now
          </Button>
          <Button onClick={() => setIsPaused(!isPaused)} variant="outline">
            {isPaused ? 'Resume Timer' : 'Pause Timer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
