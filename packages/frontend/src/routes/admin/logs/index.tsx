import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/utils/api-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Search, Download, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/admin/logs/')({
  component: SecurityLogs,
});

interface LogEntry {
  id: string;
  userId: string;
  userEmail: string;
  event: string;
  ipAddress: string | null;
  userAgent: string | null;
  successful: boolean;
  details: Record<string, any> | null;
  createdAt: string;
}

function SecurityLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventType, setEventType] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [page, eventType]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '50');

      if (eventType !== 'all') {
        params.append('event', eventType);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const data = await apiClient.get<{ logs: LogEntry[]; hasMore: boolean }>(
        `admin/logs?${params.toString()}`,
      );

      if (page === 1) {
        setLogs(data.logs);
      } else {
        setLogs((prev) => [...prev, ...data.logs]);
      }

      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const clearSearch = () => {
    setSearchTerm('');
    setEventType('all');
    setPage(1);
    fetchLogs();
  };

  const loadMore = () => {
    setPage((p) => p + 1);
  };

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams();

      if (eventType !== 'all') {
        params.append('event', eventType);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      window.open(
        `${import.meta.env.VITE_API_URL}/admin/logs/export?${params.toString()}`,
      );
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  const getEventBadgeColor = (event: string) => {
    switch (event) {
      case 'login':
        return 'bg-green-100 text-green-800';
      case 'logout':
        return 'bg-blue-100 text-blue-800';
      case 'failed_login':
      case 'csrf_failure':
        return 'bg-red-100 text-red-800';
      case 'token_refresh':
        return 'bg-purple-100 text-purple-800';
      case 'session_expired':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Security Logs</h1>
        <Button variant="outline" onClick={exportLogs}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user email, IP address..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          {searchTerm && (
            <button
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="logout">Logout</SelectItem>
            <SelectItem value="failed_login">Failed Login</SelectItem>
            <SelectItem value="token_refresh">Token Refresh</SelectItem>
            <SelectItem value="session_expired">Session Expired</SelectItem>
            <SelectItem value="csrf_failure">CSRF Failure</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button onClick={handleSearch}>Search</Button>
          <Button variant="outline" onClick={clearSearch}>
            Reset
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && page === 1 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading logs...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  No logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium truncate max-w-[180px]">
                      {log.userEmail}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {log.userId}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getEventBadgeColor(log.event)}>
                      {log.event}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.successful ? (
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                        <span className="text-xs">Success</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <AlertCircle className="h-4 w-4 text-red-500 mr-1" />
                        <span className="text-xs">Failed</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{log.ipAddress || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="text-xs max-w-[200px] truncate">
                      {log.details ? JSON.stringify(log.details) : 'No details'}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading && page > 1}
          >
            {loading && page > 1 ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
