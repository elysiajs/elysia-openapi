import { describe, it, expect } from 'bun:test'

import {
	declarationToJSONSchema,
	extractRootObjects,
	extractTypeAliases,
	inlineTypeReferences,
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
				derive: {},
				get: {
					body: {},
					headers: {},
					params: {
						properties: {},
						type: 'object'
					},
					query: {},
					response: {
						'204': {},
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
				},
				resolve: {},
				response: {},
				schema: {},
				standaloneschema: {}
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
})

describe('Gen > numberKey regex', () => {
	it('does not replace digits inside identifiers like v4', () => {
		const reference = declarationToJSONSchema(`{
			api: {
				v4: {
					getUser: {
						post: {
							params: {}
							query: unknown
							headers: unknown
							body: { id: string }
							response: {
								200: { name: string }
							}
						}
					}
				}
			}
		}`)

		expect(serializable(reference)!).toEqual({
			'/api/v4/getUser': {
				post: {
					params: {
						properties: {},
						type: 'object'
					},
					query: {},
					headers: {},
					body: {
						properties: {
							id: { type: 'string' }
						},
						required: ['id'],
						type: 'object'
					},
					response: {
						'200': {
							properties: {
								name: { type: 'string' }
							},
							required: ['name'],
							type: 'object'
						}
					}
				}
			}
		})
	})

	it('still replaces standalone numeric keys in response codes', () => {
		const reference = declarationToJSONSchema(`{
			users: {
				get: {
					params: {}
					query: unknown
					headers: unknown
					body: unknown
					response: {
						200: { id: string }
						404: { message: string }
					}
				}
			}
		}`)

		expect(serializable(reference)!['/users']).toBeDefined()
		const responses = (serializable(reference)!['/users'] as any).get
			.response
		expect(responses['200']).toBeDefined()
		expect(responses['404']).toBeDefined()
	})

	it('handles mixed numeric and alphanumeric path segments', () => {
		const reference = declarationToJSONSchema(`{
			api: {
				v2: {
					items: {
						get: {
							params: {}
							query: unknown
							headers: unknown
							body: unknown
							response: {
								200: { count: number }
							}
						}
					}
				}
			}
		}`)

		expect(serializable(reference)!).toHaveProperty('/api/v2/items')
	})
})

describe('Gen > extractTypeAliases', () => {
	it('extracts a simple type alias', () => {
		const aliases = extractTypeAliases(
			'type User = { id: string; name: string; };'
		)
		expect(aliases).toHaveProperty('User')
		expect(aliases.User).toBe('{ id: string; name: string; }')
	})

	it('extracts multiple type aliases', () => {
		const decl = `
type User = { id: string; name: string; };
type Post = { title: string; body: string; };
`
		const aliases = extractTypeAliases(decl)
		expect(Object.keys(aliases)).toEqual(['User', 'Post'])
		expect(aliases.User).toBe('{ id: string; name: string; }')
		expect(aliases.Post).toBe('{ title: string; body: string; }')
	})

	it('handles nested braces in type bodies', () => {
		const aliases = extractTypeAliases(
			'type Nested = { inner: { deep: string; }; outer: number; };'
		)
		expect(aliases.Nested).toBe(
			'{ inner: { deep: string; }; outer: number; }'
		)
	})

	it('ignores non-object type aliases', () => {
		const aliases = extractTypeAliases('type Name = string;')
		expect(Object.keys(aliases)).toEqual([])
	})
})

