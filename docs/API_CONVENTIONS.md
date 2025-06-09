# API Design Conventions

## Overview

This document outlines the API design patterns and conventions used throughout the Scaffold application. These patterns prioritize type safety, consistency, and developer experience while minimizing boilerplate.

## Core Principles

1. **Shared Types First** - Use shared TypeScript types between frontend and backend for consistency
2. **DTOs for Input Only** - Use DTOs with validation for incoming data, return raw interfaces for responses
3. **Type Safety Everywhere** - Leverage TypeScript's type system to catch errors at compile time
4. **Consistent Error Handling** - Use standardized error responses across all endpoints
5. **Proper Documentation** - Every endpoint should have complete Swagger documentation
6. **Flexible Pagination** - Each endpoint chooses the most appropriate pagination strategy

## HTTP Status Codes as API Contract

### Use 204 No Content for Action Endpoints

When an endpoint performs an action but has no meaningful data to return, use HTTP 204:

```typescript
// ✅ Good - Action completed, no data to return
@Post('test')
@HttpCode(204)
@ApiOperation({ summary: 'Send a test notification' })
async sendTestNotification(@CurrentUser() user: User): Promise<void> {
  await this.notificationsService.triggerNotification(/* ... */);
  // No return statement needed
}

// ✅ Good - Frontend handles 204 automatically
const testMutation = useMutation({
  mutationFn: () => apiClient.post('admin/notifications/test'),
  onSuccess: () => toast.success('Action completed'),
});
```

**Perfect for:**

- Test/validation actions
- Delete operations
- Toggle/enable/disable actions
- Logout endpoints
- Any "fire and forget" commands

### Avoid Meaningless Success Objects

```typescript
// ❌ Bad - Boilerplate noise
return { success: true, message: 'Action completed' };

// ✅ Good - Let HTTP status communicate success
// (204 = success, 4xx/5xx = failure)
```

### When NOT to Use 204

Use proper data responses when you have meaningful data:

```typescript
// ✅ Good - Return created resource
@Post()
async createUser(@Body() dto: CreateUserDto): Promise<User> {
  return this.usersService.create(dto);
}

// ✅ Good - Return updated resource
@Put(':id')
async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<User> {
  return this.usersService.update(id, dto);
}
```

### Status Code Guidelines

- **200** - Success with data
- **201** - Resource created (return the created resource)
- **204** - Action completed, no data to return
- **4xx** - Client error (handled by global exception filter)
- **5xx** - Server error (handled by global exception filter)

## Request/Response Patterns

### Input (Request) DTOs

**Use DTOs with validation for all incoming data:**

```typescript
// ✅ Good - Input DTO with validation
export class UpdateLogRetentionDto {
  @IsInt()
  @Min(1)
  @Max(365)
  securityLogDays: number;

  @IsInt()
  @Min(1)
  @Max(365)
  apiLogDays: number;
}
```

**Why DTOs for input:**

- Runtime validation with class-validator
- Swagger documentation generation
- Input sanitization and transformation
- Clear API contracts

### Output (Response) Types

**Use shared interfaces from `@scaffold/types` for responses:**

```typescript
// ✅ Good - Return shared interface directly
@Get()
async getSystemHealth(): Promise<SystemHealth> {
  return this.systemHealthService.getCurrentMetrics();
}
```

**Why shared types for output:**

- Type safety between frontend/backend
- No duplication of type definitions
- Frontend gets exactly what it expects
- Less transformation boilerplate

### When to Use Response DTOs

Only create response DTOs when you need to:

- **Hide sensitive data** (passwords, internal IDs)
- **Transform data structure** (aggregations, computed fields)
- **Support API versioning** (different response shapes)
- **Add metadata** (pagination, timestamps)

```typescript
// ✅ When transformation is needed
export class PublicUserDto {
  id: string;
  email: string;
  name: string;
  // password intentionally omitted
}
```

## Pagination Patterns

### Flexible Per-Endpoint Pagination

Each endpoint should choose the most appropriate pagination strategy based on its use case:

#### No Pagination (Small, Bounded Collections)

