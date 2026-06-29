import { describe, it, expect } from 'bun:test'

import { declarationToJSONSchema, fromTypes } from '../../src/gen'

const serializable = (
	a: Record<string, unknown> | undefined
): Record<string, unknown> | undefined => JSON.parse(JSON.stringify(a))

describe('Gen > Type Gen', () => {
	it('parse declaration to TypeScript', () => {
		const reference = declarationToJSONSchema(`
			{
				hello: {
					world: {
						get: {
							params: {}
							query: {}
							headers: {}
							body: {}
							response: {
								200: {
									name: string
								}
							}
						}
					}
				}
			}`)

		expect(serializable(reference)!).toEqual({
			'/hello/world': {
				get: {
					body: {
						properties: {},
						type: 'object'
					},
					headers: {
						properties: {},
						type: 'object'
					},
					params: {
						properties: {},
						type: 'object'
					},
					query: {
						properties: {},
						type: 'object'
					},
					response: {
						'200': {
							properties: {
								name: {
									type: 'string'
								}
							},
							required: ['name'],
							type: 'object'
						}
					}
				}
			}
		})
	})

	it('parse multiple declaration to TypeScript', () => {
		const reference = declarationToJSONSchema(`
			{
				hello: {
					world: {
						get: {
							params: {}
							query: {}
							headers: {}
							body: {}
							response: {
								200: {
									name: string
								}
							}
						}
					}
				}
				hi: {
					world: {
						get: {
							params: {}
							query: {}
							headers: {}
							body: {}
							response: {
								200: {
									name: string
								}
							}
						}
					}
				}
			}`)

		const property = {
			get: {
				body: {
					properties: {},
					type: 'object'
				},
				headers: {
					properties: {},
					type: 'object'
				},
				params: {
					properties: {},
					type: 'object'
				},
				query: {
					properties: {},
					type: 'object'
				},
				response: {
					'200': {
						properties: {
							name: {
								type: 'string'
							}
						},
						required: ['name'],
						type: 'object'
					}
				}
			}
		}

		expect(serializable(reference)!).toEqual({
			'/hello/world': property,
			'/hi/world': property
		})
	})

	it('parse intersect declaration to TypeScript', () => {
		const reference = declarationToJSONSchema(`
			{
				hello: {
					world: {
						get: {
							params: {}
							query: {}
							headers: {}
							body: {}
							response: {
								200: {
									name: string
								}
							}
						}
					}
				}
			} & {
				hi: {
					world: {
						get: {
							params: {}
							query: {}
							headers: {}
							body: {}
							response: {
								200: {
									name: string
								}
							}
						}
					}
				}
			}`)

		const property = {
			get: {
				body: {
					properties: {},
					type: 'object'
				},
				headers: {
					properties: {},
					type: 'object'
				},
				params: {
					properties: {},
					type: 'object'
				},
				query: {
					properties: {},
					type: 'object'
				},
				response: {
					'200': {
						properties: {
							name: {
								type: 'string'
							}
						},
						required: ['name'],
						type: 'object'
					}
				}
			}
		}

		expect(serializable(reference)!).toEqual({
			'/hello/world': property,
			'/hi/world': property
		})
	})

	it('add quote to special character while parsing declaration to TypeScript', () => {
		const reference = declarationToJSONSchema(`
			{
				"hello-world": {
					2: {
						get: {
							params: {}
							query: {}
							headers: {}
							body: {}
							response: {
								200: {
									name: string
								}
							}
						}
					}
				}
				"ไม่ใช่อังกฤษ": {
					get: {
						params: {}
						query: {}
						headers: {}
						body: {}
						response: {
							200: {
								name: string
							}
							404: {
								message: string
							}
						}
					}
				}
			}`)

		const property = {
			get: {
				body: {
					properties: {},
					type: 'object'
				},
				headers: {
					properties: {},
					type: 'object'
				},
				params: {
					properties: {},
					type: 'object'
				},
				query: {
					properties: {},
					type: 'object'
				},
				response: {
					'200': {
						properties: {
							name: {
								type: 'string'
							}
						},
						required: ['name'],
						type: 'object'
					}
				}
			}
		}

		expect(serializable(reference)!).toEqual({
			'/hello-world/2': {
				get: {
					body: {
						properties: {},
						type: 'object'
					},
					headers: {
						properties: {},
						type: 'object'
					},
					params: {
						properties: {},
						type: 'object'
					},
					query: {
						properties: {},
						type: 'object'
					},
					response: {
						'200': {
							properties: {
								name: {
									type: 'string'
								}
							},
							required: ['name'],
							type: 'object'
						}
					}
				}
			},
			'/ไม่ใช่อังกฤษ': {
				get: {
					body: {
						properties: {},
						type: 'object'
					},
					headers: {
						properties: {},
						type: 'object'
					},
					params: {
						properties: {},
						type: 'object'
					},
					query: {
						properties: {},
						type: 'object'
					},
					response: {
						'200': {
							properties: {
								name: {
									type: 'string'
								}
							},
							required: ['name'],
							type: 'object'
						},
						'404': {
							properties: {
								message: {
									type: 'string'
								}
							},
							required: ['message'],
							type: 'object'
						}
					}
				}
			}
		})
	})

	it('handle readonly property, and readonly array', () => {
		const reference = declarationToJSONSchema(`
				{
					hello: {
						world: {
							get: {
								params: {}
								query: {}
								headers: {}
								body: {}
								response: {
									200: {
										readonly name: "Lilith"
										readonly friends: readonly ["Sartre", "Fouco"]
									}
								}
							}
						}
					}
				}`)

		expect(serializable(reference)!).toEqual({
			'/hello/world': {
				get: {
					body: {
						properties: {},
						type: 'object'
					},
					headers: {
						properties: {},
						type: 'object'
					},
					params: {
						properties: {},
						type: 'object'
					},
					query: {
						properties: {},
						type: 'object'
					},
					response: {
						'200': {
							properties: {
								friends: {
									additionalItems: false,
									items: [
										{
											const: 'Sartre',
											type: 'string'
										},
										{
											const: 'Fouco',
											type: 'string'
										}
									],
									minItems: 2,
									type: 'array'
								},
								name: {
									const: 'Lilith',
									type: 'string'
								}
							},
							required: ['name', 'friends'],
							type: 'object'
						}
					}
				}
			}
		})
	})

	it('integrate', async () => {
		const reference = fromTypes('test/gen/sample.ts')()

		expect(serializable(reference)!).toEqual({
			"/const": {
				"get": {
					"body": {},
					"params": {
						"type": "object",
						"properties": {}
					},
					"query": {},
					"headers": {},
					"response": {
						"200": {
							"type": "object",
							"properties": {
								"name": {
									"const": "Lilith",
									"type": "string"
								},
								"friends": {
									"type": "array",
									"items": [
										{
											"const": "Sartre",
											"type": "string"
										},
										{
											"const": "Fouco",
											"type": "string"
										}
									],
									"additionalItems": false,
									"minItems": 2
								}
							},
							"required": [
								"name",
								"friends"
							]
						}
					}
				}
			},
			"/": {
				"get": {
					"body": {},
					"params": {
						"type": "object",
						"properties": {}
					},
					"query": {},
					"headers": {},
					"response": {
						"204": {
							"type": "void"
						},
						"422": {
							"type": "object",
							"properties": {
								"type": {
									"const": "validation",
									"type": "string"
								},
								"on": {
									"type": "string"
								},
								"message": {
									"type": "string"
								},
								"found": {},
								"property": {
									"type": "string"
								},
								"expected": {
									"type": "string"
								}
							},
							"required": [
								"type",
								"on"
							]
						}
					}
				}
			},
			"/json": {
				"post": {
					"body": {
						"type": "object",
						"properties": {
							"hello": {
								"type": "string"
							}
						},
						"required": [
							"hello"
						]
					},
					"params": {
						"type": "object",
						"properties": {}
					},
					"query": {},
					"headers": {},
					"response": {
						"200": {
							"type": "object",
							"properties": {
								"hello": {
									"type": "string"
								}
							},
							"required": [
								"hello"
							]
						},
						"418": {
							"const": "I'm a teapot",
							"type": "string"
						},
						"422": {
							"type": "object",
							"properties": {
								"type": {
									"const": "validation",
									"type": "string"
								},
								"on": {
									"type": "string"
								},
								"message": {
									"type": "string"
								},
								"found": {},
								"property": {
									"type": "string"
								},
								"expected": {
									"type": "string"
								}
							},
							"required": [
								"type",
								"on"
							]
						}
					}
				}
			},
			"/character": {
				"post": {
					"body": {
						"type": "string"
					},
					"params": {
						"type": "object",
						"properties": {}
					},
					"query": {},
					"headers": {},
					"response": {
						"200": {
							"type": "object",
							"properties": {
								"name": {
									"const": "Lilith",
									"type": "string"
								}
							},
							"required": [
								"name"
							]
						},
						"422": {
							"type": "object",
							"properties": {
								"type": {
									"const": "validation",
									"type": "string"
								},
								"on": {
									"type": "string"
								},
								"message": {
									"type": "string"
								},
								"found": {},
								"property": {
									"type": "string"
								},
								"expected": {
									"type": "string"
								}
							},
							"required": [
								"type",
								"on"
							]
						}
					}
				}
			},
			"/no-manual": {
				"get": {
					"body": {},
					"params": {
						"type": "object",
						"properties": {}
					},
					"query": {},
					"headers": {},
					"response": {
						"200": {
							"type": "object",
							"properties": {
								"name": {
									"type": "string"
								}
							},
							"required": [
								"name"
							]
						}
					}
				}
			}
		})
	})

	it('resolves named type and interface return types', () => {
		const reference = serializable(fromTypes('test/gen/named-types.ts')())!

		const resp = (path: string, method: string) =>
			(reference as any)[path][method].response['200']

		const user = {
			type: 'object',
			properties: {
				id: { type: 'string' },
				name: { type: 'string' },
				profile: {
					type: 'object',
					properties: {
						bio: { type: 'string' },
						age: { type: 'number' }
					},
					required: ['bio', 'age']
				}
			},
			required: ['id', 'name', 'profile']
		}

		// a named `type` alias resolves to its shape (incl. the nested named
		// `Profile`) instead of a dangling `{ $ref: 'User' }`
		expect(resp('/named', 'post')).toEqual(user)
		// the last route in the chain (trailing AddRoute generic) resolves too
		expect(resp('/trailing', 'get')).toEqual(user)
		// array of a named type
		expect(resp('/array', 'get')).toEqual({ type: 'array', items: user })
		// `interface` (with a nested named type) resolves
		expect(resp('/interface', 'get')).toEqual({
			type: 'object',
			properties: { owner: user, active: { type: 'boolean' } },
			required: ['owner', 'active']
		})
		// inline object literals and primitives keep working
		expect(resp('/inline', 'get')).toEqual({
			type: 'object',
			properties: { a: { type: 'string' }, b: { type: 'number' } },
			required: ['a', 'b']
		})
		expect(resp('/primitive', 'get')).toEqual({ type: 'string' })

		// an imported generic type (SSEPayload from elysia) the declaration
		// parser can't see is resolved via the TypeScript checker, with default
		// type arguments
		const sse = resp('/imported', 'get')
		expect(sse.type).toBe('object')
		expect(Object.keys(sse.properties).sort()).toEqual([
			'data',
			'event',
			'id',
			'retry'
		])

		// nothing should be left as an unresolved type reference
		expect(JSON.stringify(reference)).not.toContain('"$ref"')
	})
})
