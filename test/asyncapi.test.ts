import { Elysia, t } from 'elysia'
import { websocket } from 'elysia/websocket'
import type { AnyElysia } from 'elysia/base'
import SwaggerParser from '@apidevtools/swagger-parser'
import { Parser, DiagnosticSeverity } from '@asyncapi/parser'
import { openapi } from '../src'
import type { ElysiaOpenAPIConfig } from '../src/types'

import { describe, expect, it } from 'bun:test'

const create = (config?: ElysiaOpenAPIConfig<true, string>) =>
	new Elysia().use(websocket()).use(openapi({ asyncapi: true, ...config }))

const get = async (app: AnyElysia, path: string) => {
	await app.modules

	return app.handle(new Request(`http://localhost${path}`))
}

const json = (app: AnyElysia, path: string) =>
	get(app, path).then((x) => x.json())

const parser = new Parser()

const asyncapi = async (app: AnyElysia, path = '/openapi/asyncapi/json') => {
	const document = await json(app, path)
	const { diagnostics } = await parser.parse(JSON.stringify(document))

	expect(
		diagnostics.filter((x) => x.severity === DiagnosticSeverity.Error)
	).toEqual([])

	return document
}

const scalarConfig = async (app: AnyElysia, path = '/openapi') => {
	const html = await get(app, path).then((x) => x.text())
	const match = html.match(/data-configuration='([^']+)'/)

	expect(match).not.toBeNull()

	return JSON.parse(match![1].replaceAll('&quot;', '"'))
}

const message = () => {}

