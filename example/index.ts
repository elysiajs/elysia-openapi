import { Elysia } from 'elysia'
import { fromTypes, openapi } from '../src'
import * as z from 'zod'

new Elysia()
	.use(
		openapi({
			references: fromTypes(),
			mapJsonSchema: {
				zod: z.toJSONSchema
			}
		})
	)
	.macro({
		fooBar: {
			query: z.object({
				foo: z.optional(z.string())
			}),
			derive({ query }) {
				return { test: query.foo ? 'foo' : 'bar' }
			}
		}
	})
	.get(
		'/',
		{
			query: z.object({
				bar: z.optional(z.string())
			}),
			fooBar: true
		},
		({ test, query }) => {
			const { foo, bar } = query

			return { ok: true, test, foo, bar }
		}
	)
	.listen(3000, () => {
		console.log('server started')
	})
