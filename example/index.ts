import { Elysia, t } from 'elysia'
import { openapi, withHeaders } from '../src/index'

const schema = t.Object({
	test: t.Literal('hello')
})

const schema2 = t.Object({
	test: t.Literal('world')
})

const user = t.Object({
	name: t.String({
		example: 'saltyaom'
	})
})

export const app = new Elysia()
	.use(
		openapi({
			provider: 'scalar',
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
	.model({ schema, schema2, user })
	.get(
		'/',
		{ test: 'hello' as const },
		{
			response: {
				200: t.Object({
					test: t.Literal('hello')
				}),
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
		({ body }) => ({
			test: 'world'
		}),
		{
			parse: ['json', 'formdata'],
			body: 'user',
			response: {
				200: 'schema',
				400: 'schema2'
			}
		}
	)
	.get('/id/:id/name/:name', () => {})
	.listen(3000)
