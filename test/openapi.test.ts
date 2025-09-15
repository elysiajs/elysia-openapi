import { describe, it, expect } from 'bun:test'
import { Elysia, t } from 'elysia'
import { getPossiblePath, toOpenAPISchema } from '../src/openapi'

describe('OpenAPI utilities', () => {
	it('getPossiblePath', () => {
		expect(getPossiblePath('/user/:user?/name/:name?')).toEqual([
			'/user/:user/name/:name',
			'/user/name/:name',
			'/user/name',
			'/user/:user/name',
			'/user/name'
		])
	})
})

describe('Convert Elysia routes to OpenAPI 3.0.3 paths schema', () => {
	describe('with path, header, query and cookie params', () => {
		const app = new Elysia().get('/', () => 'hi', {
			response: t.String({ description: 'sample description' }),
			headers: t.Object({
				testheader: t.String()
			}),
			params: t.Object({
				testparam: t.String()
			}),
			query: t.Object({
				testquery: t.String()
			}),
			cookie: t.Cookie({
				testcookie: t.String()
			})
		})

		const {
			paths: { ['/']: path }
		} = toOpenAPISchema(app)

		const parameters = path?.get?.parameters ?? []

		it('includes all expected parameters', () => {
			const names = parameters.map((p: any) => p.name)
			expect(names).toEqual(
				expect.arrayContaining([
					'testheader',
					'testparam',
					'testquery',
					'testcookie'
				])
			)
			expect(names).toHaveLength(4)
		})

		it('marks each parameter with the correct OpenAPI parameter location', () => {
			const map = Object.fromEntries(
				parameters.map((p: any) => [p.name, p.in])
			)
			expect(map).toMatchObject({
				testheader: 'header',
				testparam: 'path',
				testquery: 'query',
				testcookie: 'cookie'
			})
		})
	})
})
