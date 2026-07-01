import { describe, it, expect } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
	declarationToJSONSchema,
	extractGenericParam,
	extractTypeAliases,
	flattenNestedIntersections,
	fromTypes,
	inlineTypeReferences
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
									maxItems: 2,
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
			'/': {
				get: {
					body: {},
					headers: {},
					params: {
						properties: {},
						type: 'object'
					},
					query: {},
					response: {
						'204': {
							type: 'void'
						},
						'422': {
							properties: {
								expected: {
									type: 'string'
								},
								found: {},
								message: {
									type: 'string'
								},
								on: {
									type: 'string'
								},
								property: {
									type: 'string'
								},
								summary: {
									type: 'string'
								},
								type: {
									const: 'validation',
									type: 'string'
								}
							},
							required: ['type', 'on'],
							type: 'object'
						}
					}
				}
			},
			'/character': {
				post: {
					body: {
						type: 'string'
					},
					headers: {},
					params: {
						properties: {},
						type: 'object'
					},
					query: {},
					response: {
						'200': {
							properties: {
								name: {
									const: 'Lilith',
									type: 'string'
								}
							},
							required: ['name'],
							type: 'object'
						},
						'422': {
							properties: {
								expected: {
									type: 'string'
								},
								found: {},
								message: {
									type: 'string'
								},
								on: {
									type: 'string'
								},
								property: {
									type: 'string'
								},
								summary: {
									type: 'string'
								},
								type: {
									const: 'validation',
									type: 'string'
								}
							},
							required: ['type', 'on'],
							type: 'object'
						}
					}
				}
			},
			'/const': {
				get: {
					body: {},
					headers: {},
					params: {
						properties: {},
						type: 'object'
					},
					query: {},
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
									maxItems: 2,
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
			},
			'/json': {
				post: {
					body: {
						properties: {
							hello: {
								type: 'string'
							}
						},
						required: ['hello'],
						type: 'object'
					},
					headers: {},
					params: {
						properties: {},
						type: 'object'
					},
					query: {},
					response: {
						'200': {
							properties: {
								hello: {
									type: 'string'
								}
							},
							required: ['hello'],
							type: 'object'
						},
						'418': {
							const: "I'm a teapot",
							type: 'string'
						},
						'422': {
							properties: {
								expected: {
									type: 'string'
								},
								found: {},
								message: {
									type: 'string'
								},
								on: {
									type: 'string'
								},
								property: {
									type: 'string'
								},
								summary: {
									type: 'string'
								},
								type: {
									const: 'validation',
									type: 'string'
								}
							},
							required: ['type', 'on'],
							type: 'object'
						}
					}
				}
			},
			'/no-manual': {
				get: {
					body: {},
					headers: {},
					params: {
						properties: {},
						type: 'object'
					},
					query: {},
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

	it('handle alphanumeric route keys like v1', () => {
		const reference = declarationToJSONSchema(`
			{
				v1: {
					foo: {
						get: {
							params: {}
							query: {}
							headers: {}
							body: {}
							response: {
								200: {
									value: number
								}
							}
						}
					}
				}
			}`)

		expect(serializable(reference)!).toEqual({
			'/v1/foo': {
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
								value: {
									type: 'number'
								}
							},
							required: ['value'],
							type: 'object'
						}
					}
				}
			}
		})
	})

	it('handle route segments ending with digits', () => {
		const reference = declarationToJSONSchema(`
			{
				encode: {
					base64: {
						get: {
							params: {}
							query: {}
							headers: {}
							body: {}
							response: {
								200: string
							}
						}
					}
				}
			} & {
				hash: {
					sha256: {
						get: {
							params: {}
							query: {}
							headers: {}
							body: {}
							response: {
								200: string
							}
						}
					}
				}
			}`)

		expect(serializable(reference)!).toMatchObject({
			'/encode/base64': {
				get: {
					response: {
						'200': {
							type: 'string'
						}
					}
				}
			},
			'/hash/sha256': {
				get: {
					response: {
						'200': {
							type: 'string'
						}
					}
				}
			}
		})
	})

	it('inline type aliases into body and response schemas', () => {
		const reference = declarationToJSONSchema(
			`
			{
				users: {
					post: {
						params: {}
						query: unknown
						headers: unknown
						body: CreateUserInput
						response: {
							201: User
							400: ErrorResponse
						}
					}
				}
			}`,
			{
				CreateUserInput: '{ name: string; email: string }',
				User: '{ id: string; name: string; email: string }',
				ErrorResponse: '{ message: string; code: number }'
			}
		)

		const route = serializable(reference)!['/users'] as any

		expect(route.post.body).toEqual({
			properties: {
				name: { type: 'string' },
				email: { type: 'string' }
			},
			required: ['name', 'email'],
			type: 'object'
		})
		expect(route.post.response['201']).toEqual({
			properties: {
				id: { type: 'string' },
				name: { type: 'string' },
				email: { type: 'string' }
			},
			required: ['id', 'name', 'email'],
			type: 'object'
		})
		expect(route.post.response['400']).toEqual({
			properties: {
				message: { type: 'string' },
				code: { type: 'number' }
			},
			required: ['message', 'code'],
			type: 'object'
		})
	})

	it('extract generic route parameter without depending on object-shaped prefixes', () => {
		const instance = `declare const app: Elysia<
			"/api/v1",
			any,
			{ decorator: { token: string } },
			{},
			{ users: { get: { response: { 200: User } } } },
			{ metadata: true }
		>`

		expect(extractGenericParam(instance, 4)).toBe(
			'{ users: { get: { response: { 200: User } } } }'
		)
	})

	it('flatten nested route intersections', () => {
		const flattened = flattenNestedIntersections(`
			{
				api: {
					v1: ({
						users: {
							get: {
								params: {}
								query: unknown
								headers: unknown
								body: unknown
								response: { 200: string }
							}
						}
					} & {
							posts: {
								get: {
									params: {}
									query: unknown
									headers: unknown
									body: unknown
									response: { 200: string }
								}
							}
						})
					}
				}
			}`)

		const reference = declarationToJSONSchema(flattened)
		expect(serializable(reference)!).toMatchObject({
			'/api/v1/users': {
				get: {
					response: {
						'200': {
							type: 'string'
						}
					}
				}
			},
			'/api/v1/posts': {
				get: {
					response: {
						'200': {
							type: 'string'
						}
					}
				}
			}
		})
	})

	it('extracts and inlines type aliases from fromTypes declaration files', () => {
		const tmpRoot = mkdtempSync(join(tmpdir(), 'elysia-openapi-'))
		const declarationPath = join(tmpRoot, 'app.d.ts')

		try {
			writeFileSync(
				declarationPath,
				`
				type User = { id: string; name: string }
				export declare const app: Elysia<
					"",
					{},
					{},
					{},
					{
						users: {
							get: {
								params: {}
								query: unknown
								headers: unknown
								body: unknown
								response: {
									200: User
								}
							}
						}
					},
					{},
					{}
				>
				`
			)

			const reference = fromTypes(declarationPath, {
				projectRoot: tmpRoot,
				silent: true
			})()

			expect(
				(serializable(reference)!['/users'] as any).get.response['200']
			).toEqual({
				properties: {
					id: { type: 'string' },
					name: { type: 'string' }
				},
				required: ['id', 'name'],
				type: 'object'
			})
		} finally {
			rmSync(tmpRoot, { recursive: true, force: true })
		}
	})

	it('resolves import type references from fromTypes declaration files', () => {
		const tmpRoot = mkdtempSync(join(tmpdir(), 'elysia-openapi-'))
		const declarationPath = join(tmpRoot, 'app.d.ts')
		const modelPath = join(tmpRoot, 'models.d.ts')

		try {
			writeFileSync(
				modelPath,
				'export type User = { id: string; email: string }'
			)
			writeFileSync(
				declarationPath,
				`
				export declare const app: Elysia<
					"",
					{},
					{},
					{},
					{
						users: {
							get: {
								params: {}
								query: unknown
								headers: unknown
								body: unknown
								response: {
									200: import("./models").User
								}
							}
						}
					},
					{},
					{}
				>
				`
			)

			const reference = fromTypes(declarationPath, {
				projectRoot: tmpRoot,
				silent: true
			})()

			expect(
				(serializable(reference)!['/users'] as any).get.response['200']
			).toEqual({
				properties: {
					id: { type: 'string' },
					email: { type: 'string' }
				},
				required: ['id', 'email'],
				type: 'object'
			})
		} finally {
			rmSync(tmpRoot, { recursive: true, force: true })
		}
	})

	it('keeps unresolved import type references as generated schemas', () => {
		const reference = declarationToJSONSchema(`
			{
				users: {
					get: {
						params: {}
						query: unknown
						headers: unknown
						body: unknown
						response: {
							200: {
								id: string
								updates: import("some/module").Unknown[] | null
							}
						}
					}
				}
			}`)

		const response = (serializable(reference)!['/users'] as any).get
			.response['200']

		expect(response.properties.id).toEqual({
			type: 'string'
		})
		expect(response.properties.updates).toBeDefined()
	})

	it('extract and inline type alias helpers avoid partial replacements', () => {
		const aliases = extractTypeAliases(`
			type User = { id: string }
			type UserProfile = { userId: string }
		`)

		expect(Object.keys(aliases)).toEqual(['User', 'UserProfile'])
		expect(
			inlineTypeReferences('profile: UserProfile; user: User', aliases)
		).toBe('profile: { userId: string }; user: { id: string }')
	})

	it('merge compilerOptions override with declaration defaults', () => {
		const tmpRoot = mkdtempSync(join(tmpdir(), 'elysia-openapi-'))

		try {
			const reference = fromTypes('test/gen/sample.ts', {
				tmpRoot,
				debug: true,
				silent: true,
				compilerOptions: {
					strict: true
				}
			})()

			expect(serializable(reference)!).toBeDefined()

			const tsconfig = JSON.parse(
				readFileSync(join(tmpRoot, 'tsconfig.json'), 'utf8')
			)

			expect(tsconfig.compilerOptions).toMatchObject({
				lib: ['ESNext'],
				module: 'ESNext',
				noEmit: false,
				declaration: true,
				emitDeclarationOnly: true,
				moduleResolution: 'bundler',
				skipLibCheck: true,
				skipDefaultLibCheck: true,
				rootDir: process.cwd(),
				outDir: join(tmpRoot, 'dist'),
				strict: true
			})
		} finally {
			rmSync(tmpRoot, { recursive: true, force: true })
		}
	})
})
