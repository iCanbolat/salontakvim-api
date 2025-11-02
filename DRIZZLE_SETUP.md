# Drizzle ORM Setup

This project uses Drizzle ORM with PostgreSQL.

## Available Scripts

- `pnpm db:generate` - Generate migrations from schema changes
- `pnpm db:migrate` - Apply migrations to the database
- `pnpm db:push` - Push schema changes directly to database (for development)
- `pnpm db:studio` - Open Drizzle Studio (database GUI)

## Project Structure

```
src/
  db/
    schema.ts         - Database schema definitions
    db.ts            - Database connection (standalone)
    drizzle.module.ts - NestJS module for DI
    users.service.ts  - Example service using Drizzle
```

## Usage

### 1. Define Your Schema

Edit `src/db/schema.ts` to define your tables:

```typescript
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 2. Generate and Apply Migrations

```bash
# Generate migration files
pnpm db:generate

# Apply migrations to database
pnpm db:migrate
```

For development, you can use `pnpm db:push` to push schema changes directly without migrations.

### 3. Use in Services

Inject the Drizzle instance into your services:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_ORM } from './db/drizzle.module';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

@Injectable()
export class MyService {
  constructor(
    @Inject(DRIZZLE_ORM)
    private db: PostgresJsDatabase<typeof import('./db/schema')>,
  ) {}

  async getUsers() {
    return await this.db.select().from(users);
  }

  async getUserById(id: number) {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
}
```

## Environment Variables

Make sure your `.env` file has the correct database credentials:

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=123
POSTGRES_DB=salontakvim
DATABASE_URL=postgresql://postgres:123@localhost:5432/salontakvim
```

## Example: Users Service

See `src/db/users.service.ts` for a complete example of CRUD operations with Drizzle ORM.

## Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle with PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
- [Drizzle Kit Documentation](https://orm.drizzle.team/kit-docs/overview)
