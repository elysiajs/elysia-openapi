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

	it('keeps routes when metadata errors use imported generics', () => {
		const reference = declarationToJSONSchema(`
			first: {
				get: {
					body: {};
					params: {};
					query: {};
					headers: {};
					response: { 200: {
						body: string;
						params: string;
						query: string;
						headers: string;
						response: string;
						error: string;
					} };
					error: import('./errors').RouteError<404>;
				};
			};
			second: {
				post: {
					body: {};
					params: {};
					query: {};
					headers: {};
					response: { 200: { saved: boolean } };
					error: import('./errors').RouteError<422>;
				};
			};
		`)

		expect(Object.keys(reference)).toEqual(['/first', '/second'])
		expect(reference['/first'].get.response[200]).toEqual({
			type: 'object',
			properties: {
				body: { type: 'string' },
				params: { type: 'string' },
				query: { type: 'string' },
				headers: { type: 'string' },
				response: { type: 'string' },
				error: { type: 'string' }
			},
			required: ['body', 'params', 'query', 'headers', 'response', 'error']
		})
		expect(reference['/second'].post.response[200]).toEqual({
			type: 'object',
			properties: { saved: { type: 'boolean' } },
			required: ['saved']
		})
		expect(reference['/first'].get).not.toHaveProperty('error')
		expect(reference['/second'].post).not.toHaveProperty('error')
	})

	// a route mounted with `.use()` has its `HTTPError` classes expanded,
	// with method signatures TypeBox can't parse
	it('keeps routes when errors are expanded HTTPError classes', () => {
		const reference = declarationToJSONSchema(`{
			id: {
				":id": {
					get: {
						body: {};
						params: {
							id: string;
						};
						query: {};
						headers: {};
						response: {
							200: \`bought \${string}\`;
							409: {
								code: "OUT_OF_STOCK";
								detail: "The item is out of stock";
								status: 409;
							};
						};
						error: {
							readonly detail: "The item is out of stock";
							name: string;
							readonly code: "OUT_OF_STOCK";
							readonly status: 409;
							value?(): import("elysia/types").MaybePromise<unknown>;
							extension?(): Record<string, unknown>;
						};
					};
				};
			};
		}`)

		expect(Object.keys(reference)).toEqual(['/id/:id'])
		expect(Object.keys(reference['/id/:id'].get.response)).toEqual([
			'200',
			'409'
		])
		expect(reference['/id/:id'].get).not.toHaveProperty('error')
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

	// Elysia attaches an error handled by `.onError(Class)` to its route as
	// `& { '~handled': ... }`, which isn't part of the route schema
	it('ignores internal members intersected on a route', () => {
		const route = `{
			body: unknown;
			params: {};
			query: unknown;
			headers: unknown;
			response: {
				200: "ok";
				418: "teapot";
			};
			error: never;
		}`

		const plain = declarationToJSONSchema(`r0: { get: ${route}; };`)
		const reference = declarationToJSONSchema(`
			r0: {
				get: ${route} & {
					'~handled': {
						error: OutOfCredit;
						response: import("elysia/types").ExtractErrorFromHandle<import("elysia").ElysiaStatus<418, "teapot", 418>>;
					};
				};
			};
			r1: {
				get: ${route} & {
					"~handled": {
						error: OutOfCredit;
						response: "teapot";
					};
				};
			};
			r2: {
				get: ${route} & {
					'~x': {
						value: import("x").A<string>;
					};
				} & {
					'~y': {
						value: import("y").B<string>;
					};
				};
			};
		`)

		expect(Object.keys(reference)).toEqual(['/r0', '/r1', '/r2'])
		expect(Object.keys(reference['/r0'].get.response)).toEqual([
			'200',
			'418'
		])
		for (const path of ['/r0', '/r1', '/r2'])
			expect(reference[path].get).toEqual(plain['/r0'].get)
	})

	// a mapped route type folds `~` members into the route itself
	it('ignores internal members declared on a route', () => {
		const route = (internal = '') => `{
			body: unknown;
			params: {};
			query: unknown;
			headers: unknown;
			response: {
				200: "ok";
				418: "teapot";
			};
			error: never;${internal}
		}`

		const plain = declarationToJSONSchema(`r0: { get: ${route()}; };`)
		const reference = declarationToJSONSchema(`
			r0: {
				get: ${route(`
					'~handled': {
						error: OutOfCredit;
						response: import("elysia/types").ExtractErrorFromHandle<import("elysia").ElysiaStatus<418, "teapot", 418>>;
					};`)};
			};
			r1: {
				get: ${route(`
					'~handled': {
						error: OutOfCredit;
						response: "teapot";
					};`)};
			};
			r2: {
				get: ${route(`
					~error: OutOfCredit;`)};
			};
			r3: {
				get: ${route(`
					'~handled': {
						error: OutOfCredit;
						response: import("elysia/types").ExtractErrorFromHandle<import("elysia").ElysiaStatus<418, "a\\"b;", 418>>;
					};`)};
			};
			r4: {
				get: {
					body: unknown;
					params: {};
					query: unknown;
					headers: unknown;
					'~handled': {
						error: OutOfCredit;
						response: "teapot";
					};
					response: {
						200: "ok";
						418: "teapot";
					};
					error: never;
				};
			};
		`)

		const paths = ['/r0', '/r1', '/r2', '/r3', '/r4']
		expect(Object.keys(reference)).toEqual(paths)
		for (const path of paths)
			expect(reference[path].get).toEqual(plain['/r0'].get)
	})

	// `/~john` is a valid path and `~foo` a valid property: only a route's
	// own `~` members are internal
	it('keeps ~ path segments and schema properties', () => {
		const reference = declarationToJSONSchema(`{
			"~john": {
				get: {
					body: unknown;
					params: {};
					query: unknown;
					headers: unknown;
					response: {
						200: {
							'~foo': "bar";
						};
					};
					error: never;
				};
			};
		} & {
			handled: {
				post: {
					body: {
						name: string;
					} & {
						'~tilde': string;
					};
					params: {};
					query: unknown;
					headers: unknown;
					response: {
						200: "ok";
					};
					error: never;
				};
			};
		} & {
			"~john": {
				files: {
					get: {
						body: unknown;
						params: {};
						query: unknown;
						headers: unknown;
						response: {
							200: "files";
							418: "teapot";
						};
						error: never;
					} & {
						'~handled': {
							error: OutOfCredit;
							response: import("elysia/types").ExtractErrorFromHandle<import("elysia").ElysiaStatus<418, "teapot", 418>>;
						};
					};
				};
			};
		}`)

		expect(Object.keys(reference)).toEqual([
			'/~john',
			'/handled',
			'/~john/files'
		])
		expect(reference['/~john'].get.response[200]).toEqual({
			type: 'object',
			required: ['~foo'],
			properties: { '~foo': { type: 'string', const: 'bar' } }
		})
		expect(reference['/handled'].post.body).toEqual({
			allOf: [
				{
					type: 'object',
					required: ['name'],
					properties: { name: { type: 'string' } }
				},
				{
					type: 'object',
					required: ['~tilde'],
					properties: { '~tilde': { type: 'string' } }
				}
			]
		})
		expect(reference['/~john/files'].get.response).toEqual({
			200: { type: 'string', const: 'files' },
			418: { type: 'string', const: 'teapot' }
		})
	})

	it('reads every route of an app with handled errors', () => {
		const declaration = `declare const OutOfCredit_base: import("elysia").TaggedHTTPError<"OUT_OF_CREDIT", {
    readonly status: 402;
}>;
declare class OutOfCredit extends OutOfCredit_base {
}
export declare const app: import("elysia/types").AddRoute<"", "local", import("elysia").DefaultSingleton, {
    typebox: {};
    error: [];
}, import("elysia").DefaultMetadata, {
    r0: {
        get: {
            body: unknown;
            params: {};
            query: unknown;
            headers: unknown;
            response: {
                200: "ok0";
                418: "teapot";
            };
            error: never;
        } & {
            '~handled': {
                error: OutOfCredit;
                response: import("elysia/types").ExtractErrorFromHandle<import("elysia").ElysiaStatus<418, "teapot", 418>>;
            };
        };
    };
} & {
    r1: {
        get: {
            body: unknown;
            params: {};
            query: unknown;
            headers: unknown;
            response: {
                200: "ok1";
                418: "teapot";
            };
            error: never;
            '~handled': {
                error: OutOfCredit;
                response: import("elysia/types").ExtractErrorFromHandle<import("elysia").ElysiaStatus<418, "teapot", 418>>;
            };
        };
    };
}, import("elysia").DefaultEphemeral, {
    derive: {};
    schema: {};
    schemas: {};
    response: {
        '~error': OutOfCredit;
    };
    error: [import("elysia/types").ErrorDefinitionEntry<typeof OutOfCredit, import("elysia").ElysiaStatus<418, "teapot", 418>>];
}, "get", "/r2", import("elysia/types").IntersectIfObjectSchema<import("elysia").UnwrapRoute<{}, {}, "/r2">, import("elysia/types").MergeScopedSchemas<{}, {}, {}>>, {}, () => "ok2">;
export {};`

		const reference = declarationToReference(declaration)!

		expect(Object.keys(reference)).toEqual(['/r0', '/r1', '/r2'])
		expect(reference['/r0'].get.response).toEqual({
			200: { type: 'string', const: 'ok0' },
			418: { type: 'string', const: 'teapot' }
		})
		expect(reference['/r1'].get.response).toEqual({
			200: { type: 'string', const: 'ok1' },
			418: { type: 'string', const: 'teapot' }
		})
	})
	// `,` separates members too, only the `~` member itself is internal
	it('keeps a member after a comma separated internal member', () => {
		const reference = declarationToJSONSchema(`r0: {
			get: {
				body: unknown;
				params: {};
				query: unknown;
				headers: unknown;
				response: {
					200: "ok";
				};
				error: never;
				'~x': import("x").A<string, number>, public: string;
			};
		};`)

		expect(reference['/r0'].get).toHaveProperty('public', {
			type: 'string'
		})
		expect(reference['/r0'].get).not.toHaveProperty('~x')
	})

	// an object in a generic, eg. `Record<string, {...}>`, is never a route,
	// even under one not recognized as such, eg. with an extra `meta`
	it('keeps ~ members of an object in a generic', () => {
		const reference = declarationToJSONSchema(`r0: {
			get: {
				body: Record<string, {
					marker: string;
				} & {
					body: string;
					params: string;
					query: string;
					headers: string;
					response: string;
					error: string;
					'~foo': string;
				}>;
				params: {};
				query: unknown;
				headers: unknown;
				response: {
					200: "ok";
				};
				error: never;
				meta: string;
			};
		};`)

		expect(reference['/r0'].get.body).toEqual({
			type: 'object',
			patternProperties: {
				'^.*$': {
					allOf: [
						{
							type: 'object',
							required: ['marker'],
							properties: { marker: { type: 'string' } }
						},
						{
							type: 'object',
							required: [
								'body',
								'params',
								'query',
								'headers',
								'response',
								'error',
								'~foo'
							],
							properties: {
								body: { type: 'string' },
								params: { type: 'string' },
								query: { type: 'string' },
								headers: { type: 'string' },
								response: { type: 'string' },
								error: { type: 'string' },
								'~foo': { type: 'string' }
							}
						}
					]
				}
			}
		})
	})

	// a route's schema is user data even when shaped like a route,
	// eg. returning `{ body, params, query, headers, response, error }`
	it('keeps ~ members of a schema shaped like a route', () => {
		const declaration = `declare class Boom extends Error {
}
export declare const app: import("elysia/types").AddRoute<"", "local", import("elysia").DefaultSingleton, {
    typebox: {};
    error: [];
}, import("elysia").DefaultMetadata, {
    "object-error": {
        get: {
            body: unknown;
            params: {};
            query: unknown;
            headers: unknown;
            response: {
                200: "ok";
                418: {
                    readonly message: "handled";
                };
            };
            error: never;
        } & {
            '~handled': {
                error: Boom;
                response: import("elysia/types").ExtractErrorFromHandle<import("elysia").ElysiaStatus<418, {
                    readonly message: "handled";
                }, 418>>;
            };
        };
    };
} & {
    "user-object": {
        get: {
            body: unknown;
            params: {};
            query: unknown;
            headers: unknown;
            response: {
                200: {
                    readonly body: "body";
                    readonly params: "params";
                    readonly query: "query";
                    readonly headers: "headers";
                    readonly response: "response";
                    readonly error: "error";
                    readonly '~foo': "kept";
                };
                418: {
                    readonly message: "handled";
                };
            };
            error: never;
        } & {
            '~handled': {
                error: Boom;
                response: import("elysia/types").ExtractErrorFromHandle<import("elysia").ElysiaStatus<418, {
                    readonly message: "handled";
                }, 418>>;
            };
        };
    };
}, import("elysia").DefaultEphemeral, {
    derive: {};
    schema: {};
    schemas: {};
    response: {
        '~error': Boom;
    };
    error: [import("elysia/types").ErrorDefinitionEntry<typeof Boom, import("elysia").ElysiaStatus<418, {
        readonly message: "handled";
    }, 418>>];
}, "get", "/tail", import("elysia/types").IntersectIfObjectSchema<import("elysia").UnwrapRoute<{}, {}, "/tail">, import("elysia/types").MergeScopedSchemas<{}, {}, {}>>, {}, () => "tail">;
export {};`

		const reference = declarationToReference(declaration, 'app')!
		const user = {
			type: 'object',
			required: [
				'body',
				'params',
				'query',
				'headers',
				'response',
				'error',
				'~foo'
			],
			properties: {
				body: { type: 'string', const: 'body' },
				params: { type: 'string', const: 'params' },
				query: { type: 'string', const: 'query' },
				headers: { type: 'string', const: 'headers' },
				response: { type: 'string', const: 'response' },
				error: { type: 'string', const: 'error' },
				'~foo': { type: 'string', const: 'kept' }
			}
		}
		const handled = {
			type: 'object',
			required: ['message'],
			properties: { message: { type: 'string', const: 'handled' } }
		}

		expect(Object.keys(reference)).toEqual([
			'/object-error',
			'/user-object',
			'/tail'
		])
		expect(reference['/object-error'].get.response[418]).toEqual(handled)
		expect(reference['/user-object'].get.response).toEqual({
			200: user,
			418: handled
		})

		const intersected = declarationToJSONSchema(`r0: {
			get: {
				body: unknown;
				params: {};
				query: unknown;
				headers: unknown;
				response: {
					200: {
						body: string;
						params: string;
						query: string;
						headers: string;
						response: string;
						error: string;
					} & {
						'~foo': string;
					};
				};
				error: never;
			};
		};`)

		expect(intersected['/r0'].get.response[200]).toEqual({
			allOf: [
				{
					type: 'object',
					required: [
						'body',
						'params',
						'query',
						'headers',
						'response',
						'error'
					],
					properties: {
						body: { type: 'string' },
						params: { type: 'string' },
						query: { type: 'string' },
						headers: { type: 'string' },
						response: { type: 'string' },
						error: { type: 'string' }
					}
				},
				{
					type: 'object',
					required: ['~foo'],
					properties: { '~foo': { type: 'string' } }
				}
			]
		})
	})
	// `.use()` under a parent hook error maps the routes over their keys,
	// reordering them, eg. `{ error; body; ...; "~handled": ... }`
	it('reads a reordered route with internal members', () => {
		const declaration = `import { Elysia } from 'elysia';
export declare const app: Elysia<"", "local", {
    decorator: {};
    store: {};
    derive: {};
}, {
    typebox: {};
    error: [];
}, import("elysia").DefaultMetadata, {
    p: {
        get: {
            error: never;
            body: unknown;
            headers: unknown;
            query: unknown;
            params: {};
            response: {
                200: "p";
                418: "t";
            };
            "~handled": {
                error: Error;
                response: import("elysia/types").ExtractErrorFromHandle<import("elysia").ElysiaStatus<418, "t", 418>>;
            };
        };
    };
}, import("elysia").DefaultEphemeral, {
    derive: {};
    schema: {};
    schemas: {};
    response: {
        '~error': Error;
    };
    error: [import("elysia/types").ErrorDefinitionEntry<ErrorConstructor, import("elysia").ElysiaStatus<418, "t", 418>>];
}>;`

		const reference = declarationToReference(declaration, 'app')!

		expect(Object.keys(reference)).toEqual(['/p'])
		expect(Object.keys(reference['/p'].get).sort()).toEqual([
			'body',
			'headers',
			'params',
			'query',
			'response'
		])
		expect(reference['/p'].get.response).toEqual({
			200: { type: 'string', const: 'p' },
			418: { type: 'string', const: 't' }
		})
	})

	// an imported error type is rewritten wherever `error` is in the route
	it('reads a reordered route with an imported error', () => {
		const declaration = `import { Elysia } from 'elysia';
export declare const app: Elysia<"", "local", {
    decorator: {};
    store: {};
    derive: {};
}, {
    typebox: {};
    error: [];
}, import("elysia").DefaultMetadata, {
    p: {
        get: {
            error: import("./err").Plain;
            body: unknown;
            headers: unknown;
            query: unknown;
            params: {};
            response: {
                200: "p";
                500: {
                    type: string;
                    code: "internal-server-error";
                    title: "Internal Server Error";
                    status: 500;
                    detail?: string;
                    name?: string;
                    cause?: unknown;
                };
            };
            "~base": {
                200: "p";
            };
        };
    };
}, import("elysia").DefaultEphemeral, {
    derive: {};
    schema: {};
    schemas: {};
    response: {
        '~error': import("./err").Plain;
    };
    error: [];
}>;`

		const reference = declarationToReference(declaration, 'app')!

		expect(Object.keys(reference)).toEqual(['/p'])
		expect(reference['/p'].get.response[200]).toEqual({
			type: 'string',
			const: 'p'
		})
		expect(Object.keys(reference['/p'].get.response)).toEqual([
			'200',
			'500'
		])
	})

	// a route at `/` sits in the route map itself, so its internal
	// `& { '~base': ... }` is at the top too
	it('keeps internal members of a route at the root out of the routes', () => {
		const declaration = `declare const OutOfCredit_base: import("elysia").TaggedHTTPError<"OUT_OF_CREDIT", {
    readonly status: 402;
}>;
declare class OutOfCredit extends OutOfCredit_base {
}
export declare const app: import("elysia/types").AddRoute<"", "local", import("elysia").DefaultSingleton, {
    typebox: {};
    error: [];
}, import("elysia").DefaultMetadata, {
    get: {
        body: unknown;
        params: {};
        query: unknown;
        headers: unknown;
        response: {
            402: Omit<{
                type: string;
                title: string;
                detail?: string;
                instance?: string;
            }, "type" | "code" | "detail"> & Omit<{
                type: "OUT_OF_CREDIT";
                detail?: string;
            } & {
                code: "OUT_OF_CREDIT";
            }, "status"> & {
                status: 402;
            };
            200: "ok";
        };
        error: OutOfCredit;
    } & {
        '~base': {
            200: "ok";
        };
    };
}, import("elysia").DefaultEphemeral, import("elysia").DefaultEphemeral, "get", "/z", import("elysia/types").IntersectIfObjectSchema<import("elysia").UnwrapRoute<{}, {}, "/z">, import("elysia/types").MergeScopedSchemas<{}, {}, {}>>, {}, () => "z">;
export {};`

		const reference = declarationToReference(declaration, 'app')!

		expect(Object.keys(reference)).toEqual(['/', '/z'])
		expect(Object.keys(reference['/'].get.response)).toEqual(['200', '402'])
		expect(reference['/'].get.response[200]).toEqual({
			type: 'string',
			const: 'ok'
		})
	})
})

