import { describe, it, expect } from 'bun:test'
import { getPossiblePath } from '../src/openapi'

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
