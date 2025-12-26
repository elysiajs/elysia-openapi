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