describe('AsyncAPI', () => {
	it('keeps WebSocket routes in the OpenAPI document by default', async () => {
		const app = new Elysia()
			.use(websocket())
			.use(openapi())
			.ws('/chat', { message })

		expect((await get(app, '/openapi/asyncapi/json')).status).toBe(404)

		const document = await json(app, '/openapi/json')
		expect(document.paths['/chat'].ws).toBeDefined()

		const config = await scalarConfig(app)
		expect(config.url).toBe('openapi/json')
		expect(config.sources).toBeUndefined()
	})

	it('moves WebSocket routes from the OpenAPI document to the AsyncAPI document', async () => {
		const app = create()
			.get('/chat', () => 'hi')
			.ws('/chat', { message })
			.ws('/ticker', { message })

		const document = await asyncapi(app)
		expect(Object.keys(document.channels)).toEqual(['wsChat', 'wsTicker'])

		const rest = await json(app, '/openapi/json')
		expect(Object.keys(rest.paths)).toEqual(['/chat'])
		expect(Object.keys(rest.paths['/chat'])).toEqual(['get'])
		await SwaggerParser.validate(rest)
	})

	it('documents the message of each direction as an operation', async () => {
		const app = create()
			.ws('/chat', {
				body: t.Object({ say: t.String() }),
				response: t.Object({ said: t.String() }),
				message
			})
			.ws('/plain', { message })
			.ws('/text', { response: t.String(), message })
			.ws('/in', { body: t.Object({ say: t.String() }), message })

		const { channels, operations } = await asyncapi(app)

		expect(channels.wsChat.messages).toMatchObject({
			clientMessage: { payload: { properties: { say: {} } } },
			serverMessage: { payload: { properties: { said: {} } } }
		})
		expect(channels.wsPlain).toEqual({
			address: '/plain',
			messages: {},
			parameters: {}
		})
		expect(channels.wsText.messages).toEqual({
			serverMessage: { payload: { type: 'string' } }
		})
		expect(Object.keys(channels.wsIn.messages)).toEqual(['clientMessage'])
		expect(operations).toEqual({
			wsChatReceive: {
				action: 'receive',
				summary: 'Message from the client',
				channel: { $ref: '#/channels/wsChat' },
				messages: [{ $ref: '#/channels/wsChat/messages/clientMessage' }]
			},
			wsChatSend: {
				action: 'send',
				summary: 'Message from the server',
				channel: { $ref: '#/channels/wsChat' },
				messages: [{ $ref: '#/channels/wsChat/messages/serverMessage' }]
			},
			wsPlainReceive: {
				action: 'receive',
				summary: 'Message from the client',
				channel: { $ref: '#/channels/wsPlain' }
			},
			wsTextSend: {
				action: 'send',
				summary: 'Message from the server',
				channel: { $ref: '#/channels/wsText' },
				messages: [{ $ref: '#/channels/wsText/messages/serverMessage' }]
			},
			wsInReceive: {
				action: 'receive',
				summary: 'Message from the client',
				channel: { $ref: '#/channels/wsIn' },
				messages: [{ $ref: '#/channels/wsIn/messages/clientMessage' }]
			}
		})
	})

	it('gives the same message schema with OpenAPI 3.0 and 3.1', async () => {
		const payloadOf = async (openapiVersion: string) => {
			const app = create({ openapiVersion }).ws('/chat', {
				response: t.Object({ text: t.Nullable(t.String()) }),
				message
			})

			expect((await json(app, '/openapi/json')).openapi).toBe(
				openapiVersion
			)

			return (await asyncapi(app)).channels.wsChat.messages.serverMessage
				.payload
		}

		const v31 = await payloadOf('3.1.0')

		expect(await payloadOf('3.0.3')).toEqual(v31)
		expect(v31.properties.text.type).toEqual(['string', 'null'])
	})

	it('turns path parameters into channel parameters', async () => {
		const app = create().ws('/user/:name/:tab?', {
			params: t.Object({
				name: t.String({ description: 'Name of the user' }),
				tab: t.Optional(t.String())
			}),
			message
		})

		const { channels } = await asyncapi(app)

		expect(channels.wsUserByNameByTab.address).toBe('/user/{name}/{tab}')
		expect(channels.wsUserByNameByTab.parameters).toEqual({
			name: { description: 'Name of the user' },
			tab: {}
		})
		expect(channels.wsUserByName.address).toBe('/user/{name}')
		expect(channels.wsUserByName.parameters).toEqual({
			name: { description: 'Name of the user' }
		})
	})

	it('documents query and headers as WebSocket bindings', async () => {
		const app = create().ws('/chat', {
			query: t.Object({
				token: t.String(),
				since: t.Optional(t.String())
			}),
			headers: t.Object({ 'x-client': t.String() }),
			message
		})

		const { channels } = await asyncapi(app)

		expect(channels.wsChat.bindings.ws).toEqual({
			query: {
				type: 'object',
				properties: {
					token: { type: 'string' },
					since: { type: 'string' }
				},
				required: ['token']
			},
			headers: {
				type: 'object',
				properties: { 'x-client': { type: 'string' } },
				required: ['x-client']
			}
		})
	})

	it('adds the schemas that a message references to components', async () => {
		const manual = { type: 'object' } as const
		const app = create({
			documentation: { components: { schemas: { Manual: manual } } }
		})
			.model({
				Author: t.Object({ name: t.String() }),
				Message: t.Object({ author: t.Ref('Author') }),
				Unused: t.Object({ id: t.String() })
			})
			.get('/unused', { response: 'Unused' }, () => ({ id: '1' }))
			.ws('/chat', { response: 'Message', message })
			.ws('/manual', {
				response: t.Ref('#/components/schemas/Manual'),
				message
			})

		const { channels, components } = await asyncapi(app)

		expect(channels.wsChat.messages.serverMessage.payload).toEqual({
			$ref: '#/components/schemas/Message'
		})
		expect(Object.keys(components.schemas)).toEqual([
			'Message',
			'Author',
			'Manual'
		])
		expect(components.schemas.Message.properties.author.$ref).toBe(
			'#/components/schemas/Author'
		)
		expect(components.schemas.Manual).toEqual(manual)
	})

	it('keeps each route when operation ids collide', async () => {
		const app = create()
			.ws('/a-b', { response: t.String(), message })
			.ws('/A-b', { response: t.String(), message })
			.ws('/c', { detail: { operationId: 'my/chat' }, message })
			.ws('/d', { detail: { operationId: 'my/chat' }, message })
			.ws('/e', { detail: { operationId: 'toString' }, message })

		const { channels, operations } = await asyncapi(app)

		expect(
			Object.entries(channels).map(([id, channel]: any) => [
				id,
				channel.address
			])
		).toEqual([
			['wsA-b', '/a-b'],
			['wsA-b2', '/A-b'],
			['my_chat', '/c'],
			['my_chat2', '/d'],
			['toString', '/e']
		])
		expect(operations['wsA-b2Send']).toMatchObject({
			channel: { $ref: '#/channels/wsA-b2' },
			messages: [{ $ref: '#/channels/wsA-b2/messages/serverMessage' }]
		})
	})

	it('converts each server URL', async () => {
		const variables = { region: { default: 'eu' } }
		const { servers } = await asyncapi(
			create({
				documentation: {
					servers: [
						{
							url: 'https://api.example.com:8443/v1',
							description: 'Live'
						},
						{ url: 'http://localhost:3000' },
						{ url: 'https://example.com/' },
						{ url: '/relative' },
						{ url: 'wss://{region}.example.com', variables }
					]
				}
			}).ws('/chat', { message })
		)

		expect(servers).toEqual({
			server1: {
				host: 'api.example.com:8443',
				protocol: 'wss',
				pathname: '/v1',
				description: 'Live'
			},
			server2: { host: 'localhost:3000', protocol: 'ws' },
			server3: { host: 'example.com', protocol: 'wss' },
			server5: {
				host: '{region}.example.com',
				protocol: 'wss',
				variables
			}
		})
	})

	it('follows the documentation info and the tags of WebSocket routes', async () => {
		const app = create({
			documentation: {
				info: {
					title: 'Chat',
					version: '1.0.0',
					summary: 'OpenAPI only',
					license: { name: 'MIT', identifier: 'MIT' }
				},
				tags: [
					{ name: 'chat', description: 'Chat rooms' },
					{ name: 'http' }
				]
			}
		})
			.get('/users', { detail: { tags: ['http'] } }, () => 'hi')
			.ws('/chat', {
				detail: {
					summary: 'Chat',
					description: 'Talk to the room',
					tags: ['chat']
				},
				message
			})

		const { info, channels } = await asyncapi(app)

		expect(info).toEqual({
			title: 'Chat',
			description: 'Development documentation',
			version: '1.0.0',
			license: { name: 'MIT' },
			tags: [{ name: 'chat', description: 'Chat rooms' }]
		})
		expect(channels.wsChat).toMatchObject({
			summary: 'Chat',
			description: 'Talk to the room',
			tags: [{ name: 'chat' }]
		})
	})

	it('converts the security schemes and the security of each route', async () => {
		const app = create({
			documentation: {
				security: [{ session: [] }],
				components: {
					securitySchemes: {
						session: {
							type: 'apiKey',
							in: 'cookie',
							name: 'session'
						},
						bearer: { type: 'http', scheme: 'bearer' },
						oauth: {
							type: 'oauth2',
							flows: {
								implicit: {
									authorizationUrl:
										'https://example.com/auth',
									scopes: { read: 'Read messages' }
								}
							}
						}
					}
				}
			}
		})
			.ws('/chat', { message })
			.ws('/admin', {
				detail: { security: [{ bearer: [] }, { unknown: [] }] },
				message
			})

		const { operations, components } = await asyncapi(app)

		expect(operations.wsChatReceive.security).toEqual([
			{ $ref: '#/components/securitySchemes/session' }
		])
		expect(operations.wsAdminReceive.security).toEqual([
			{ $ref: '#/components/securitySchemes/bearer' }
		])
		expect(components.securitySchemes).toEqual({
			session: { type: 'httpApiKey', in: 'cookie', name: 'session' },
			bearer: { type: 'http', scheme: 'bearer' },
			oauth: {
				type: 'oauth2',
				flows: {
					implicit: {
						authorizationUrl: 'https://example.com/auth',
						availableScopes: { read: 'Read messages' }
					}
				}
			}
		})
	})

	it.each(['3.0.3', '3.1.0'])(
		'follows hide and exclude with OpenAPI %s',
		async (openapiVersion) => {
			const app = create({
				openapiVersion,
				exclude: { paths: ['/excluded'], tags: ['internal'] }
			})
				.ws('/shown', { message })
				.ws('/hidden', { detail: { hide: true }, message })
				.ws('/excluded', { message })
				.ws('/internal', { detail: { tags: ['internal'] }, message })

			expect(Object.keys((await asyncapi(app)).channels)).toEqual([
				'wsShown'
			])

			const noWebSocket = create({
				openapiVersion,
				exclude: { methods: ['WS'] }
			}).ws('/chat', { message })

			expect((await asyncapi(noWebSocket)).channels).toEqual({})
		}
	)

	it.each([
		['/openapi', '/openapi', 'openapi/json', 'openapi/asyncapi/json', undefined],
		['/openapi', '/openapi/', 'json', 'asyncapi/json', undefined],
		['/docs/v1', '/docs/v1', 'v1/json', 'v1/asyncapi/json', undefined],
		['/docs/v1', '/docs/v1/', 'json', 'asyncapi/json', undefined],
		['/docs/', '/docs', 'docs/json', 'docs/asyncapi/json', undefined],
		['/docs/', '/docs/', '../spec.json', 'asyncapi/json', 'spec.json']
	])(
		'shows both documents in Scalar, OpenAPI first, at path %s on page %s',
		async (path, page, http, webSocket, specPath) => {
			const app = create({ path, specPath }).ws('/chat', { message })

			const config = await scalarConfig(app, page)

			expect(config.url).toBeUndefined()
			expect(config.sources).toEqual([
				{ title: 'HTTP', url: http },
				{ title: 'WebSocket', url: webSocket }
			])

			const at = (url: string) =>
				new URL(url, `http://localhost${page}`).pathname

			expect((await json(app, at(http))).openapi).toBeDefined()
			expect((await asyncapi(app, at(webSocket))).channels.wsChat).toBeDefined()
		}
	)

	it('keeps the Scalar documents that the user sets', async () => {
		const configOf = (config: ElysiaOpenAPIConfig<true, string>) =>
			scalarConfig(create(config).ws('/chat', { message }))

		const withUrl = await configOf({ scalar: { url: '/my.json' } })
		expect(withUrl.url).toBe('/my.json')
		expect(withUrl.sources).toBeUndefined()

		const sources = [{ url: '/my.json' }]
		const withSources = await configOf({ scalar: { sources } as object })
		expect(withSources.url).toBeUndefined()
		expect(withSources.sources).toEqual(sources)

		const embedded = await configOf({ embedSpec: true })
		expect(embedded.sources).toBeUndefined()
		expect(JSON.parse(embedded.content).paths).toEqual({})
	})

	it('shows the OpenAPI document only in Swagger UI', async () => {
		const app = create({ provider: 'swagger-ui' }).ws('/chat', { message })

		const html = await get(app, '/openapi').then((x) => x.text())
		expect(html).toContain('"url":"openapi/json"')
		expect(html).not.toContain('asyncapi')

		expect((await asyncapi(app)).channels.wsChat).toBeDefined()
		expect((await json(app, '/openapi/json')).paths).toEqual({})
	})
})
