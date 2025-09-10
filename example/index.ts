import { Elysia, t } from 'elysia'
import z from 'zod'

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
			body: 'schema',
			response: {
				200: 'schema',
				400: z.object({
					a: z.string(),
					b: z.literal('a')
				})
			}
		}
	)
	.post(
		'/json/:id',
		({ body, params: { id }, query: { name, email, birthday } }) => ({
			...body,
			id,
			name,
			email,
			birthday
		}),
		{
			params: t.Object({
				id: t.String()
			}),
			query: t.Object({
				name: t.String(),
				email: t.String({
					description: 'sample email description',
					format: 'email'
				}),
				birthday: t.String({
					description: 'sample birthday description',
					pattern: '\\d{4}-\\d{2}-\\d{2}',
					minLength: 10,
					maxLength: 10
				})
			}),
			body: t.Object({
				username: t.String(),
				password: t.String()
			}),
			response: t.Object(
				{
					username: t.String(),
					password: t.String(),
					id: t.String(),
					name: t.String(),
					email: t.String({
						description: 'sample email description',
						format: 'email'
					}),
					birthday: t.String({
						description: 'sample birthday description',
						pattern: '\\d{4}-\\d{2}-\\d{2}',
						minLength: 10,
						maxLength: 10
					})
				},
				{ description: 'sample description 3' }
			)
		}
	)
	.get('/id/:id/name/:name', () => {})
	.listen(3000)
