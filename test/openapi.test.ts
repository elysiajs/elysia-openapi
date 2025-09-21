import { describe, it, expect } from 'bun:test'
import { Kind } from '@sinclair/typebox'
import { convertEnumToOpenApi, getPossiblePath } from '../src/openapi'

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

describe('convertEnumToOpenApi', () => {
	it('should convert enum schema to OpenAPI enum format', () => {
		const expectedSchema = {
			[Kind]: 'Union',
			anyOf: [
				{ const: 'male' },
				{ const: 'female' }
			]
		}

		const result = convertEnumToOpenApi(expectedSchema)

		expect(result).toEqual({
			type: 'string',
			enum: ['male', 'female']
		})
	})

	it('should convert nested enums in object properties', () => {
		const expectedSchema = {
			type: 'object',
			properties: {
				name: { type: 'string' },
				gender: {
					[Kind]: 'Union',
					anyOf: [
						{ const: 'male' },
						{ const: 'female' }
					]
				}
			}
		}

		const result = convertEnumToOpenApi(expectedSchema)

		expect(result).toEqual({
			type: 'object',
			properties: {
				name: { type: 'string' },
				gender: {
					type: 'string',
					enum: ['male', 'female']
				}
			}
		})
	})

	it('should return original schema if not enum', () => {
		const expectedSchema = {
			type: 'string',
			description: 'Regular string field'
		}

		const result = convertEnumToOpenApi(expectedSchema)

		expect(result).toEqual(expectedSchema)
	})
})
