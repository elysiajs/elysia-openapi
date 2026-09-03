import { Elysia, t, SSEPayload } from 'elysia'
import { openapi, withHeaders } from '../src/index'
import { fromTypes } from '../src/gen'
import z from 'zod'

export const app = new Elysia()
	.use(
		openapi({
			mapJsonSchema: {
				zod: z.toJSONSchema
			},
			references: fromTypes('example/gen.ts')
		})
	)
	.get(
		'/const',
		() =>
			({
				name: 'Lilith',
				friends: ['Sartre', 'Fouco']
			}) as const
	)
	.get(
		'/',
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
		},
		() =>
			({ test: 'hello' as const }) as any as { test: 'hello' } | undefined
	)
	.post(
		'/json',
		{
			body: t.Object({
				hello: t.String()
			})
		},
		({ body, status }) => (Math.random() > 0.5 ? status(418) : body)
	)
	.get('/id/:id/name/:name', ({ params }) => params)
	.model({
		'character.name': t.String(),
		'character.thing': t.Object({
			name: t.String()
		})
	})
	.post(
		'/character',
		{
			body: 'character.name',
			response: z.object({
				name: z.literal('Lilith')
			})
		},
		() => ({
			name: 'Lilith' as const
		})
	)
	.get('/no-manual', () => ({
		name: 'lilith'
	}))
	.get('/cast-type', () => {
		return { ok: true } as any as SSEPayload
	})
	.listen(3001)
