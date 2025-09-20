import { Elysia, t } from 'elysia'
import { openapi, withHeaders } from '../src/index'
import { fromTypes } from '../src/gen'
import z from 'zod'

export const app = new Elysia()
	.use(
		openapi({
			mapJsonSchema: {
				zod: z.toJSONSchema
			},
			references: fromTypes('example/gen.ts', {
				debug: true
			})
		})
	)
	.model({
		'character.name': t.String(),
		'character.thing': t.Object({
			name: t.String()
		})
	})
	.get(
		'/',
		() =>
			({ test: 'hello' as const }) as any as
				| { test: 'hello' }
				| undefined,
		{
			response: {
				204: withHeaders(
					t.Void({
						title: 'Thing',
						description: 'Void response'
					}),
					{
						'X-Custom-Header': t.Literal('Elysia')
					}
				)
			}
		}
	)
	.post(
		'/json',
		({ body, status }) => (Math.random() > 0.5 ? status(418) : body),
		{
			body: t.Object({
				hello: t.String()
			})
		}
	)
	.get('/id/:id/name/:name', ({ params }) => params)
	.post(
		'/character',
		() => ({
			name: 'Lilith' as const
		}),
		{
			body: 'character.name',
			response: z.object({
				name: z.literal('Lilith')
			})
		}
	)
	.listen(3000)
