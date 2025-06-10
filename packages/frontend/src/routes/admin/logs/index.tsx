import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/utils/api-client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { SecurityLog, ApiLog, PaginatedResponse } from '@scaffold/types';
import { LogFilters } from '@/components/admin/logs/log-filters';
import { LogList } from '@/components/admin/logs/log-list';
import { LogPagination } from '@/components/admin/logs/log-pagination';

export const Route = createFileRoute('/admin/logs/')({
  component: LogsPage,
});

interface SecurityFilters {
  page: number;
  limit: number;
  search: string;
  event: string;
  success?: boolean;
  userId: string;
  from: string;
  to: string;
}

interface ApiFilters {
  page: number;
  limit: number;
  search: string;
  method: string;
  path: string;
  statusCode?: number;
  userId: string;
  from: string;
  to: string;
}

type TabOptions = 'security' | 'api';

interface LogsState {
  activeTab: TabOptions;
  securityFilters: SecurityFilters;
  apiFilters: ApiFilters;
  expandedItems: string[];
}

const defaultSecurityFilters: SecurityFilters = {
  page: 1,
  limit: 50,
  search: '',
  event: '',
  success: undefined,
  userId: '',
  from: '',
  to: '',
};

const defaultApiFilters: ApiFilters = {
  page: 1,
  limit: 50,
  search: '',
  method: '',
  path: '',
  statusCode: undefined,
  userId: '',
  from: '',
  to: '',
};

// SessionStorage helpers
const STORAGE_KEY = 'admin-logs-state';

function saveToSession(state: Partial<LogsState>) {
  try {
    const existing = getFromSession();
    const updated = { ...existing, ...state };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to save logs state to sessionStorage:', error);
  }
}

function getFromSession(): Partial<LogsState> {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load logs state from sessionStorage:', error);
    return {};
  }
}

