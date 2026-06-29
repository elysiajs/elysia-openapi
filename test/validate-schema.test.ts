import { Elysia, t } from 'elysia'
import SwaggerParser from '@apidevtools/swagger-parser'
import { openapi } from '../src'

import { it } from 'bun:test'
import { fail } from 'assert'

const req = (path: string) => new Request(`http://localhost${path}`)

it('returns a valid Swagger/OpenAPI json config for many routes', async () => {
	const app = new Elysia()
		.use(openapi())
		.get('/', {
			response: t.String({ description: 'sample description' })
		}, () => 'hi')
		.get('/unpath/:id', {
			response: t.String({ description: 'sample description' })
		}, ({ params: { id } }) => id)
		.get('/unpath/:id/:name/:age', {
				type: 'json',
				response: t.String({ description: 'sample description' }),
				params: t.Object({ id: t.String(), name: t.String() })
			}, ({ params: { id, name } }) => `${id} ${name}`)
		.post('/json/:id', {
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
			}, ({ body, params: { id }, query: { name, email, birthday } }) => ({
				...body,
				id,
				name,
				email,
				birthday
			}))

	await app.modules

	const res = await app.handle(req('/openapi/json')).then((x) => x.json())
	await SwaggerParser.validate(res).catch((err) => fail(err))
})