```typescript
// ✅ Small collections - Return array directly
@Get('roles')
async getRoles(): Promise<Role[]> {
  return this.rolesService.findAll();
}
```

#### Offset-Based Pagination (Admin Tables, Reports)

```typescript
// ✅ Traditional pagination for admin interfaces
@Get('users')
async getUsers(
  @Query() paginationDto: OffsetPaginationDto,
): Promise<PaginatedResponse<User>> {
  return {
    data: users,
    pagination: {
      type: 'offset',
      total: 1000,
      page: 1,
      limit: 20,
      pages: 50
    }
  };
}
```

#### Cursor-Based Pagination (Feeds, Real-time Data)

```typescript
// ✅ Cursor pagination for feeds and large datasets
@Get('activities')
async getActivities(
  @Query() paginationDto: CursorPaginationDto,
): Promise<PaginatedResponse<Activity>> {
  return {
    data: activities,
    pagination: {
      type: 'cursor',
      hasNextPage: true,
      hasPreviousPage: false,
      startCursor: 'abc123',
      endCursor: 'xyz789'
    }
  };
}
```

### Pagination Type Definitions

```typescript
// Base response structure
export interface PaginatedResponse<T> {
  data: T[];
  pagination: OffsetPagination | CursorPagination;
}

// Traditional offset pagination
export interface OffsetPagination {
  type: 'offset';
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Cursor-based pagination
export interface CursorPagination {
  type: 'cursor';
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}
```

### Pagination Input DTOs

```typescript
export class OffsetPaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class CursorPaginationDto {
  @IsOptional()
  @IsString()
  after?: string;

  @IsOptional()
  @IsString()
  before?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  first?: number = 20;
}
```

### Pagination Best Practices

1. **Choose the right pattern:**

   - **Offset pagination** for admin tables, reports, or when users need to jump to specific pages
   - **Cursor pagination** for feeds, activity streams, or real-time data where consistency matters
   - **No pagination** for small, bounded collections (< 100 items)

2. **Always validate limits:**

   - Set reasonable defaults (20-50 items)
   - Enforce maximum limits (100 items max)
   - Provide clear error messages for invalid ranges

3. **Include metadata:**

   - Total counts for offset pagination
   - Next/previous indicators for cursor pagination
   - Clear pagination type discrimination

4. **Performance considerations:**
   - Use database indexes for cursor fields
   - Avoid `COUNT(*)` queries for large datasets in cursor pagination
   - Consider caching for frequently accessed pages

## Database Patterns

### Query Optimization

**Always use proper select projections:**

```typescript
// ✅ Good - Only select needed fields
const users = await this.prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
    // Don't select password or other sensitive fields
  },
});
```

**Avoid N+1 queries:**

```typescript
// ❌ Bad - N+1 query
for (const user of users) {
  user.posts = await this.prisma.post.findMany({ where: { userId: user.id } });
}

// ✅ Good - Single query with include
const users = await this.prisma.user.findMany({
  include: {
    posts: true,
  },
});
```

**Implement pagination efficiently:**

```typescript
// ✅ Good - Efficient offset pagination
async getUsers(page: number, limit: number): Promise<PaginatedResponse<User>> {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    this.prisma.user.findMany({
      skip,
      take: limit,
      select: { id: true, email: true, name: true }
    }),
    this.prisma.user.count(),
  ]);

  return {
    data: users,
    pagination: {
      type: 'offset',
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

// ✅ Good - Efficient cursor pagination
async getActivitiesCursor(after?: string, limit: number = 20): Promise<PaginatedResponse<Activity>> {
  const activities = await this.prisma.activity.findMany({
    take: limit + 1, // Take one extra to check hasNextPage
    ...(after && {
      cursor: { id: after },
      skip: 1, // Skip the cursor item
    }),
    orderBy: { createdAt: 'desc' },
  });

  const hasNextPage = activities.length > limit;
  const data = hasNextPage ? activities.slice(0, -1) : activities;

  return {
    data,
    pagination: {
      type: 'cursor',
      hasNextPage,
      hasPreviousPage: !!after,
      startCursor: data[0]?.id,
      endCursor: data[data.length - 1]?.id,
    },
  };
}
```

