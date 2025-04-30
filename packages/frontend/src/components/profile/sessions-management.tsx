import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/utils/api-client';
import { useAuth } from '@/contexts/auth-context';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Check, X, Shield, LogOut } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Session {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  ipAddress: string;
  userAgent: string;
  isCurrent?: boolean;
}

export function SessionsManagement() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    sessionId?: string;
    allSessions?: boolean;
  }>({ open: false });
  const { user, logout } = useAuth();

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<Session[]>('auth/sessions');

      // Mark current session
      const updatedSessions = response.map((session) => ({
        ...session,
        isCurrent: session.id === user?.session?.id,
      }));

      setSessions(updatedSessions);
    } catch (error) {
      toast.error('Failed to load sessions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [user]);

  const handleRevokeSession = async (sessionId?: string) => {
    try {
      if (confirmDialog.allSessions) {
        await apiClient.delete('auth/sessions');
        toast.success('All other sessions have been terminated');
      } else if (sessionId) {
        const isCurrent = sessions.find((s) => s.id === sessionId)?.isCurrent;

        await apiClient.delete(`auth/sessions/${sessionId}`);

        if (isCurrent) {
          // If we revoked our own session, log out
          await logout();
          return;
        }

        toast.success('Session has been terminated');
      }

      fetchSessions();
    } catch (error) {
      toast.error('Failed to revoke session');
      console.error(error);
    } finally {
      setConfirmDialog({ open: false });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (e) {
      return 'Unknown';
    }
  };

  // Helper to extract browser and OS from user agent
  const parseUserAgent = (userAgent: string) => {
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';

    return { browser, os };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Active Sessions</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmDialog({ open: true, allSessions: true })}
          disabled={sessions.length <= 1}
        >
          <Shield className="mr-2 h-4 w-4" />
          Log Out All Other Devices
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No active sessions found
              </p>
            ) : (
              sessions.map((session) => {
                const { browser, os } = parseUserAgent(session.userAgent);
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center">
                        <span className="font-medium">
                          {browser} on {os}
                        </span>
                        {session.isCurrent && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary flex items-center">
                            <Check className="h-3 w-3 mr-1" /> Current
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        IP: {session.ipAddress || 'Unknown'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Last active: {formatDate(session.lastActiveAt)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Created: {formatDate(session.createdAt)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setConfirmDialog({
                          open: true,
                          sessionId: session.id,
                        })
                      }
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {session.isCurrent ? 'Sign Out' : 'Revoke'}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.allSessions
                ? 'Log out from all other devices?'
                : sessions.find((s) => s.id === confirmDialog.sessionId)
                      ?.isCurrent
                  ? 'Sign out from current session?'
                  : 'Revoke this session?'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.allSessions
                ? 'This will terminate all sessions except your current session. You will need to sign in again on other devices.'
                : sessions.find((s) => s.id === confirmDialog.sessionId)
                      ?.isCurrent
                  ? 'You will be signed out immediately and redirected to the login page.'
                  : 'This session will be terminated immediately. The user will need to sign in again.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false })}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleRevokeSession(confirmDialog.sessionId)}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {confirmDialog.allSessions
                ? 'Log Out All Other Devices'
                : sessions.find((s) => s.id === confirmDialog.sessionId)
                      ?.isCurrent
                  ? 'Sign Out'
                  : 'Revoke Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
