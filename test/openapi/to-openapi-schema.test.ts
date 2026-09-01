import { describe, it, expect } from 'bun:test'
import { AnyElysia, Elysia, t } from 'elysia'

import { toOpenAPISchema } from '../../src/openapi'
import { z } from 'zod'
import { type } from 'arktype'

const is = <T extends AnyElysia>(
	app: T,
	schema: {
		paths: Record<string, any>
		components: Record<string, any>
	}
) => {
	expect(JSON.parse(JSON.stringify(toOpenAPISchema(app)))).toEqual(schema)

	expect(JSON.parse(JSON.stringify(toOpenAPISchema(app)))).not.toEqual({
		...schema,
		paths: {
			...schema.paths,
			'/non-existent-path': {}
		}
	})
}

describe('OpenAPI > toOpenAPISchema', () => {
	it('work', () => {
		const app = new Elysia().get('/user', () => 'hello')

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user': {
					get: {
						operationId: 'getUser'
					}
				}
			}
		})
	})

	it('handle params', () => {
		const app = new Elysia().get('/user/:user', () => 'hello', {
			params: t.Object({
				user: t.Number()
			})
		})

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user/{user}': {
					get: {
						operationId: 'getUserByUser',
						parameters: [
							{
								in: 'path',
								name: 'user',
								required: true,
								schema: {
									type: 'number'
								}
							}
						]
					}
				}
			}
		})
	})

	it('handle headers', () => {
		const app = new Elysia().get('/user', () => 'hello', {
			headers: t.Object({
				'x-user-name': t.Literal('Lilith')
			})
		})

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user': {
					get: {
						operationId: 'getUser',
						parameters: [
							{
								in: 'header',
								name: 'x-user-name',
								required: true,
								schema: {
									type: 'string',
									const: 'Lilith'
								}
							}
						]
					}
				}
			}
		})
	})

	it('handle query', () => {
		const app = new Elysia().get('/user', () => 'hello', {
			query: t.Object({
				name: t.Literal('Lilith')
			})
		})

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user': {
					get: {
						operationId: 'getUser',
						parameters: [
							{
								in: 'query',
								name: 'name',
								required: true,
								schema: {
									type: 'string',
									const: 'Lilith'
								}
							}
						]
					}
				}
			}
		})
	})

	it('handle cookie', () => {
		const app = new Elysia().get('/user', () => 'hello', {
			cookie: t.Object({
				name: t.Literal('Lilith')
			})
		})

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user': {
					get: {
						operationId: 'getUser',
						parameters: [
							{
								in: 'cookie',
								name: 'name',
								required: true,
								schema: {
									type: 'string',
									const: 'Lilith'
								}
							}
						]
					}
				}
			}
		})
	})

	it('handle body', () => {
		const app = new Elysia().post('/user', () => 'hello', {
			body: t.Object({
				name: t.Literal('Lilith')
			})
		})

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user': {
					post: {
						operationId: 'postUser',
						requestBody: {
							content: {
								'application/json': {
									schema: {
										properties: {
											name: {
												const: 'Lilith',
												type: 'string'
											}
										},
										required: ['name'],
										type: 'object'
									}
								},
								'application/x-www-form-urlencoded': {
									schema: {
										properties: {
											name: {
												const: 'Lilith',
												type: 'string'
											}
										},
										required: ['name'],
										type: 'object'
									}
								},
								'multipart/form-data': {
									schema: {
										properties: {
											name: {
												const: 'Lilith',
												type: 'string'
											}
										},
										required: ['name'],
										type: 'object'
									}
								}
							},
							required: true
						}
					}
				}
			}
		})
	})

	it('handle response', () => {
		const app = new Elysia().get(
			'/user',
			() => ({ name: 'Lilith' }) as const,
			{
				response: t.Object({
					name: t.Literal('Lilith')
				})
			}
		)

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user': {
					get: {
						operationId: 'getUser',
						responses: {
							'200': {
								content: {
									'application/json': {
										schema: {
											properties: {
												name: {
													const: 'Lilith',
													type: 'string'
												}
											},
											required: ['name'],
											type: 'object'
										}
									}
								},
								description: 'Response for status 200'
							}
						}
					}
				}
			}
		})
	})

	it('handle multiple response status', () => {
		const app = new Elysia().get(
			'/user',
			() => ({ name: 'Lilith' }) as const,
			{
				response: {
					200: t.Object({
						name: t.Literal('Fouco')
					}),
					404: t.Object({
						name: t.Literal('Lilith')
					})
				}
			}
		)

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user': {
					get: {
						operationId: 'getUser',
						responses: {
							'200': {
								content: {
									'application/json': {
										schema: {
											properties: {
												name: {
													const: 'Fouco',
													type: 'string'
												}
											},
											required: ['name'],
											type: 'object'
										}
									}
								},
								description: 'Response for status 200'
							},
							'404': {
								content: {
									'application/json': {
										schema: {
											properties: {
												name: {
													const: 'Lilith',
													type: 'string'
												}
											},
											required: ['name'],
											type: 'object'
										}
									}
								},
								description: 'Response for status 404'
							}
						}
					}
				}
			}
		})
	})

	it('handle every parameters together', () => {
		const app = new Elysia().post(
			'/id/:id',
			() => ({ name: 'Lilith' }) as const,
			{
				body: t.Object({
					age: t.Number()
				}),
				params: t.Object({
					id: t.Number()
				}),
				query: t.Object({
					name: t.Literal('Lilith')
				}),
				headers: t.Object({
					'x-user-name': t.Literal('Lilith')
				}),
				cookie: t.Object({
					session: t.String()
				}),
				response: {
					200: t.Object({
						name: t.Literal('Fouco')
					}),
					404: t.Object({
						name: t.Literal('Lilith')
					})
				}
			}
		)

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/id/{id}': {
					post: {
						operationId: 'postIdById',
						parameters: [
							{
								in: 'path',
								name: 'id',
								required: true,
								schema: {
									type: 'number'
								}
							},
							{
								in: 'query',
								name: 'name',
								required: true,
								schema: {
									const: 'Lilith',
									type: 'string'
								}
							},
							{
								in: 'header',
								name: 'x-user-name',
								required: true,
								schema: {
									const: 'Lilith',
									type: 'string'
								}
							},
							{
								in: 'cookie',
								name: 'session',
								required: true,
								schema: {
									type: 'string'
								}
							}
						],
						requestBody: {
							content: {
								'application/json': {
									schema: {
										properties: {
											age: {
												type: 'number'
											}
										},
										required: ['age'],
										type: 'object'
									}
								},
								'application/x-www-form-urlencoded': {
									schema: {
										properties: {
											age: {
												type: 'number'
											}
										},
										required: ['age'],
										type: 'object'
									}
								},
								'multipart/form-data': {
									schema: {
										properties: {
											age: {
												type: 'number'
											}
										},
										required: ['age'],
										type: 'object'
									}
								}
							},
							required: true
						},
						responses: {
							'200': {
								content: {
									'application/json': {
										schema: {
											properties: {
												name: {
													const: 'Fouco',
													type: 'string'
												}
											},
											required: ['name'],
											type: 'object'
										}
									}
								},
								description: 'Response for status 200'
							},
							'404': {
								content: {
									'application/json': {
										schema: {
											properties: {
												name: {
													const: 'Lilith',
													type: 'string'
												}
											},
											required: ['name'],
											type: 'object'
										}
									}
								},
								description: 'Response for status 404'
							}
						}
					}
				}
			}
		})
	})

	it('handle params', () => {
		const app = new Elysia().get('/user/:user', () => 'hello', {
			params: t.Object({
				user: t.Number()
			})
		})

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user/{user}': {
					get: {
						operationId: 'getUserByUser',
						parameters: [
							{
								in: 'path',
								name: 'user',
								required: true,
								schema: {
									type: 'number'
								}
							}
						]
					}
				}
			}
		})
	})

	it('inline reference params', () => {
		const model = new Elysia().model(
			'headers',
			t.Object({
				'x-user-name': t.Literal('Lilith')
			})
		)

		const app = new Elysia().use(model).get('/user/:user', () => 'hello', {
			headers: 'headers'
		})

		is(app, {
			components: {
				schemas: {
					headers: {
						$id: '#/components/schemas/headers',
						properties: {
							'x-user-name': {
								const: 'Lilith',
								type: 'string'
							}
						},
						required: ['x-user-name'],
						type: 'object'
					}
				}
			},
			paths: {
				'/user/{user}': {
					get: {
						operationId: 'getUserByUser',
						parameters: [
							{
								in: 'path',
								name: 'user',
								required: true,
								schema: {
									type: 'string'
								}
							},
							{
								in: 'header',
								name: 'x-user-name',
								required: true,
								schema: {
									const: 'Lilith',
									type: 'string'
								}
							}
						]
					}
				}
			}
		})
	})

	it('inline reference query', () => {
		const model = new Elysia().model(
			'query',
			t.Object({
				name: t.Literal('Lilith')
			})
		)

		const app = new Elysia().use(model).get('/user', () => 'hello', {
			query: 'query'
		})

		is(app, {
			components: {
				schemas: {
					query: {
						$id: '#/components/schemas/query',
						properties: {
							name: {
								const: 'Lilith',
								type: 'string'
							}
						},
						required: ['name'],
						type: 'object'
					}
				}
			},
			paths: {
				'/user': {
					get: {
						operationId: 'getUser',
						parameters: [
							{
								in: 'query',
								name: 'name',
								required: true,
								schema: {
									const: 'Lilith',
									type: 'string'
								}
							}
						]
					}
				}
			}
		})
	})

	it('inline reference cookie', () => {
		const model = new Elysia().model(
			'cookie',
			t.Object({
				name: t.Literal('Lilith')
			})
		)

		const app = new Elysia().use(model).get('/user', () => 'hello', {
			cookie: 'cookie'
		})

		is(app, {
			components: {
				schemas: {
					cookie: {
						$id: '#/components/schemas/cookie',
						properties: {
							name: {
								const: 'Lilith',
								type: 'string'
							}
						},
						required: ['name'],
						type: 'object'
					}
				}
			},
			paths: {
				'/user': {
					get: {
						operationId: 'getUser',
						parameters: [
							{
								in: 'cookie',
								name: 'name',
								required: true,
								schema: {
									const: 'Lilith',
									type: 'string'
								}
							}
						]
					}
				}
			}
		})
	})

	it('reference body', () => {
		const model = new Elysia().model(
			'body',
			t.Object({
				name: t.Literal('Lilith')
			})
		)

		const app = new Elysia().use(model).post('/user', () => 'hello', {
			body: 'body'
		})

		is(app, {
			components: {
				schemas: {
					body: {
						$id: '#/components/schemas/body',
						properties: {
							name: {
								const: 'Lilith',
								type: 'string'
							}
						},
						required: ['name'],
						type: 'object'
					}
				}
			},
			paths: {
				'/user': {
					post: {
						operationId: 'postUser',
						requestBody: {
							content: {
								'application/json': {
									schema: {
										$ref: '#/components/schemas/body'
									}
								},
								'application/x-www-form-urlencoded': {
									schema: {
										$ref: '#/components/schemas/body'
									}
								},
								'multipart/form-data': {
									schema: {
										$ref: '#/components/schemas/body'
									}
								}
							},
							required: true
						}
					}
				}
			}
		})
	})

	it('reference response', () => {
		const model = new Elysia().model({
			lilith: t.Object({
				name: t.Literal('Lilith')
			})
		})

		const app = new Elysia().use(model).post(
			'/user',
			() =>
				({
					name: 'Lilith'
				}) as const,
			{
				response: 'lilith'
			}
		)

		is(app, {
			components: {
				schemas: {
					lilith: {
						$id: '#/components/schemas/lilith',
						properties: {
							name: {
								const: 'Lilith',
								type: 'string'
							}
						},
						required: ['name'],
						type: 'object'
					}
				}
			},
			paths: {
				'/user': {
					post: {
						operationId: 'postUser',
						responses: {
							'200': {
								content: {
									'application/json': {
										schema: {
											$ref: '#/components/schemas/lilith'
										}
									}
								},
								description: 'Response for status 200'
							}
						}
					}
				}
			}
		})
	})

	it('reference multiple response', () => {
		const model = new Elysia().model({
			lilith: t.Object({
				name: t.Literal('Lilith')
			}),
			fouco: t.Object({
				name: t.Literal('Fouco')
			})
		})

		const app = new Elysia().use(model).post(
			'/user',
			() =>
				({
					name: 'Lilith'
				}) as const,
			{
				response: {
					200: 'fouco',
					404: 'lilith'
				}
			}
		)

		is(app, {
			components: {
				schemas: {
					lilith: {
						$id: '#/components/schemas/lilith',
						properties: {
							name: {
								const: 'Lilith',
								type: 'string'
							}
						},
						required: ['name'],
						type: 'object'
					},
					fouco: {
						$id: '#/components/schemas/fouco',
						properties: {
							name: {
								const: 'Fouco',
								type: 'string'
							}
						},
						required: ['name'],
						type: 'object'
					}
				}
			},
			paths: {
				'/user': {
					post: {
						operationId: 'postUser',
						responses: {
							'200': {
								content: {
									'application/json': {
										schema: {
											$ref: '#/components/schemas/fouco'
										}
									}
								},
								description: 'Response for status 200'
							},
							'404': {
								content: {
									'application/json': {
										schema: {
											$ref: '#/components/schemas/lilith'
										}
									}
								},
								description: 'Response for status 404'
							}
						}
					}
				}
			}
		})
	})

	it('accept detail', () => {
		const app = new Elysia().get('/user', () => 'hello', {
			detail: {
				summary: 'Get User',
				description: 'Hello User',
				tags: ['User']
			}
		})

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user': {
					get: {
						summary: 'Get User',
						operationId: 'getUser',
						description: 'Hello User',
						tags: ['User']
					}
				}
			}
		})
	})

	it('use custom operationId', () => {
		const app = new Elysia().get('/user', () => 'hello', {
			detail: {
				operationId: 'helloUser'
			}
		})

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user': {
					get: {
						operationId: 'helloUser'
					}
				}
			}
		})
	})

	it('has path parameter without schema argument', () => {
		const app = new Elysia().get('/user/:user/id/:id', () => 'hello')

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user/{user}/id/{id}': {
					get: {
						operationId: 'getUserByUserIdById',
						parameters: [
							{
								in: 'path',
								name: 'user',
								required: true,
								schema: {
									type: 'string'
								}
							},
							{
								in: 'path',
								name: 'id',
								required: true,
								schema: {
									type: 'string'
								}
							}
						]
					}
				}
			}
		})
	})

	it('list all possible path', () => {
		const app = new Elysia().get('/user/:user?/id/:id?', () => 'hello')

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user/id': {
					get: {
						operationId: 'getUserId',
						parameters: [
							{
								in: 'path',
								name: 'user',
								required: true,
								schema: {
									type: 'string'
								}
							},
							{
								in: 'path',
								name: 'id',
								required: true,
								schema: {
									type: 'string'
								}
							}
						]
					}
				},
				'/user/id/{id}': {
					get: {
						operationId: 'getUserIdById',
						parameters: [
							{
								in: 'path',
								name: 'user',
								required: true,
								schema: {
									type: 'string'
								}
							},
							{
								in: 'path',
								name: 'id',
								required: true,
								schema: {
									type: 'string'
								}
							}
						]
					}
				},
				'/user/{user}/id': {
					get: {
						operationId: 'getUserByUserId',
						parameters: [
							{
								in: 'path',
								name: 'user',
								required: true,
								schema: {
									type: 'string'
								}
							},
							{
								in: 'path',
								name: 'id',
								required: true,
								schema: {
									type: 'string'
								}
							}
						]
					}
				},
				'/user/{user}/id/{id}': {
					get: {
						operationId: 'getUserByUserIdById',
						parameters: [
							{
								in: 'path',
								name: 'user',
								required: true,
								schema: {
									type: 'string'
								}
							},
							{
								in: 'path',
								name: 'id',
								required: true,
								schema: {
									type: 'string'
								}
							}
						]
					}
				}
			}
		})
	})

	it('exclude handle body get and head', () => {
		const app = new Elysia()
			.get('/user', () => 'hello', {
				body: t.Object({
					name: t.Literal('Lilith')
				})
			})
			.head('/user', () => 'hello', {
				body: t.Object({
					name: t.Literal('Lilith')
				})
			})

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/user': {
					get: {
						operationId: 'getUser'
					},
					head: {
						operationId: 'headUser'
					}
				}
			}
		})
	})

	it('response accept annotation', () => {
		const model = new Elysia().model({
			lilith: t.Object(
				{
					name: t.Literal('Lilith')
				},
				{
					description: 'Existed'
				}
			)
		})

		const app = new Elysia().use(model).post(
			'/user',
			() =>
				({
					name: 'Lilith'
				}) as const,
			{
				response: {
					200: t.Object(
						{
							name: t.Literal('Fouco')
						},
						{
							description: 'Demon Lord and Rhythm Gamer'
						}
					),
					404: 'lilith'
				}
			}
		)

		is(app, {
			components: {
				schemas: {
					lilith: {
						$id: '#/components/schemas/lilith',
						description: 'Existed',
						properties: {
							name: {
								const: 'Lilith',
								type: 'string'
							}
						},
						required: ['name'],
						type: 'object'
					}
				}
			},
			paths: {
				'/user': {
					post: {
						operationId: 'postUser',
						responses: {
							'200': {
								content: {
									'application/json': {
										schema: {
											description:
												'Demon Lord and Rhythm Gamer',
											properties: {
												name: {
													const: 'Fouco',
													type: 'string'
												}
											},
											required: ['name'],
											type: 'object'
										}
									}
								},
								description: 'Demon Lord and Rhythm Gamer'
							},
							'404': {
								content: {
									'application/json': {
										schema: {
											$ref: '#/components/schemas/lilith'
										}
									}
								},
								description: 'Existed'
							}
						}
					}
				}
			}
		})
	})

	it('body should be text/plain on primitive value', () => {
		const model = new Elysia().model('lilith', t.Literal('Lilith'))

		const app = new Elysia().use(model).post('/user', () => 'hello', {
			body: 'lilith'
		})

		is(app, {
			components: {
				schemas: {
					lilith: {
						$id: '#/components/schemas/lilith',
						const: 'Lilith',
						type: 'string'
					}
				}
			},
			paths: {
				'/user': {
					post: {
						operationId: 'postUser',
						requestBody: {
							content: {
								'text/plain': {
									schema: {
										$ref: '#/components/schemas/lilith'
									}
								}
							},
							required: true
						}
					}
				}
			}
		})
	})

	it('merge multiple standard standalone schema', () => {
		const app = new Elysia()
			.macro('fooBar', {
				query: z.object({
					foo: z.optional(z.string())
				}),
				resolve({ query }) {
					return { test: query.foo ? 'foo' : 'bar' }
				}
			})
			.get(
				'/',
				({ test, query }) => {
					const { foo, bar } = query
					return { ok: true, test, foo, bar }
				},
				{
					query: z.object({
						bar: z.optional(z.string())
					}),
					fooBar: true
				}
			)

		is(app, {
			components: {
				schemas: {}
			},
			paths: {
				'/': {
					get: {
						operationId: 'getIndex',
						parameters: [
							{
								in: 'query',
								name: 'bar',
								required: false,
								schema: {
									type: 'string'
								}
							},
							{
								in: 'query',
								name: 'foo',
								required: false,
								schema: {
									type: 'string'
								}
							}
						]
					}
				}
			}
		})
	})
})

