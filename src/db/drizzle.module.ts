import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE_ORM = Symbol('DRIZZLE_ORM');

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_ORM,
      useFactory: async () => {
        const connectionString = process.env.DATABASE_URL || '';
        const client = postgres(connectionString);
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DRIZZLE_ORM],
})
export class DrizzleModule {}
