// packages/frontend/src/routes/admin/users/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { apiClient } from '@/lib/utils/api-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, UserCheck, UserX, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const Route = createFileRoute('/admin/users/')({
  component: UserManagement,
});

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  createdAt: string;
  lastLoginAt: string | null;
  sessionCount: number;
}

function UserManagement() {
  const queryClient = useQueryClient();

  // Query for fetching users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiClient.get<AdminUser[]>('admin/users'),
  });

  // Mutation for updating user role
  const updateRoleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: 'USER' | 'ADMIN';
    }) => apiClient.put(`admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      toast.success('User role updated successfully');
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (error) => {
      console.error('Failed to update user role:', error);
      toast.error('Failed to update user role');
    },
  });

  const updateUserRole = (userId: string, role: 'USER' | 'ADMIN') => {
    updateRoleMutation.mutate({ userId, role });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Button size="sm">Refresh</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">
                      {user.name || '(No name)'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.role === 'SUPER_ADMIN' ? (
                        <Shield className="h-4 w-4 text-blue-500" />
                      ) : user.role === 'ADMIN' ? (
                        <Shield className="h-4 w-4 text-gray-500" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                      {user.role}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {user.lastLoginAt
                      ? format(new Date(user.lastLoginAt), 'MMM d, yyyy HH:mm')
                      : 'Never'}
                  </TableCell>
                  <TableCell>{user.sessionCount}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => updateUserRole(user.id, 'ADMIN')}
                          disabled={
                            user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
                          }
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => updateUserRole(user.id, 'USER')}
                          disabled={
                            user.role === 'SUPER_ADMIN' || user.role === 'USER'
                          }
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          Remove Admin
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
