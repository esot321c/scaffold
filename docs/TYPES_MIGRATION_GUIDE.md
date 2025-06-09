# Types Migration Guide

## Overview

Reorganizing `@scaffold/types` from flat structure to domain-focused architecture. We're adding new domain-organized types alongside existing ones, then removing old types after they're no longer used.

## Migration Strategy

### Simple 3-Step Process

1. **Add new domain types** alongside existing flat structure
2. **Update controllers/frontend** to use new types as we fix them
3. **Delete old types** when nothing imports them anymore

No "old-types" files, no deprecation warnings, no complex migration - just add new, use new, delete old.

## Domain Structure

```
packages/types/src/
├── auth/
│   ├── session.types.ts
│   ├── oauth.types.ts
│   ├── security.types.ts
│   └── index.ts
├── admin/
│   ├── users.types.ts
│   ├── system.types.ts
│   ├── logs.types.ts
│   ├── notifications.types.ts
│   └── index.ts
├── api/
│   ├── responses.types.ts
│   ├── errors.types.ts
│   └── index.ts
├── user/
│   ├── profile.types.ts
│   ├── activity.types.ts
│   └── index.ts
├── shared/
│   ├── enums.ts
│   ├── config.types.ts
│   └── index.ts
├── existing-types.ts    # Leave exactly as-is
├── other-existing.ts    # Leave exactly as-is
└── index.ts             # Export both old and new
```

## Migration Process

### Per Controller Fix:

1. **Create new domain types** for that controller
2. **Update controller** to import new types
3. **Update frontend** to import new types
4. **Delete old types** when grep shows no usage

### Example - AdminUsersController:

```typescript
// 1. Create packages/types/src/admin/users.types.ts
export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
  sessionCount: number;
}

// 2. Export from packages/types/src/admin/index.ts
export * from './users.types';

// 3. Export from packages/types/src/index.ts
export * from './admin';

// 4. Update controller
import { AdminUser } from '@scaffold/types/admin';
// OR
import { AdminUser } from '@scaffold/types';

// 5. Update frontend
import type { AdminUser } from '@scaffold/types';

// 6. Delete old AdminUsersResponse type when nothing uses it
```

### No Breaking Changes During Migration

The main index.ts exports everything:

```typescript
// packages/types/src/index.ts
export * from './admin';
export * from './auth';
export * from './api';
export * from './user';
export * from './shared';

// Keep existing exports until deleted
export * from './existing-types';
export * from './other-existing';
```

Both old and new imports work during transition:

```typescript
// These both work during migration:
import { AdminUser } from '@scaffold/types'; // New
import { OldResponseType } from '@scaffold/types'; // Old
```

## Cleanup Phase

After all controllers are fixed:

1. `grep -r "OldTypeName" packages/` to find remaining usage
2. Delete unused old type files
3. Remove exports from main index.ts
4. Done.
