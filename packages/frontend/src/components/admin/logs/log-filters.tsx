import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface BaseFilters {
  search: string;
  userId: string;
  from: string;
  to: string;
}

interface SecurityFilters extends BaseFilters {
  event: string;
  success?: boolean;
}

interface ApiFilters extends BaseFilters {
  method: string;
  path: string;
  statusCode?: number;
}

interface LogFiltersProps {
  type: 'security' | 'api';
  filters: SecurityFilters | ApiFilters;
  onFilterChange: (key: string, value: string) => void;
  onClear: () => void;
  onSearch: () => void;
}

export function LogFilters({
  type,
  filters,
  onFilterChange,
  onClear,
  onSearch,
}: LogFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Search and basic filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              type === 'security'
                ? 'Search by user email, IP address...'
                : 'Search by path, IP address...'
            }
            className="pl-8"
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
          {filters.search && (
            <button
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => onFilterChange('search', '')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {type === 'security' ? (
          <SecuritySpecificFilters
            filters={filters as SecurityFilters}
            onFilterChange={onFilterChange}
          />
        ) : (
          <ApiSpecificFilters
            filters={filters as ApiFilters}
            onFilterChange={onFilterChange}
          />
        )}

        <div className="flex gap-2">
          <Button onClick={onSearch}>Search</Button>
          <Button variant="outline" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>

      {/* Date range filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            type="datetime-local"
            placeholder="From date"
            value={filters.from}
            onChange={(e) => onFilterChange('from', e.target.value)}
          />
        </div>
        <div className="flex-1">
          <Input
            type="datetime-local"
            placeholder="To date"
            value={filters.to}
            onChange={(e) => onFilterChange('to', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function SecuritySpecificFilters({
  filters,
  onFilterChange,
}: {
  filters: SecurityFilters;
  onFilterChange: (key: string, value: any) => void;
}) {
  return (
    <>
      <Select
        value={filters.event}
        onValueChange={(value) => onFilterChange('event', value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Event Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Events</SelectItem>
          <SelectItem value="LOGIN">Login</SelectItem>
          <SelectItem value="LOGOUT">Logout</SelectItem>
          <SelectItem value="FAILED_LOGIN">Failed Login</SelectItem>
          <SelectItem value="TOKEN_REFRESH">Token Refresh</SelectItem>
          <SelectItem value="SESSION_EXPIRED">Session Expired</SelectItem>
          <SelectItem value="CSRF_FAILURE">CSRF Failure</SelectItem>
          <SelectItem value="DEVICE_TRUSTED">Device Trusted</SelectItem>
          <SelectItem value="DEVICE_REMOVED">Device Removed</SelectItem>
          <SelectItem value="SESSION_TERMINATED">Session Terminated</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.success?.toString() ?? ''}
        onValueChange={(value) =>
          onFilterChange('success', value === '' ? undefined : value === 'true')
        }
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="true">Success</SelectItem>
          <SelectItem value="false">Failed</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

function ApiSpecificFilters({
  filters,
  onFilterChange,
}: {
  filters: ApiFilters;
  onFilterChange: (key: string, value: any) => void;
}) {
  return (
    <>
      <Select
        value={filters.method}
        onValueChange={(value) => onFilterChange('method', value)}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="GET">GET</SelectItem>
          <SelectItem value="POST">POST</SelectItem>
          <SelectItem value="PUT">PUT</SelectItem>
          <SelectItem value="PATCH">PATCH</SelectItem>
          <SelectItem value="DELETE">DELETE</SelectItem>
        </SelectContent>
      </Select>

      <Input
        placeholder="Path filter"
        className="w-[150px]"
        value={filters.path}
        onChange={(e) => onFilterChange('path', e.target.value)}
      />

      <Select
        value={filters.statusCode?.toString() ?? ''}
        onValueChange={(value) =>
          onFilterChange(
            'statusCode',
            value === '' ? undefined : parseInt(value),
          )
        }
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="200">200</SelectItem>
          <SelectItem value="400">400</SelectItem>
          <SelectItem value="401">401</SelectItem>
          <SelectItem value="403">403</SelectItem>
          <SelectItem value="404">404</SelectItem>
          <SelectItem value="500">500</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}
