import { describe, it, expect } from 'bun:test'
import { Elysia, t } from 'elysia'
import openapi from '../src'

const req = (path: string) => new Request(`http://localhost${path}`)

describe('Guard Schema Flattening', () => {
	it('should include guard() schemas in OpenAPI spec', async () => {
		const app = new Elysia()
			.use(openapi())
			.guard(
				{
					headers: t.Object({
						authorization: t.String()
					})
				},
				(app) =>
					app.post('/users', ({ body }) => body, {
						body: t.Object({
							name: t.String()
						})
					})
			)

		await app.modules

		const res = await app.handle(req('/openapi/json'))
		expect(res.status).toBe(200)

		const spec = await res.json()

		// Check that the /users endpoint exists
		expect(spec.paths['/users']).toBeDefined()
		expect(spec.paths['/users'].post).toBeDefined()

		// Check that the body schema is included
		expect(spec.paths['/users'].post.requestBody).toBeDefined()
		expect(spec.paths['/users'].post.requestBody.content['application/json'].schema).toBeDefined()

		// Check that the guard headers schema is included
		expect(spec.paths['/users'].post.parameters).toBeDefined()
		const authHeader = spec.paths['/users'].post.parameters.find(
			(p: any) => p.in === 'header' && p.name === 'authorization'
		)
		expect(authHeader).toBeDefined()
		expect(authHeader.required).toBe(true)
	})

	it('should merge guard response schemas', async () => {
		const app = new Elysia()
			.use(openapi())
			.model({
				ErrorResponse: t.Object({
					error: t.String()
				})
			})
			.guard(
				{
					response: {
						401: 'ErrorResponse',
						500: 'ErrorResponse'
					}
				},
				(app) =>
					app.get('/data', () => ({ value: 'test' }), {
						response: t.Object({
							value: t.String()
						})
					})
			)

		await app.modules

		const res = await app.handle(req('/openapi/json'))
		expect(res.status).toBe(200)

		const spec = await res.json()

		// Check that the /data endpoint exists
		expect(spec.paths['/data']).toBeDefined()
		expect(spec.paths['/data'].get).toBeDefined()

		// Check that response schemas include both route-level and guard-level schemas
		expect(spec.paths['/data'].get.responses).toBeDefined()
		expect(spec.paths['/data'].get.responses['200']).toBeDefined()
		expect(spec.paths['/data'].get.responses['401']).toBeDefined()
		expect(spec.paths['/data'].get.responses['500']).toBeDefined()
	})
})
