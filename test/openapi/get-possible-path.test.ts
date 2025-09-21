import { describe, it, expect } from 'bun:test'

import { getPossiblePath } from '../../src/openapi'

describe('OpenAPI > getPossiblePath', () => {
	it('remain the same if no optional', () => {
		expect(getPossiblePath('/user/:user/name/:name')).toEqual([
			'/user/:user/name/:name'
		])
	})

	it('list all possibility from optional', () => {
		expect(getPossiblePath('/user/:user?/name/:name?')).toEqual([
			'/user/:user/name/:name',
			'/user/name/:name',
			'/user/name',
			'/user/:user/name',
			'/user/name'
		])
	})
})