describe('Gen > Last Route', () => {
	// `.get()` returns a deferred `AddRoute<...>`, so the last route of a chain
	// is emitted unexpanded, unlike the routes before it
	it('resolves the last route like any other route', () => {
		const route = (serializable(fromTypes('test/gen/last-route.ts')()) as any)[
			'/id/:id'
		].get

		expect(route.params).toEqual({
			type: 'object',
			required: ['id'],
			properties: { id: { type: 'string' } }
		})
		expect(Object.keys(route.response).sort()).toEqual(['200', '409'])
		expect(route.response[200]).toEqual({
			type: 'string',
			pattern: '^bought .*$'
		})
		expect(JSON.stringify(route.response[409])).toContain('"OUT_OF_STOCK"')
	})

	// without TypeScript importable, the last route is rebuilt from `AddRoute`
	it('reads the return type past arrows in the handler context', () => {
		const declaration = `export declare const app: import("elysia/types").AddRoute<"", "local", import("elysia").DefaultSingleton, {
    typebox: {};
    error: [];
}, import("elysia").DefaultMetadata, {}, import("elysia").DefaultEphemeral, import("elysia").DefaultEphemeral, "get", "/id/:id", import("elysia/types").IntersectIfObjectSchema<import("elysia").UnwrapRoute<{}, {}, "/id/:id">, import("elysia/types").MergeScopedSchemas<{}, {}, {}>>, {}, ({ params: { id } }: {
    params: {
        id: string;
    };
    status: <const Code extends number>(code: Code) => import("elysia").ElysiaStatus<Code>;
}) => \`bought \${string}\`>;
export {};`

		expect(
			declarationToReference(declaration, 'app')!['/id/:id'].get.response
		).toEqual({ 200: { type: 'string', pattern: '^bought .*$' } })
	})
})
