# API Design Conventions

## Overview

This document outlines the API design patterns and conventions used throughout the Scaffold application. These patterns prioritize type safety, consistency, and developer experience while minimizing boilerplate.

## Core Principles

1. **Shared Types First** - Use shared TypeScript types between frontend and backend for consistency
2. **DTOs for Input Only** - Use DTOs with validation for incoming data, return raw interfaces for responses
3. **Type Safety Everywhere** - Leverage TypeScript's type system to catch errors at compile time
4. **Consistent Error Handling** - Use standardized error responses across all endpoints
5. **Proper Documentation** - Every endpoint should have complete Swagger documentation

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

**Use pagination for large datasets:**

```typescript
// ✅ Good - Paginated response
async getUsers(page: number, limit: number): Promise<PaginatedResponse<User>> {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    this.prisma.user.findMany({ skip, take: limit }),
    this.prisma.user.count(),
  ]);

  return {
    data: users,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
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
│   │   └── user-filter.dto.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
```

### Shared Types

All response types live in `packages/types/src/`:

```
packages/types/src/
├── api.types.ts          # API response interfaces
├── user.types.ts         # User-related interfaces
├── system.types.ts       # System health, config interfaces
└── index.ts              # Export all types
```

## Migration Strategy

When updating existing controllers:

1. **Add input DTOs** where missing (especially for POST/PUT/PATCH)
2. **Remove response DTOs** that just mirror shared types
3. **Update return types** to use shared interfaces
4. **Add proper Swagger documentation**
5. **Fix any N+1 queries or missing projections**

## Examples

### ✅ Good Controller (Config Controller)

- Uses input DTOs with validation
- Returns shared types directly
- Proper error handling
- Complete Swagger docs

### ✅ Good Service Layer

- Optimized database queries
- Type-safe operations
- Proper error handling
- No business logic in controllers

### ❌ Anti-patterns to Avoid

- Response DTOs that just mirror shared types
- Manual error response formatting
- N+1 database queries
- Missing input validation
- Inconsistent response formats

---

## Next Steps

As we update controllers, we should:

1. Follow these patterns consistently
2. Update this document when we discover better approaches
3. Add examples of complex scenarios as we encounter them
4. Consider tooling/linting rules to enforce these patterns
