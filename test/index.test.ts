import { Elysia, t } from 'elysia'
import SwaggerParser from '@apidevtools/swagger-parser'
import { validate as validateOpenAPI } from '@scalar/openapi-parser'
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
		expect(res.openapi).toBe('3.1.2')
		await SwaggerParser.validate(res).catch((err) => fail(err))
	})

	it('emits OpenAPI 3.0 nullable schemas when configured', async () => {
		const app = new Elysia()
			.use(openapi({ openapiVersion: '3.0.3' }))
			.get('/nullable', () => null, {
				response: t.Union([t.String(), t.Null()])
			})

		await app.modules

		const document = await app
			.handle(req('/openapi/json'))
			.then((response) => response.json())
		const schema =
			document.paths['/nullable'].get.responses['200'].content[
				'text/plain'
			].schema

		expect(document.openapi).toBe('3.0.3')
		expect(schema).toMatchObject({ type: 'string', nullable: true })
		await SwaggerParser.validate(document).catch((error) => fail(error))
	})

	it('emits and validates OpenAPI 3.2 documents', async () => {
		const app = new Elysia()
			.use(
				openapi({
					openapiVersion: '3.2.0',
					documentation: {
						$self: 'https://example.com/openapi.json',
						paths: {
							'/status': {
								get: {
									responses: {
										'200': { summary: 'Service is healthy' }
									}
								}
							}
						},
						servers: [
							{
								name: 'production',
								url: 'https://api.example.com'
							}
						],
						tags: [
							{
								name: 'books',
								summary: 'Books',
								parent: 'products',
								kind: 'nav'
							}
						],
						components: {
							schemas: {
								Event: {
									type: 'string',
									xml: { nodeType: 'text' }
								},
								FallbackEvent: { type: 'object' },
								EventEnvelope: {
									oneOf: [
										{ $ref: '#/components/schemas/FallbackEvent' }
									],
									discriminator: {
										propertyName: 'eventType',
										defaultMapping:
											'#/components/schemas/FallbackEvent'
									}
								}
							},
							securitySchemes: {
								LegacyKey: {
									type: 'apiKey',
									name: 'x-api-key',
									in: 'header',
									deprecated: true
								},
								DeviceOAuth: {
									type: 'oauth2',
									oauth2MetadataUrl:
										'https://auth.example.com/.well-known/oauth-authorization-server',
									flows: {
										deviceAuthorization: {
											deviceAuthorizationUrl:
												'https://auth.example.com/device',
											tokenUrl: 'https://auth.example.com/token',
											scopes: { read: 'Read books' }
										}
									}
								}
							},
							mediaTypes: {
								EventStream: {
									description: 'Server-sent events',
									itemSchema: {
										type: 'object',
										properties: {
											data: { type: 'string' }
										}
									}
								}
							}
						}
					}
				})
			)
			.route('QUERY', '/books/search', () => ({ found: 0 }), {
				body: t.Object({ filter: t.String() }),
				response: t.Object({ found: t.Number() })
			})
			.route('PROPFIND', '/books', () => 'ok')

		await app.modules

		const document = await app
			.handle(req('/openapi/json'))
			.then((response) => response.json())

		expect(document.openapi).toBe('3.2.0')
		expect(document.$self).toBe('https://example.com/openapi.json')
		expect(document.paths['/books/search'].query.requestBody).toBeDefined()
		expect(
			document.paths['/books'].additionalOperations.PROPFIND.operationId
		).toBe('propfindBooks')
		expect(document.paths['/status'].get.responses['200']).toEqual({
			summary: 'Service is healthy'
		})

		const validation = await validateOpenAPI(document)
		expect(validation.valid).toBe(true)
		expect(validation.errors).toEqual([])
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