## Error Handling

### Use Standard HTTP Status Codes

```typescript
// ✅ Good - Proper error handling
@Get(':id')
async getUser(@Param('id') id: string): Promise<User> {
  const user = await this.usersService.findById(id);
  if (!user) {
    throw new NotFoundException(`User with ID ${id} not found`);
  }
  return user;
}
```

### Let Global Exception Filter Handle Formatting

Don't manually format errors - our global exception filter handles standardization:

```typescript
// ❌ Bad - Manual error formatting
return {
  success: false,
  error: 'User not found',
  code: 404,
};

// ✅ Good - Throw proper exception
throw new NotFoundException('User not found');
```

## Documentation Standards

### Swagger Documentation

**Every endpoint needs complete documentation:**

```typescript
@Get()
@ApiOperation({ summary: 'Get system health status' })
@ApiResponse({
  status: 200,
  description: 'System health retrieved successfully',
  type: SystemHealth, // Use your shared type
})
@ApiResponse({
  status: 503,
  description: 'Service unavailable',
})
async getSystemHealth(): Promise<SystemHealth> {
  return this.healthService.getHealth();
}
```

### Parameter Documentation

```typescript
@Get(':id')
@ApiParam({ name: 'id', description: 'User ID', type: 'string' })
async getUser(@Param('id') id: string): Promise<User> {
  // implementation
}
```

## Controller Structure

### Standard Controller Pattern

```typescript
@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  async getUsers(
    @Query() filterDto: UserFilterDto, // DTO for input validation
  ): Promise<PaginatedResponse<User>> {
    // Shared type for response
    return this.usersService.findAll(filterDto);
  }

  @Post()
  @ApiOperation({ summary: 'Create user' })
  async createUser(
    @Body() createUserDto: CreateUserDto, // DTO for input validation
  ): Promise<User> {
    // Shared type for response
    return this.usersService.create(createUserDto);
  }
}
```

## File Organization

### DTO Structure

```
src/
├── users/
│   ├── dto/
│   │   ├── create-user.dto.ts      # Input DTOs only
│   │   ├── update-user.dto.ts
│   │   ├── user-filter.dto.ts
│   │   └── pagination.dto.ts       # Pagination DTOs
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
```

### Shared Types

All response types live in `packages/types/src/`:

```
packages/types/src/
├── api/
│   ├── pagination.types.ts    # Pagination interfaces
│   └── responses.types.ts     # API response interfaces
├── admin/
│   ├── users.types.ts         # Admin user interfaces
│   └── system.types.ts        # System interfaces
├── user.types.ts              # User-related interfaces
├── system.types.ts            # System health, config interfaces
└── index.ts                   # Export all types
```

## Migration Strategy

When updating existing controllers:

1. **Add input DTOs** where missing (especially for POST/PUT/PATCH)
2. **Choose appropriate pagination strategy** based on use case
3. **Update return types** to use shared interfaces
4. **Add proper Swagger documentation**
5. **Fix any N+1 queries or missing projections**
6. **Remove unnecessary response DTOs** that just mirror shared types

## Examples

### ✅ Good Controller (Config Controller)

- Uses input DTOs with validation
- Returns shared types directly
- Proper error handling
- Complete Swagger docs

### ✅ Good Pagination Implementation

- Chooses appropriate pagination type for use case
- Efficient database queries
- Proper input validation
- Clear response structure

### ❌ Anti-patterns to Avoid

- Response DTOs that just mirror shared types
- Manual error response formatting
- N+1 database queries
- Missing input validation
- Inconsistent pagination approaches
- Using offset pagination for large, frequently changing datasets
- Using cursor pagination for admin tables that need page jumping

---

## Next Steps

As we update controllers, we should:

1. Follow these patterns consistently
2. Choose the most appropriate pagination strategy per endpoint
3. Update this document when we discover better approaches
4. Add examples of complex scenarios as we encounter them
5. Consider tooling/linting rules to enforce these patterns