describe('OpenAPI > ArkType', () => {
	// ArkType emits the JSON Schema `$schema` dialect on each converted schema.
	const $schema = 'https://json-schema.org/draft/2020-12/schema'

	// Body schemas are mirrored across every accepted content type.
	const body = (s: Record<string, unknown>) => ({
		content: {
			'application/json': { schema: s },
			'application/x-www-form-urlencoded': { schema: s },
			'multipart/form-data': { schema: s }
		},
		required: true
	})

	const doc = (app: AnyElysia) =>
		JSON.parse(JSON.stringify(toOpenAPISchema(app)))

	// https://github.com/elysiajs/elysia/issues/1844
	it('degrades a predicate (string.date) instead of dropping the schema', () => {
		const app = new Elysia().post('/bug', () => 'ok', {
			body: type({ date: 'string.date' })
		})

		is(app, {
			components: { schemas: {} },
			paths: {
				'/bug': {
					post: {
						operationId: 'postBug',
						requestBody: body({
							$schema,
							type: 'object',
							properties: { date: { type: 'string' } },
							required: ['date']
						})
					}
				}
			}
		})
	})

	it('maps a Date to string/date-time', () => {
		const app = new Elysia().post('/at', () => 'ok', {
			body: type({ at: 'Date' })
		})

		is(app, {
			components: { schemas: {} },
			paths: {
				'/at': {
					post: {
						operationId: 'postAt',
						requestBody: body({
							$schema,
							type: 'object',
							properties: {
								at: { type: 'string', format: 'date-time' }
							},
							required: ['at']
						})
					}
				}
			}
		})
	})

	it('leaves a predicate-free schema unchanged', () => {
		const app = new Elysia().post('/plain', () => 'ok', {
			body: type({ name: 'string', age: 'number' })
		})

		expect(
			doc(app).paths['/plain'].post.requestBody.content[
				'application/json'
			].schema
		).toEqual({
			$schema,
			type: 'object',
			properties: { name: { type: 'string' }, age: { type: 'number' } },
			required: ['age', 'name']
		})
	})

	// Morphs (e.g. `string.date.parse`) previously threw `code: "morph"` and
	// dropped the schema; the `default` fallback degrades them to the base type.
	it('degrades a morph (string.date.parse) instead of dropping the schema', () => {
		const app = new Elysia().post('/morph', () => 'ok', {
			body: type({ when: 'string.date.parse' })
		})

		const op = doc(app).paths['/morph'].post

		expect(op.requestBody).toBeDefined()
		expect(
			op.requestBody.content['application/json'].schema.properties.when
		).toEqual({ type: 'string' })
	})

	it('lets a user-supplied mapJsonSchema.arktype override win', () => {
		const app = new Elysia().post('/override', () => 'ok', {
			body: type({ date: 'string.date' })
		})

		const override = {
			type: 'object',
			properties: { date: { type: 'string', format: 'overridden' } },
			required: ['date']
		}

		const result = JSON.parse(
			JSON.stringify(
				toOpenAPISchema(app, undefined, undefined, {
					arktype: () => override
				})
			)
		)

		expect(
			result.paths['/override'].post.requestBody.content[
				'application/json'
			].schema
		).toEqual(override)
	})
})
