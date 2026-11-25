import { Elysia, t } from 'elysia'
import { websocket } from 'elysia/websocket'
import type { AnyElysia } from 'elysia/base'
import SwaggerParser from '@apidevtools/swagger-parser'
import { openapi } from '../src'

import { describe, expect, it } from 'bun:test'

const get = async (app: AnyElysia, path: string) => {
	await app.modules

	return app.handle(new Request(`http://localhost${path}`))
}

const json = (app: AnyElysia, path = '/openapi/asyncapi/json') =>
	get(app, path).then((x) => x.json())

const scalarConfig = async (app: AnyElysia, path = '/openapi') => {
	const html = await get(app, path).then((x) => x.text())

	return JSON.parse(
		html.match(/data-configuration='([^']+)'/)![1].replaceAll('&quot;', '"')
	)
}

const message = () => {}

describe('AsyncAPI', () => {
	it('keeps WebSocket routes in the OpenAPI document by default', async () => {
		const app = new Elysia()
			.use(websocket())
			.use(openapi())
			.ws('/chat', { message })

		const res = await get(app, '/openapi/asyncapi/json')
		expect(res.status).toBe(404)

		const document = await json(app, '/openapi/json')
		expect(document.paths['/chat'].ws).toBeDefined()

		const config = await scalarConfig(app)
		expect(config.url).toBe('openapi/json')
		expect(config.sources).toBeUndefined()
	})

	it('moves WebSocket routes from the OpenAPI document to the AsyncAPI document', async () => {
		const app = new Elysia()
			.use(websocket())
			.use(openapi({ asyncapi: true }))
			.get('/chat', () => 'hi')
			.ws('/chat', { response: t.Object({ text: t.String() }), message })
			.ws('/ticker', { message })

		const document = await json(app)
		expect(document.asyncapi).toBe('3.0.0')
		expect(document.info).toMatchObject({
			title: 'Elysia Documentation',
			version: '0.0.0'
		})
		expect(document.channels.wsChat).toMatchObject({
			address: '/chat',
			messages: {
				serverMessage: {
					payload: {
						type: 'object',
						properties: { text: { type: 'string' } }
					}
				}
			}
		})
		expect(document.channels.wsTicker.address).toBe('/ticker')

		const rest = await json(app, '/openapi/json')
		expect(Object.keys(rest.paths)).toEqual(['/chat'])
		expect(Object.keys(rest.paths['/chat'])).toEqual(['get'])
		await SwaggerParser.validate(rest)
	})

	it('documents the message of each direction as an operation', async () => {
		const app = new Elysia()
			.use(websocket())
			.use(openapi({ asyncapi: true }))
			.ws('/chat', {
				body: t.Object({ say: t.String() }),
				response: t.Object({ said: t.String() }),
				message
			})

		const { channels, operations } = await json(app)

		expect(
			channels.wsChat.messages.clientMessage.payload.properties
		).toEqual({ say: { type: 'string' } })
		expect(
			channels.wsChat.messages.serverMessage.payload.properties
		).toEqual({ said: { type: 'string' } })
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
			}
		})
	})

	it('documents a route with no response, a text response, or no detail', async () => {
		const app = new Elysia()
			.use(websocket())
			.use(openapi({ asyncapi: true }))
			.ws('/plain', { message })
			.ws('/text', { response: t.String(), message })

		const res = await get(app, '/openapi/asyncapi/json')
		expect(res.status).toBe(200)

		const { channels, operations } = await res.json()

		expect(channels.wsPlain).toEqual({
			address: '/plain',
			messages: {},
			parameters: {}
		})
		expect(operations.wsPlainReceive).toEqual({
			action: 'receive',
			summary: 'Message from the client',
			channel: { $ref: '#/channels/wsPlain' }
		})
		expect(channels.wsText.messages).toEqual({
			serverMessage: { payload: { type: 'string' } }
		})
		expect(Object.keys(operations)).toEqual([
			'wsPlainReceive',
			'wsTextSend'
		])
	})

	it('turns path parameters into channel parameters', async () => {
		const app = new Elysia()
			.use(websocket())
			.use(openapi({ asyncapi: true }))
			.ws('/room/:id', { message })
			.ws('/user/:name/:tab?', {
				params: t.Object({
					name: t.String({ description: 'Name of the user' }),
					tab: t.Optional(t.String())
				}),
				message
			})

		const { channels } = await json(app)

		expect(channels.wsRoomById).toMatchObject({
			address: '/room/{id}',
			parameters: { id: {} }
		})
		expect(channels.wsUserByNameByTab).toMatchObject({
			address: '/user/{name}/{tab}',
			parameters: { name: { description: 'Name of the user' }, tab: {} }
		})
		expect(channels.wsUserByName).toMatchObject({
			address: '/user/{name}',
			parameters: { name: { description: 'Name of the user' } }
		})
		expect(Object.keys(channels.wsUserByName.parameters)).toEqual(['name'])
	})

	it('documents query and headers as WebSocket bindings', async () => {
		const app = new Elysia()
			.use(websocket())
			.use(openapi({ asyncapi: true }))
			.ws('/chat', {
				query: t.Object({
					token: t.String(),
					since: t.Optional(t.String())
				}),
				headers: t.Object({ 'x-client': t.String() }),
				message
			})

		const { channels } = await json(app)

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

	it('adds the models that a message references to components', async () => {
		const app = new Elysia()
			.use(websocket())
			.use(openapi({ asyncapi: true }))
			.model({
				Author: t.Object({ name: t.String() }),
				Message: t.Object({ author: t.Ref('Author') }),
				Unused: t.Object({ id: t.String() })
			})
			.get('/unused', { response: 'Unused' }, () => ({ id: '1' }))
			.ws('/chat', { response: 'Message', message })

		const { channels, components } = await json(app)

		expect(channels.wsChat.messages.serverMessage.payload).toEqual({
			$ref: '#/components/schemas/Message'
		})
		expect(Object.keys(components.schemas)).toEqual(['Message', 'Author'])
		expect(components.schemas.Message.properties.author.$ref).toBe(
			'#/components/schemas/Author'
		)
	})

	it('keeps each route when operation ids collide', async () => {
		const app = new Elysia()
			.use(websocket())
			.use(openapi({ asyncapi: true }))
			.ws('/a-b', { response: t.String(), message })
			.ws('/A-b', { response: t.String(), message })
			.ws('/c', { detail: { operationId: 'my/chat' }, message })
			.ws('/d', { detail: { operationId: 'my/chat' }, message })

		const { channels, operations } = await json(app)

		expect(
			Object.entries(channels).map(([id, channel]: any) => [
				id,
				channel.address
			])
		).toEqual([
			['wsA-b', '/a-b'],
			['wsA-b2', '/A-b'],
			['my_chat', '/c'],
			['my_chat2', '/d']
		])
		expect(operations['wsA-b2Send']).toMatchObject({
			channel: { $ref: '#/channels/wsA-b2' },
			messages: [{ $ref: '#/channels/wsA-b2/messages/serverMessage' }]
		})
	})

	it('converts each server URL', async () => {
		const serversOf = (servers?: { url: string; description?: string }[]) =>
			json(
				new Elysia()
					.use(websocket())
					.use(
						openapi({ asyncapi: true, documentation: { servers } })
					)
					.ws('/chat', { message })
			).then((x) => x.servers)

		expect(await serversOf()).toEqual({})
		expect(
			await serversOf([
				{ url: 'https://api.example.com:8443/v1', description: 'Live' },
				{ url: 'http://localhost:3000' },
				{ url: 'https://example.com/' },
				{ url: '/relative' },
				{ url: 'wss://{region}.example.com' }
			])
		).toEqual({
			server1: {
				host: 'api.example.com:8443',
				protocol: 'wss',
				pathname: '/v1',
				description: 'Live'
			},
			server2: { host: 'localhost:3000', protocol: 'ws' },
			server3: { host: 'example.com', protocol: 'wss' },
			server5: { host: '{region}.example.com', protocol: 'wss' }
		})
	})

	it('follows documentation, tags and security', async () => {
		const app = new Elysia()
			.use(websocket())
			.use(
				openapi({
					asyncapi: true,
					documentation: {
						info: {
							title: 'Chat',
							version: '1.0.0',
							summary: 'OpenAPI only',
							license: { name: 'MIT', identifier: 'MIT' }
						},
						tags: [{ name: 'chat', description: 'Chat rooms' }],
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
			)
			.ws('/chat', {
				detail: {
					summary: 'Chat',
					description: 'Talk to the room',
					tags: ['chat']
				},
				message
			})
			.ws('/admin', {
				detail: { security: [{ bearer: [] }, { unknown: [] }] },
				message
			})

		const { info, channels, operations, components } = await json(app)

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

	it('follows hide and exclude', async () => {
		const app = new Elysia()
			.use(websocket())
			.use(
				openapi({
					asyncapi: true,
					documentation: {
						tags: [{ name: 'internal' }, { name: 'chat' }]
					},
					exclude: { paths: ['/excluded'], tags: ['internal'] }
				})
			)
			.ws('/shown', { detail: { tags: ['chat'] }, message })
			.ws('/hidden', { detail: { hide: true }, message })
			.ws('/excluded', { message })
			.ws('/internal', { detail: { tags: ['internal'] }, message })

		const document = await json(app)

		expect(Object.keys(document.channels)).toEqual(['wsShown'])
		expect(document.info.tags).toEqual([{ name: 'chat' }])

		const noWebSocket = new Elysia()
			.use(websocket())
			.use(openapi({ asyncapi: true, exclude: { methods: ['WS'] } }))
			.ws('/chat', { message })

		expect((await json(noWebSocket)).channels).toEqual({})
	})

	it('shows both documents in Scalar, OpenAPI first', async () => {
		for (const [path, page, sources] of [
			['/openapi', '/openapi', ['openapi/json', 'openapi/asyncapi/json']],
			['/openapi', '/openapi/', ['json', 'asyncapi/json']],
			['/docs/', '/docs', ['docs/json', 'docs/asyncapi/json']],
			['/docs/', '/docs/', ['json', 'asyncapi/json']]
		] as const) {
			const app = new Elysia()
				.use(websocket())
				.use(openapi({ asyncapi: true, path }))
				.ws('/chat', { message })

			const config = await scalarConfig(app, page)

			expect(config.url).toBeUndefined()
			expect(config.sources).toEqual([
				{ title: 'HTTP', url: sources[0] },
				{ title: 'WebSocket', url: sources[1] }
			])

			for (const { url } of config.sources) {
				const { pathname } = new URL(url, `http://localhost${page}`)
				expect((await get(app, pathname)).status).toBe(200)
			}
		}
	})

	it('keeps the Scalar documents that the user sets', async () => {
		const configOf = (scalar: object) =>
			scalarConfig(
				new Elysia()
					.use(websocket())
					.use(openapi({ asyncapi: true, scalar }))
					.ws('/chat', { message })
			)

		const withUrl = await configOf({ url: '/my.json' })
		expect(withUrl.url).toBe('/my.json')
		expect(withUrl.sources).toBeUndefined()

		const withSources = await configOf({ sources: [{ url: '/my.json' }] })
		expect(withSources.url).toBeUndefined()
		expect(withSources.sources).toEqual([{ url: '/my.json' }])
	})

	it('shows the OpenAPI document only in Swagger UI', async () => {
		const app = new Elysia()
			.use(websocket())
			.use(openapi({ asyncapi: true, provider: 'swagger-ui' }))
			.ws('/chat', { message })

		const html = await get(app, '/openapi').then((x) => x.text())
		expect(html).toContain('"url":"openapi/json"')
		expect(html).not.toContain('asyncapi')

		expect((await json(app)).channels.wsChat).toBeDefined()
		expect((await json(app, '/openapi/json')).paths).toEqual({})
	})
})
