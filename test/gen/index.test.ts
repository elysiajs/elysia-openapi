import { describe, it, expect } from 'bun:test'

import {
	declarationToJSONSchema,
	declarationToReference,
	fromTypes
} from '../../src/gen'

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

	it('preserves digits in route names while quoting status codes', () => {
		const reference = serializable(
			declarationToJSONSchema(`{
				api: { v4: { getUser: { post: {
					params: {}
					query: unknown
					headers: unknown
					body: { id: string }
					response: { 200: { name: string } }
				} } } }
			}`)
		) as any

		expect(reference['/api/v4/getUser'].post.response['200']).toEqual({
			type: 'object',
			properties: { name: { type: 'string' } },
			required: ['name']
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

		// console.dir(serializable(reference), {
		// 	depth: null
		// })

		expect(serializable(reference)!).toEqual({
			'/const': {
				get: {
					body: {},
					params: {
						type: 'object',
						properties: {}
					},
					query: {},
					headers: {},
					response: {
						'200': {
							type: 'object',
							required: ['name', 'friends'],
							properties: {
								name: {
									type: 'string',
									const: 'Lilith'
								},
								friends: {
									type: 'array',
									additionalItems: false,
									items: [
										{
											type: 'string',
											const: 'Sartre'
										},
										{
											type: 'string',
											const: 'Fouco'
										}
									],
									minItems: 2
								}
							}
						}
					}
				}
			},
			'/': {
				get: {
					body: {},
					params: {
						type: 'object',
						properties: {}
					},
					query: {},
					headers: {},
					response: {
						'204': {
							type: 'void'
						}
					}
				}
			},
			'/json': {
				post: {
					body: {
						type: 'object',
						required: ['hello'],
						properties: {
							hello: {
								type: 'string'
							}
						}
					},
					params: {
						type: 'object',
						properties: {}
					},
					query: {},
					headers: {},
					response: {
						'200': {
							type: 'object',
							required: ['hello'],
							properties: {
								hello: {
									type: 'string'
								}
							}
						},
						'418': {
							type: 'string',
							const: "I'm a teapot"
						},
						'422': {
							type: 'object',
							required: ['type', 'title', 'status', 'on'],
							properties: {
								type: {
									type: 'string',
									const: 'validation'
								},
								title: {
									type: 'string',
									const: 'Validation Error'
								},
								status: {
									type: 'number',
									const: 422
								},
								detail: {
									type: 'string'
								},
								on: {
									type: 'string'
								},
								found: {},
								property: {
									type: 'string'
								},
								expected: {
									type: 'string'
								}
							}
						}
					}
				}
			},
			'/character': {
				post: {
					body: {
						type: 'string'
					},
					params: {
						type: 'object',
						properties: {}
					},
					query: {},
					headers: {},
					response: {
						'200': {
							type: 'object',
							required: ['name'],
							properties: {
								name: {
									type: 'string',
									const: 'Lilith'
								}
							}
						},
						'422': {
							type: 'object',
							required: ['type', 'title', 'status', 'on'],
							properties: {
								type: {
									type: 'string',
									const: 'validation'
								},
								title: {
									type: 'string',
									const: 'Validation Error'
								},
								status: {
									type: 'number',
									const: 422
								},
								detail: {
									type: 'string'
								},
								on: {
									type: 'string'
								},
								found: {},
								property: {
									type: 'string'
								},
								expected: {
									type: 'string'
								}
							}
						}
					}
				}
			},
			'/no-manual': {
				get: {
					body: {},
					params: {
						type: 'object',
						properties: {}
					},
					query: {},
					headers: {},
					response: {
						'200': {
							type: 'object',
							required: ['name'],
							properties: {
								name: {
									type: 'string'
								}
							}
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

		expect(resp('/named', 'post')).toEqual(user)
		expect(resp('/trailing', 'get')).toEqual(user)
		expect(resp('/array', 'get')).toEqual({ type: 'array', items: user })
		expect(resp('/interface', 'get')).toEqual({
			type: 'object',
			properties: { owner: user, active: { type: 'boolean' } },
			required: ['owner', 'active']
		})
		expect(resp('/inline', 'get')).toEqual({
			type: 'object',
			properties: { a: { type: 'string' }, b: { type: 'number' } },
			required: ['a', 'b']
		})
		expect(resp('/primitive', 'get')).toEqual({ type: 'string' })

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

	// chain ending in `.use()` emits `Elysia<...>` instead of `AddRoute<...>`
	it('reads routes from Elysia 2 generics with imported metadata', () => {
		const declaration = `import { Elysia } from 'elysia';
export declare const app: Elysia<"", "local", {
    decorator: {};
    store: {};
    derive: {};
}, {
    typebox: {};
    error: [];
}, import("elysia/types").DefaultMetadata, {
    dev: {
        login: {
            post: {
                body: unknown;
                params: {};
                query: unknown;
                headers: unknown;
                response: {
                    200: {
                        userId: string;
                    };
                };
                error: never;
            };
        };
    };
} & {
    account: {
        delete: {
            body: unknown;
            params: {};
            query: unknown;
            headers: unknown;
            response: {
                200: {
                    deleted: boolean;
                };
            };
            error: never;
        };
    };
}, import("elysia/types").DefaultEphemeral, {
    derive: {};
    schema: {};
    schemas: {};
    response: {};
    error: [];
}>;
export type App = typeof app;`

		const reference = declarationToReference(declaration)!

		expect(Object.keys(reference)).toEqual(['/dev/login', '/account'])
		expect(reference['/dev/login'].post.response[200]).toEqual({
			type: 'object',
			required: ['userId'],
			properties: { userId: { type: 'string' } }
		})
		expect(reference['/account'].delete.response[200]).toEqual({
			type: 'object',
			required: ['deleted'],
			properties: { deleted: { type: 'boolean' } }
		})
	})
})