function LogsPage() {
  // Initialize state from sessionStorage
  const [state, setState] = useState<LogsState>(() => {
    const stored = getFromSession();
    return {
      activeTab: stored.activeTab ?? 'security',
      securityFilters: { ...defaultSecurityFilters, ...stored.securityFilters },
      apiFilters: { ...defaultApiFilters, ...stored.apiFilters },
      expandedItems: stored.expandedItems ?? [],
    };
  });

  // Save state changes to sessionStorage
  useEffect(() => {
    saveToSession(state);
  }, [state]);

  // Security logs query
  const securityLogsQuery = useQuery({
    queryKey: ['logs', 'security', state.securityFilters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(state.securityFilters).forEach(([key, value]) => {
        if (value !== '' && value !== undefined) {
          params.append(key, value.toString());
        }
      });
      return apiClient.get<PaginatedResponse<SecurityLog>>(
        `logs/security?${params.toString()}`,
      );
    },
    enabled: state.activeTab === 'security',
  });

  // API logs query
  const apiLogsQuery = useQuery({
    queryKey: ['logs', 'api', state.apiFilters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(state.apiFilters).forEach(([key, value]) => {
        if (value !== '' && value !== undefined) {
          params.append(key, value.toString());
        }
      });
      return apiClient.get<PaginatedResponse<ApiLog>>(
        `logs/api?${params.toString()}`,
      );
    },
    enabled: state.activeTab === 'api',
  });

  const updateSecurityFilters = (key: string, value: string | number) => {
    setState((prev) => ({
      ...prev,
      securityFilters: {
        ...prev.securityFilters,
        [key]: value === 'all' ? '' : value, // Clear the filter if "all" is selected
        ...(key !== 'page' && { page: 1 }), // Reset to page 1 when filtering
      },
    }));
  };

  const updateApiFilters = (key: string, value: string | number) => {
    setState((prev) => ({
      ...prev,
      apiFilters: {
        ...prev.apiFilters,
        [key]: value === 'all' ? '' : value, // Clear the filter if "all" is selected
        ...(key !== 'page' && { page: 1 }), // Reset to page 1 when filtering
      },
    }));
  };

  const clearSecurityFilters = () => {
    setState((prev) => ({ ...prev, securityFilters: defaultSecurityFilters }));
  };

  const clearApiFilters = () => {
    setState((prev) => ({ ...prev, apiFilters: defaultApiFilters }));
  };

  const handleExport = async (type: 'security' | 'api') => {
    try {
      const filters =
        type === 'security' ? state.securityFilters : state.apiFilters;
      const params = new URLSearchParams();

      params.append('type', type);
      params.append('format', 'csv');

      // Add filters (excluding pagination)
      Object.entries(filters).forEach(([key, value]) => {
        if (
          key !== 'page' &&
          key !== 'limit' &&
          value !== '' &&
          value !== undefined
        ) {
          params.append(key, value.toString());
        }
      });

      window.open(
        `${import.meta.env.VITE_API_URL}/logs/export?${params.toString()}`,
      );
      toast.success(`${type} logs export started`);
    } catch (error) {
      toast.error('Failed to export logs');
      console.error(error);
    }
  };

  const handleRefresh = () => {
    if (state.activeTab === 'security') {
      securityLogsQuery.refetch();
    } else {
      apiLogsQuery.refetch();
    }
  };

  const toggleExpanded = (id: string) => {
    setState((prev) => ({
      ...prev,
      expandedItems: prev.expandedItems.includes(id)
        ? prev.expandedItems.filter((item) => item !== id)
        : [...prev.expandedItems, id],
    }));
  };

  const handleTabChange = (tab: string) => {
    setState((prev) => ({ ...prev, activeTab: tab as TabOptions }));
  };

  const handleSearch = () => {
    // Triggers refetch due to filter dependency
    if (state.activeTab === 'security') {
      securityLogsQuery.refetch();
    } else {
      apiLogsQuery.refetch();
    }
  };

  const currentQuery =
    state.activeTab === 'security' ? securityLogsQuery : apiLogsQuery;
  const currentLogs = currentQuery.data?.data || [];
  const currentPagination = currentQuery.data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-col sm:flex-row">
        <h1 className="text-2xl font-bold">System Logs</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={currentQuery.isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${currentQuery.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport(state.activeTab)}
          >
            <Download className="h-4 w-4 mr-2" />
            Export {state.activeTab === 'security' ? 'Security' : 'API'} Logs
          </Button>
        </div>
      </div>

      <Tabs value={state.activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="security">Security Logs</TabsTrigger>
          <TabsTrigger value="api">API Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="security" className="space-y-4">
          <LogFilters
            type="security"
            filters={state.securityFilters}
            onFilterChange={updateSecurityFilters}
            onClear={clearSecurityFilters}
            onSearch={handleSearch}
          />

          <LogList
            type="security"
            logs={currentLogs}
            loading={securityLogsQuery.isLoading}
            expandedItems={state.expandedItems}
            onToggleExpand={toggleExpanded}
          />

          {currentPagination && currentPagination.type === 'offset' && (
            <LogPagination
              currentPage={currentPagination.page}
              totalPages={currentPagination.pages}
              totalItems={currentPagination.total}
              itemsPerPage={currentPagination.limit}
              onPageChange={(page) => updateSecurityFilters('page', page)}
            />
          )}
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <LogFilters
            type="api"
            filters={state.apiFilters}
            onFilterChange={updateApiFilters}
            onClear={clearApiFilters}
            onSearch={handleSearch}
          />

          <LogList
            type="api"
            logs={currentLogs}
            loading={apiLogsQuery.isLoading}
            expandedItems={state.expandedItems}
            onToggleExpand={toggleExpanded}
          />

          {currentPagination && currentPagination.type === 'offset' && (
            <LogPagination
              currentPage={currentPagination.page}
              totalPages={currentPagination.pages}
              totalItems={currentPagination.total}
              itemsPerPage={currentPagination.limit}
              onPageChange={(page) => updateApiFilters('page', page)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
