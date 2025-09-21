import { describe, it, expect } from 'bun:test'
import { Elysia, t } from 'elysia'

import { toOpenAPISchema } from '../../src/openapi'

const serializable = (
	a: Record<string, unknown> | undefined
): Record<string, unknown> | undefined => JSON.parse(JSON.stringify(a))

describe('OpenAPI > references', () => {
	it('use references when schema is not available', () => {
		const app = new Elysia().get('/', () => {})

		const schema = toOpenAPISchema(app, undefined, {
			'/': {
				get: {
					params: {} as any,
					query: {} as any,
					headers: {} as any,
					body: {} as any,
					response: {
						200: t.Object({
							name: t.Literal('lilith')
						})
					}
				}
			}
		})

		expect(serializable(schema)).toEqual({
			components: {
				schemas: {}
			},
			paths: {
				'/': {
					get: {
						operationId: 'getIndex',
						responses: {
							'200': {
								content: {
									'application/json': {
										schema: {
											properties: {
												name: {
													const: 'lilith',
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

	it('prefers schema over definition', () => {
		const app = new Elysia().get('/', () => ({ name: 'fouco' }) as const, {
			query: t.Object({
				id: t.Number()
			}),
			response: t.Object({
				name: t.Literal('fouco')
			})
		})

		const schema = toOpenAPISchema(app, undefined, {
			'/': {
				get: {
					params: {} as any,
					query: {} as any,
					headers: {} as any,
					body: {} as any,
					response: {
						200: t.Object({
							name: t.Literal('lilith')
						})
					}
				}
			}
		})

		expect(serializable(schema)).toEqual({
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
								name: 'id',
								required: true,
								schema: {
									type: 'number'
								}
							}
						],
						responses: {
							'200': {
								content: {
									'application/json': {
										schema: {
											properties: {
												name: {
													const: 'fouco',
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

	it('use multiple references', () => {
		const app = new Elysia().get('/', () => {})

		const schema = toOpenAPISchema(app, undefined, [
			{
				'/': {
					get: {
						params: {} as any,
						query: {} as any,
						headers: {} as any,
						body: {} as any,
						response: {
							200: t.Object({
								name: t.Literal('lilith')
							})
						}
					}
				}
			},
			{
				'/': {
					get: {
						params: {} as any,
						query: t.Object({
							id: t.Number()
						}),
						headers: {} as any,
						body: {} as any,
						response: {}
					}
				}
			}
		])

		expect(serializable(schema)).toEqual({
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
								name: 'id',
								required: true,
								schema: {
									type: 'number'
								}
							}
						],
						responses: {
							'200': {
								content: {
									'application/json': {
										schema: {
											properties: {
												name: {
													const: 'lilith',
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
})
