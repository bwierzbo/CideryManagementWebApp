import 'dotenv/config'
import type { Config } from 'drizzle-kit'

export default {
  schema: ['./src/schema.ts', './src/schema/packaging.ts', './src/schema/audit.ts'],
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/cidery_management'
  },
  verbose: true,
  strict: false,
} satisfies Config