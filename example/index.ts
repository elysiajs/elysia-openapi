import { Elysia, t } from 'elysia'
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
	.macro('fooBar', {
		query: z.object({
			foo: z.optional(z.string())
		}),
		resolve({ query }) {
			return { test: query.foo ? 'foo' : 'bar' }
		}
	})
	.get(
		'/',
		({ test, query }) => {
			const { foo, bar } = query
			return { ok: true, test, foo, bar }
		},
		{
			query: z.object({
				bar: z.optional(z.string())
			}),
			fooBar: true
		}
	)
	.listen(3000, () => {
		console.log('server started')
	})
