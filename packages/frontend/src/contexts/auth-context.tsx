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

  const fetchUser = async () => {
    try {
      setIsLoading(true);
      const userData = await apiClient.get<UserWithSession>('users/me');
      setUser(userData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred',
      );
      console.error(err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('auth/logout');
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Initial authentication check
  useEffect(() => {
    fetchUser();
  }, []);

  // Check session validity periodically
  useEffect(() => {
    if (!user) return;

    const checkInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/users/session`,
          { credentials: 'include' },
        );

        if (!response.ok) {
          setUser(null);
        }
      } catch (err) {
        console.error('Failed to check session:', err);
      }
    }, SESSION_CHECK_INTERVAL);

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
