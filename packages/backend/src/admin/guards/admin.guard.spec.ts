import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { UserRole } from '@/generated/prisma';

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminGuard],
    }).compile();

    guard = module.get<AdminGuard>(AdminGuard);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow ADMIN users', () => {
      const mockUser = { id: 'admin-1', role: UserRole.ADMIN };
      const context = createMockContext(mockUser);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow SUPER_ADMIN users', () => {
      const mockUser = { id: 'super-1', role: UserRole.SUPER_ADMIN };
      const context = createMockContext(mockUser);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should reject USER role', () => {
      const mockUser = { id: 'user-1', role: UserRole.USER };
      const context = createMockContext(mockUser);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Requires admin privileges'),
      );
    });

    it('should reject when no user is present', () => {
      const context = createMockContext(null);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Authentication required'),
      );
    });

    it('should reject when user is undefined', () => {
      const context = createMockContext(undefined);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Authentication required'),
      );
    });

    it('should reject when user has no role', () => {
      const mockUser = { id: 'user-1' }; // Missing role
      const context = createMockContext(mockUser);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Requires admin privileges'),
      );
    });

    it('should reject when user has invalid role', () => {
      const mockUser = { id: 'user-1', role: 'INVALID_ROLE' };
      const context = createMockContext(mockUser);

      expect(() => guard.canActivate(context)).toThrow(
        new ForbiddenException('Requires admin privileges'),
      );
    });
  });
});
