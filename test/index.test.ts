import { Elysia, t } from 'elysia'
import SwaggerParser from '@apidevtools/swagger-parser'
import { openapi } from '../src'

import { describe, expect, it } from 'bun:test'
import { fail } from 'assert'

const req = (path: string) => new Request(`http://localhost${path}`)

describe('Swagger', () => {
	it('show Swagger page', async () => {
		const app = new Elysia().use(openapi())

		await app.modules

		const res = await app.handle(req('/openapi'))
		expect(res.status).toBe(200)
	})

	it('returns a valid OpenAPI json config', async () => {
		const app = new Elysia().use(openapi())

		await app.modules

		const res = await app.handle(req('/openapi/json')).then((x) => x.json())
		expect(res.openapi).toBe('3.0.3')
		await SwaggerParser.validate(res).catch((err) => fail(err))
	})

	it('use custom Swagger version', async () => {
		const app = new Elysia().use(
			openapi({
				provider: 'swagger-ui',
				swagger: {
					version: '4.5.0'
				}
			})
		)

		await app.modules

		const res = await app.handle(req('/openapi')).then((x) => x.text())
		expect(
			res.includes(
				'https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-bundle.js'
			)
		).toBe(true)
	})

	it('follow title and description with Swagger-UI provider', async () => {
		const app = new Elysia().use(
			openapi({
				provider: 'swagger-ui',
				swagger: {
					version: '4.5.0'
				},
				documentation: {
					info: {
						title: 'Elysia Documentation',
						description: 'Herrscher of Human',
						version: '1.0.0'
					}
				}
			})
		)

		await app.modules

		const res = await app.handle(req('/openapi')).then((x) => x.text())

		expect(res.includes('<title>Elysia Documentation</title>')).toBe(true)
		expect(
			res.includes(
				`<meta
        name="description"
        content="Herrscher of Human"
    />`
			)
		).toBe(true)
	})

	it('follow title and description with Scalar provider', async () => {
		const app = new Elysia().use(
			openapi({
				provider: 'scalar',
				scalar: {
					version: '4.5.0'
				},
				documentation: {
					info: {
						title: 'Elysia Documentation',
						description: 'Herrscher of Human',
						version: '1.0.0'
					}
				}
			})
		)

		await app.modules

		const res = await app.handle(req('/openapi')).then((x) => x.text())

		expect(res.includes('<title>Elysia Documentation</title>')).toBe(true)
		expect(
			res.includes(
				`<meta
        name="description"
        content="Herrscher of Human"
    />`
			)
		).toBe(true)
	})

	it('use custom path', async () => {
		const app = new Elysia().use(
			openapi({
				path: '/v2/openapi'
			})
		)

		await app.modules

		const res = await app.handle(req('/v2/openapi'))
		expect(res.status).toBe(200)

		const resJson = await app.handle(req('/v2/openapi/json'))
		expect(resJson.status).toBe(200)
	})

	it('Swagger UI options', async () => {
		const app = new Elysia().use(
			openapi({
				provider: 'swagger-ui',
				swagger: {
					persistAuthorization: true
				}
			})
		)

		await app.modules

		const res = await app.handle(req('/openapi')).then((x) => x.text())
		const expected = `"persistAuthorization":true`

		expect(res.trim().includes(expected.trim())).toBe(true)
	})

	it('should not return content response when using Void type', async () => {
		const app = new Elysia().use(openapi()).get('/void', () => {}, {
			response: {
				204: t.Void({
					description: 'Void response'
				})
			}
		})

		await app.modules

		const res = await app.handle(req('/openapi/json'))
		expect(res.status).toBe(200)
		const response = await res.json()
		expect(response.paths['/void'].get.responses['204'].description).toBe(
			'Void response'
		)
		expect(response.paths['/void'].get.responses['204'].content).toEqual({
			description: 'Void response',
			type: 'void'
		})
	})

	it('should not return content response when using Undefined type', async () => {
		const app = new Elysia()
			.use(openapi())
			.get('/undefined', () => undefined, {
				response: {
					204: t.Undefined({
						description: 'Undefined response'
					})
				}
			})

		await app.modules

		const res = await app.handle(req('/openapi/json'))
		expect(res.status).toBe(200)
		const response = await res.json()
		expect(
			response.paths['/undefined'].get.responses['204'].description
		).toBe('Undefined response')
		expect(
			response.paths['/undefined'].get.responses['204'].content
		).toEqual({
			type: 'undefined',
			description: 'Undefined response'
		})
	})

	it('should not return content response when using Null type', async () => {
		const app = new Elysia().use(openapi()).get('/null', () => null, {
			response: {
				204: t.Null({
					description: 'Null response'
				})
			}
		})

		await app.modules

		const res = await app.handle(req('/openapi/json'))
		expect(res.status).toBe(200)
		const response = await res.json()
		expect(response.paths['/null'].get.responses['204'].description).toBe(
			'Null response'
		)
		expect(response.paths['/null'].get.responses['204'].content).toEqual({
			type: 'null',
			description: 'Null response'
		})
	})

	it('should set the required field to true when a request body is present', async () => {
		const app = new Elysia().use(openapi()).post('/post', () => {}, {
			body: t.Object({ name: t.String() })
		})

		await app.modules

		const res = await app.handle(req('/openapi/json'))
		expect(res.status).toBe(200)
		const response = await res.json()
		expect(response.paths['/post'].post.requestBody.required).toBe(true)
	})

	it('resolve optional param to param', async () => {
		const app = new Elysia().use(openapi()).get('/id/:id?', () => {})

		await app.modules

		const res = await app.handle(req('/openapi/json'))
		expect(res.status).toBe(200)
		const response = await res.json()
		expect(response.paths).toContainKey('/id/{id}')
	})

	it('should hide routes with hide = true from paths', async () => {
		const app = new Elysia()
			.use(openapi())
			.get('/public', 'omg')
			.guard({
				detail: {
					hide: true
				}
			})
			.get('/hidden', 'ok')

		await app.modules

		const res = await app.handle(req('/openapi/json'))
		expect(res.status).toBe(200)
		const response = await res.json()
		expect(response.paths['/public']).not.toBeUndefined()
		expect(response.paths['/hidden']).toBeUndefined()
	})

	it('should expand .all routes', async () => {
		const app = new Elysia().use(openapi()).all('/all', 'woah')

		await app.modules

		const res = await app.handle(req('/openapi/json'))
		expect(res.status).toBe(200)
		const response = await res.json()
		expect(Object.keys(response.paths['/all'])).toBeArrayOfSize(8)
	})
})
