import { format } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SecurityLog, ApiLog } from '@scaffold/types';

interface LogListProps {
  type: 'security' | 'api';
  logs: SecurityLog[] | ApiLog[];
  loading: boolean;
  expandedItems: string[];
  onToggleExpand: (id: string) => void;
}

export function LogList({
  type,
  logs,
  loading,
  expandedItems,
  onToggleExpand,
}: LogListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No logs found
      </div>
    );
  }

  return (
    <>
      {/* Mobile/Tablet View */}
      <div className="lg:hidden space-y-2">
        {logs.map((log) => (
          <LogListItem
            key={log._id}
            type={type}
            log={log}
            expanded={expandedItems.includes(log._id!)}
            onToggle={() => onToggleExpand(log._id!)}
          />
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden lg:block">
        {type === 'security' ? (
          <SecurityLogTable logs={logs as SecurityLog[]} />
        ) : (
          <ApiLogTable logs={logs as ApiLog[]} />
        )}
      </div>
    </>
  );
}

function LogListItem({
  type,
  log,
  expanded,
  onToggle,
}: {
  type: 'security' | 'api';
  log: SecurityLog | ApiLog;
  expanded: boolean;
  onToggle: () => void;
}) {
  const timestamp = log.timestamp
    ? format(new Date(log.timestamp), 'MM/d, HH:mm:ss')
    : 'N/A';

  return (
    <div
      className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors w-[calc(100vw-2rem)] md:w-[calc(100vw-3rem)]"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="text-sm font-mono text-muted-foreground whitespace-nowrap">
            {timestamp}
          </div>

          {type === 'security' ? (
            <SecurityLogSummary log={log as SecurityLog} />
          ) : (
            <ApiLogSummary log={log as ApiLog} />
          )}
        </div>

        <div className="flex items-center gap-2 ml-2">
          {type === 'security' && (
            <div className="flex items-center">
              {(log as SecurityLog).success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          {type === 'security' ? (
            <SecurityLogDetails log={log as SecurityLog} />
          ) : (
            <ApiLogDetails log={log as ApiLog} />
          )}
        </div>
      )}
    </div>
  );
}

function SecurityLogSummary({ log }: { log: SecurityLog }) {
  const getEventColor = (event: string) => {
    switch (event) {
      case 'LOGIN':
        return 'bg-green-100 text-green-800';
      case 'LOGOUT':
        return 'bg-blue-100 text-blue-800';
      case 'FAILED_LOGIN':
      case 'CSRF_FAILURE':
        return 'bg-red-100 text-red-800';
      case 'TOKEN_REFRESH':
        return 'bg-purple-100 text-purple-800';
      case 'SESSION_EXPIRED':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <Badge className={getEventColor(log.event)}>
        {log.event?.replace(/_/g, ' ')}
      </Badge>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {log.user?.email ?? 'Unknown User'}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {log.ipAddress ?? 'No IP'}
        </div>
      </div>
    </>
  );
}

function ApiLogSummary({ log }: { log: ApiLog }) {
  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-100 text-blue-800';
      case 'POST':
        return 'bg-green-100 text-green-800';
      case 'PUT':
        return 'bg-yellow-100 text-yellow-800';
      case 'PATCH':
        return 'bg-orange-100 text-orange-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 400 && status < 500) return 'text-yellow-600';
    if (status >= 500) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <>
      <Badge className={getMethodColor(log.method ?? '')}>{log.method}</Badge>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{log.path}</div>
        <div className="text-xs text-muted-foreground">{log.ip ?? 'No IP'}</div>
      </div>
      <div
        className={`text-sm font-mono ${getStatusColor(log.statusCode ?? 0)}`}
      >
        {log.statusCode}
      </div>
    </>
  );
}

function SecurityLogDetails({ log }: { log: SecurityLog }) {
  return (
    <div className="grid grid-cols-1 gap-2 text-sm">
      <div>
        <span className="font-medium">User ID:</span> {log.userId}
      </div>
      <div>
        <span className="font-medium">IP Address:</span>{' '}
        {log.ipAddress ?? 'N/A'}
      </div>
      <div>
        <span className="font-medium">User Agent:</span>{' '}
        {log.userAgent ?? 'N/A'}
      </div>
      <div>
        <span className="font-medium">Session ID:</span>{' '}
        {log.sessionId ?? 'N/A'}
      </div>
      {log.details && Object.keys(log.details).length > 0 && (
        <div>
          <span className="font-medium">Details:</span>
          <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
            {JSON.stringify(log.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ApiLogDetails({ log }: { log: ApiLog }) {
  return (
    <div className="grid grid-cols-1 gap-2 text-sm">
      <div>
        <span className="font-medium">Response Time:</span> {log.responseTime}ms
      </div>
      <div>
        <span className="font-medium">User ID:</span>{' '}
        {log.userId ?? 'Anonymous'}
      </div>
      <div>
        <span className="font-medium">Request ID:</span>{' '}
        {log.requestId ?? 'N/A'}
      </div>
      <div>
        <span className="font-medium">User Agent:</span>{' '}
        {log.userAgent ?? 'N/A'}
      </div>
      {log.metadata && Object.keys(log.metadata).length > 0 && (
        <div>
          <span className="font-medium">Metadata:</span>
          <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function SecurityLogTable({ logs }: { logs: SecurityLog[] }) {
  return (
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
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap">
                {log.timestamp
                  ? format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')
                  : 'N/A'}
              </TableCell>
              <TableCell>
                <div className="font-medium truncate max-w-[180px]">
                  {log.user?.email ?? 'Unknown User'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {log.userId}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getSecurityEventColor(log.event)}>
                  {log.event?.replace(/_/g, ' ')}
                </Badge>
              </TableCell>
              <TableCell>
                {log.success ? (
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
              <TableCell>{log.ipAddress ?? 'N/A'}</TableCell>
              <TableCell>
                <div className="text-xs max-w-[200px] truncate">
                  {log.details ? JSON.stringify(log.details) : 'No details'}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ApiLogTable({ logs }: { logs: ApiLog[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Path</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Response Time</TableHead>
            <TableHead>IP Address</TableHead>
            <TableHead>User</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log._id}>
              <TableCell className="whitespace-nowrap">
                {log.timestamp
                  ? format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')
                  : 'N/A'}
              </TableCell>
              <TableCell>
                <Badge className={getMethodColor(log.method ?? '')}>
                  {log.method}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[300px] truncate">
                {log.path}
              </TableCell>
              <TableCell>
                <span className={getStatusColor(log.statusCode ?? 0)}>
                  {log.statusCode}
                </span>
              </TableCell>
              <TableCell>{log.responseTime}ms</TableCell>
              <TableCell>{log.ip ?? 'N/A'}</TableCell>
              <TableCell>
                <div className="text-xs max-w-[150px] truncate">
                  {log.userId ?? 'Anonymous'}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Helper functions
function getSecurityEventColor(event: string) {
  switch (event) {
    case 'LOGIN':
      return 'bg-green-100 text-green-800';
    case 'LOGOUT':
      return 'bg-blue-100 text-blue-800';
    case 'FAILED_LOGIN':
    case 'CSRF_FAILURE':
      return 'bg-red-100 text-red-800';
    case 'TOKEN_REFRESH':
      return 'bg-purple-100 text-purple-800';
    case 'SESSION_EXPIRED':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getMethodColor(method: string) {
  switch (method) {
    case 'GET':
      return 'bg-blue-100 text-blue-800';
    case 'POST':
      return 'bg-green-100 text-green-800';
    case 'PUT':
      return 'bg-yellow-100 text-yellow-800';
    case 'PATCH':
      return 'bg-orange-100 text-orange-800';
    case 'DELETE':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getStatusColor(status: number) {
  if (status >= 200 && status < 300) return 'text-green-600';
  if (status >= 400 && status < 500) return 'text-yellow-600';
  if (status >= 500) return 'text-red-600';
  return 'text-gray-600';
}
