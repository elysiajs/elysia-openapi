import { Elysia, t } from 'elysia'
import { openapi, withHeaders } from '../src/index'
import { fromTypes } from '../src/gen'

export const app = new Elysia()
	.use(
		openapi({
			references: fromTypes('example/gen.ts', {
				debug: true
			})
		})
	)
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
	.listen(3000)