describe('Gen > inlineTypeReferences', () => {
	it('replaces type references with their definitions', () => {
		const result = inlineTypeReferences('200: User', {
			User: '{ id: string; name: string; }'
		})
		expect(result).toBe('200: { id: string; name: string; }')
	})

	it('replaces multiple references', () => {
		const result = inlineTypeReferences('200: User; 404: ErrorBody', {
			User: '{ name: string; }',
			ErrorBody: '{ message: string; }'
		})
		expect(result).toBe(
			'200: { name: string; }; 404: { message: string; }'
		)
	})

	it('does not replace partial matches inside other identifiers', () => {
		const result = inlineTypeReferences('200: UserProfile', {
			User: '{ id: string; }'
		})
		// UserProfile should NOT be partially replaced
		expect(result).toBe('200: UserProfile')
	})

	it('replaces longer names first to avoid partial matches', () => {
		const result = inlineTypeReferences('a: AdminUser; b: Admin', {
			Admin: '{ role: string; }',
			AdminUser: '{ role: string; name: string; }'
		})
		expect(result).toBe(
			'a: { role: string; name: string; }; b: { role: string; }'
		)
	})
})

describe('Gen > type alias inlining through declarationToJSONSchema', () => {
	it('inlines type aliases into response schemas', () => {
		const typeAliases = {
			User: '{ id: string; name: string; email: string; }'
		}
		const reference = declarationToJSONSchema(
			`{
				api: {
					v4: {
						getUser: {
							post: {
								params: {}
								query: unknown
								headers: unknown
								body: { id: string }
								response: {
									200: User
								}
							}
						}
					}
				}
			}`,
			typeAliases
		)

		const route = serializable(reference)!['/api/v4/getUser'] as any
		expect(route.post.response['200']).toEqual({
			properties: {
				id: { type: 'string' },
				name: { type: 'string' },
				email: { type: 'string' }
			},
			required: ['id', 'name', 'email'],
			type: 'object'
		})
	})

	it('inlines multiple type aliases in the same declaration', () => {
		const typeAliases = {
			User: '{ id: string; name: string; }',
			ErrorResponse: '{ message: string; code: number; }'
		}
		const reference = declarationToJSONSchema(
			`{
				users: {
					get: {
						params: {}
						query: unknown
						headers: unknown
						body: unknown
						response: {
							200: User
							400: ErrorResponse
						}
					}
				}
			}`,
			typeAliases
		)

		const route = serializable(reference)!['/users'] as any
		expect(route.get.response['200']).toEqual({
			properties: {
				id: { type: 'string' },
				name: { type: 'string' }
			},
			required: ['id', 'name'],
			type: 'object'
		})
		expect(route.get.response['400']).toEqual({
			properties: {
				message: { type: 'string' },
				code: { type: 'number' }
			},
			required: ['message', 'code'],
			type: 'object'
		})
	})

	it('works with nested type aliases in body and response', () => {
		const typeAliases = {
			CreateUserInput: '{ name: string; email: string; }',
			User: '{ id: string; name: string; email: string; createdAt: string; }'
		}
		const reference = declarationToJSONSchema(
			`{
				users: {
					post: {
						params: {}
						query: unknown
						headers: unknown
						body: CreateUserInput
						response: {
							201: User
						}
					}
				}
			}`,
			typeAliases
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
				email: { type: 'string' },
				createdAt: { type: 'string' }
			},
			required: ['id', 'name', 'email', 'createdAt'],
			type: 'object'
		})
	})
})

describe('Gen > route section trimming', () => {
	it('only extracts routes from the routes param, ignoring trailing generic params', () => {
		// Simulates what fromTypes extracts: the routes param followed by
		// additional generic params like `}, { derive: {}; resolve: {}; ... }, ...`
		// The trimming should stop at the first top-level closing brace.
		const routeSection = `{
			users: {
				get: {
					params: {}
					query: unknown
					headers: unknown
					body: unknown
					response: {
						200: { id: string; name: string }
					}
				}
			}
		}`

		const reference = declarationToJSONSchema(routeSection)
		const keys = Object.keys(serializable(reference)!)
		expect(keys).toEqual(['/users'])
	})

	it('extractRootObjects handles single top-level object', () => {
		const objects = extractRootObjects(`{
			api: {
				users: {
					get: {
						response: { 200: { id: string } }
					}
				}
			}
		}`)

		expect(objects.length).toBe(1)
	})
})
