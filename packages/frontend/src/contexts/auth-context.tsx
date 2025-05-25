import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { UserWithSession } from '@scaffold/types';
import { apiClient } from '@/lib/utils/api-client';

interface AuthContextType {
  user: UserWithSession | null;
  isLoading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session check interval (1 minute)
const SESSION_CHECK_INTERVAL = 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserWithSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Refresh token after 60 minutes (60 minutes before 2-hour expiry)
    const refreshInterval = setInterval(
      async () => {
        try {
          await apiClient.post('auth/refresh');
          // Token is automatically updated via cookie
        } catch (error) {
          console.error('Token refresh failed:', error);
          // Force re-login if refresh fails
          setUser(null);
          setError('Session expired, please login again');
        }
      },
      60 * 60 * 1000,
    ); // 60 minutes

    return () => clearInterval(refreshInterval);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const handleFocus = async () => {
      try {
        // Only refresh if we haven't refreshed recently
        // This prevents unnecessary refreshes if user is actively using the app
        const lastRefresh = localStorage.getItem('lastTokenRefresh');
        const now = Date.now();
        const fifteenMinutes = 15 * 60 * 1000;

        if (!lastRefresh || now - parseInt(lastRefresh) > fifteenMinutes) {
          await apiClient.post('auth/refresh');
          localStorage.setItem('lastTokenRefresh', now.toString());
        }
      } catch (error) {
        console.error('Focus token refresh failed:', error);
        setUser(null);
        setError('Session expired, please login again');
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        handleFocus();
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user]);

  const fetchUser = async () => {
    try {
      setIsLoading(true);
      const userData = await apiClient.get<UserWithSession>('users/me');
      setUser(userData);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred',
      );
      console.error('User fetch error:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('auth/logout');
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
      // Don't set error here as logout failures shouldn't block the UI
    }
  };

  // Initial authentication check
  useEffect(() => {
    fetchUser();
  }, []);

  // Check session validity periodically
  useEffect(() => {
    if (!user) return;

    const checkSession = async () => {
      try {
        await apiClient.get('users/session');
        // Session is still valid if no error is thrown
      } catch (err) {
        // Session is invalid or expired
        setUser(null);
      }
    };

    const checkInterval = setInterval(checkSession, SESSION_CHECK_INTERVAL);
    return () => clearInterval(checkInterval);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        logout,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
