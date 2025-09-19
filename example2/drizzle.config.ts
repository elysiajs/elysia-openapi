import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  out: './drizzle',
  schema: './example2/db/index.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'mydb.sqlite',
  },
});