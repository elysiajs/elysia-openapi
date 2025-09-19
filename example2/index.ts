import { Elysia, redirect } from "elysia"
import openapi from "../src"

import { db } from "./db/db"
import z from "zod/v4"
import { eq } from "drizzle-orm"
import { JSONSchema } from "effect"
import { fromTypes } from "../src/gen"

import path from 'node:path'
import { usersModel, usersTable } from "./db/model"
console.log("tsconfig path:", path.join(import.meta.dir, '../tsconfig.json'))
export const app = new Elysia()
  .use(
    openapi({
      references: fromTypes(
        process.env.NODE_ENV === "production"
          ? "dist/index.d.ts"
          : "example2/index.ts",
        {
          tsconfigPath: path.join(import.meta.dir, '../tsconfig.json')
        }
      ),
      provider: 'scalar',
      mapJsonSchema: {
        zod: z.toJSONSchema,
        effect: JSONSchema.make
      },
      documentation: {
        info: {
          title: 'Elysia Scalar',
          version: '1.3.1a'
        },
        tags: [
          {
            name: 'Test',
            description: 'Hello'
          }
        ],
        components: {
          securitySchemes: {
            bearer: {
              type: 'http',
              scheme: 'bearer'
            },
            cookie: {
              type: 'apiKey',
              in: 'cookie',
              name: 'session_id'
            }
          }
        }
      }
    })
  )
  .model(usersModel)
  .get('/', () => {
    redirect('/openapi')
  })
  .post('/', async ({ body }) => {
    // create user
    return await db.insert(usersTable).values({ id: Math.floor(Math.random() * 10), ...body })
  }, {
    body: 'insertUsersDto'
  })
  .put('/:id', async ({ params: { id }, body }) => {
    return await db.update(usersTable).set(body).where(eq(usersTable.id, id))
  }, {
    params: z.object({
      id: z.coerce.number()
    }),
    body: 'updateUsersDto'
  })
  .get('/list', async () => {
    return await db.select().from(usersTable)
  })
  .listen(4050)


console.log("http://localhost:4050")