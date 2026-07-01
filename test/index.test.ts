import { Elysia, t } from 'elysia'
import SwaggerParser from '@apidevtools/swagger-parser'
import { openapi } from '../src'

import { describe, expect, it } from 'bun:test'
import { fail } from 'assert'

const req = (path: string) => new Request(`http://localhost${path}`)

describe('OpenAPI', () => {
	it('show OpenAPI page', async () => {
		const app = new Elysia().use(openapi())

		await app.modules

		const res = await app.handle(req('/openapi'))
		expect(res.status).toBe(200)
	})

	it('show OpenAPI page more than once', async () => {
		const app = new Elysia().use(openapi())

		await app.modules

		const first = await app.handle(req('/openapi'))
		expect(first.status).toBe(200)
		expect(await first.text()).toContain('api-reference')

		const second = await app.handle(req('/openapi'))
		expect(second.status).toBe(200)
		expect(await second.text()).toContain('api-reference')
	})

	it('returns a valid OpenAPI json config', async () => {
		const app = new Elysia().use(openapi())

		await app.modules

		const res = await app.handle(req('/openapi/json')).then((x) => x.json())
		expect(res.openapi).toBe('3.1.2')
		await SwaggerParser.validate(res).catch((err) => fail(err))
	})

	it('emits OpenAPI 3.0.x when configured', async () => {
		const app = new Elysia().use(
			openapi({
				openapiVersion: '3.0.1'
			})
		)

		await app.modules

		const res = await app.handle(req('/openapi/json')).then((x) => x.json())
		expect(res.openapi).toBe('3.0.1')
		await SwaggerParser.validate(res).catch((err) => fail(err))
	})

	it('emits OpenAPI 3.1.x when configured', async () => {
		const app = new Elysia().use(
			openapi({
				openapiVersion: '3.1.1'
			})
		)

		await app.modules

		const res = await app.handle(req('/openapi/json')).then((x) => x.json())
		expect(res.openapi).toBe('3.1.1')
		await SwaggerParser.validate(res).catch((err) => fail(err))
	})

	it('passes through jsonSchemaDialect for OpenAPI 3.1', async () => {
		const app = new Elysia().use(
			openapi({
				openapiVersion: '3.1.2',
				documentation: {
					jsonSchemaDialect:
						'https://json-schema.org/draft/2020-12/schema'
				}
			})
		)

		await app.modules

		const res = await app.handle(req('/openapi/json')).then((x) => x.json())
		expect(res.openapi).toBe('3.1.2')
		expect(res.jsonSchemaDialect).toBe(
			'https://json-schema.org/draft/2020-12/schema'
		)
		await SwaggerParser.validate(res).catch((err) => fail(err))
	})

	it('supports OpenAPI 3.1 with swagger-ui provider', async () => {
		const app = new Elysia().use(
			openapi({
				openapiVersion: '3.1.2',
				provider: 'swagger-ui'
			})
		)

		await app.modules

		const page = await app.handle(req('/openapi'))
		expect(page.status).toBe(200)

		const res = await app.handle(req('/openapi/json')).then((x) => x.json())
		expect(res.openapi).toBe('3.1.2')
		await SwaggerParser.validate(res).catch((err) => fail(err))
	})

	it('embeds OpenAPI 3.1 spec in scalar provider when embedSpec is enabled', async () => {
		const app = new Elysia().use(
			openapi({
				openapiVersion: '3.1.2',
				provider: 'scalar',
				embedSpec: true
			})
		)

		await app.modules

		const html = await app.handle(req('/openapi')).then((x) => x.text())

		const configurationMatch = html.match(/data-configuration='([^']+)'/)
		expect(configurationMatch).not.toBeNull()

		const configuration = JSON.parse(configurationMatch![1])
		expect(configuration.content).toBeString()

		const embeddedSchema = JSON.parse(configuration.content)
		expect(embeddedSchema.openapi).toBe('3.1.2')
	})

	it('does not inject default Scalar CSS when a Scalar theme is configured', async () => {
		const app = new Elysia().use(
			openapi({
				provider: 'scalar',
				scalar: {
					theme: 'moon'
				}
			})
		)

		await app.modules

		const html = await app.handle(req('/openapi')).then((x) => x.text())

		expect(html).toContain('"theme":"moon"')
		expect(html).not.toContain('--scalar-color-accent')
	})

	it('converts nullable union to type-array for OpenAPI 3.1', async () => {
		const app = new Elysia().use(
			openapi({
				openapiVersion: '3.1.2'
			})
		)

		app.get('/nullable', () => 'hello', {
			response: t.Union([t.String(), t.Null()])
		})

		await app.modules

		const res = await app.handle(req('/openapi/json')).then((x) => x.json())

		const response = res.paths['/nullable'].get.responses['200']
		const schema =
			response.content?.['application/json']?.schema ??
			response.content?.['text/plain']?.schema

		expect(schema).toBeDefined()
		expect(schema.type).toEqual(['string', 'null'])
		expect(schema.anyOf).toBeUndefined()
	})

	it('converts nullable union response to nullable:true for OpenAPI 3.0', async () => {
		const app = new Elysia().use(
			openapi({
				openapiVersion: '3.0.3'
			})
		)

		app.get('/nullable-30', () => 'hello', {
			response: t.Union([t.String(), t.Null()])
		})

		await app.modules

		const res = await app.handle(req('/openapi/json')).then((x) => x.json())
		const response = res.paths['/nullable-30'].get.responses['200']
		const schema =
			response.content?.['application/json']?.schema ??
			response.content?.['text/plain']?.schema

		expect(schema).toBeDefined()
		expect(schema.type).toBe('string')
		expect(schema.nullable).toBe(true)
		expect(schema.anyOf).toBeUndefined()
		await SwaggerParser.validate(res).catch((err) => fail(err))
	})

	it('treats null response as nullable schema for OpenAPI 3.0', async () => {
		const app = new Elysia().use(
			openapi({
				openapiVersion: '3.0.3'
			})
		)

		app.get('/null-30', () => null, {
			response: t.Null()
		})

		await app.modules

		const res = await app.handle(req('/openapi/json')).then((x) => x.json())
		const schema =
			res.paths['/null-30'].get.responses['200'].content[
				'application/json'
			].schema

		expect(schema.nullable).toBe(true)
		expect(schema.type).toBeUndefined()
		await SwaggerParser.validate(res).catch((err) => fail(err))
	})

	it('use custom Swagger-UI version', async () => {
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

	it('uses absolute URL for custom absolute specPath', async () => {
		const app = new Elysia().use(
			openapi({
				path: '/api/v1/docs',
				specPath: '/api/v1/openapi.json'
			})
		)

		await app.modules

		const page = await app.handle(req('/api/v1/docs')).then((x) => x.text())
		expect(page).toContain('"url":"/api/v1/openapi.json"')

		const spec = await app.handle(req('/api/v1/openapi.json'))
		expect(spec.status).toBe(200)
	})

	it('keeps relative URL for default specPath pattern', async () => {
		const app = new Elysia().use(
			openapi({
				path: '/api/docs'
			})
		)

		await app.modules

		const page = await app.handle(req('/api/docs')).then((x) => x.text())
		expect(page).toContain('"url":"api/docs/json"')

		const spec = await app.handle(req('/api/docs/json'))
		expect(spec.status).toBe(200)
	})

	it('keeps default spec URLs separate for multiple docs instances', async () => {
		const app = new Elysia()
			.use(openapi({ provider: 'swagger-ui', path: '/docs/v1' }))
			.use(openapi({ provider: 'scalar', path: '/docs/v2' }))

		await app.modules

		const swagger = await app.handle(req('/docs/v1')).then((x) => x.text())
		const scalar = await app.handle(req('/docs/v2')).then((x) => x.text())

		expect(swagger).toContain('"url":"docs/v1/json"')
		expect(scalar).toContain('"url":"docs/v2/json"')
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

	// https://github.com/elysiajs/elysia-openapi/issues/273
  it('should exclude routes with specified tags', async () => {
    const app = new Elysia()
      .use(
        openapi({
          exclude: {
            tags: ['internal']
          }
        })
      )
      .get('/', () => 'index')
      .get('/healthz', () => ({ status: 'ok' }), {
        detail: {
          tags: ['internal']
        }
      })

    await app.modules

		const res = await app.handle(req('/openapi/json'))
		expect(res.status).toBe(200)
		const response = await res.json()

    // Check that only root path is included
    expect(Object.keys(response.paths)).toEqual(['/'])

    // Verify /healthz is excluded
    expect(response.paths['/healthz']).toBeUndefined()

    // Verify root path is included and has GET method
    expect(response.paths['/']).toBeDefined()
    expect(response.paths['/'].get).toBeDefined()
  })
})
