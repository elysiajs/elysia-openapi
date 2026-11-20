import { describe, it, expect } from 'bun:test'
import { Kind } from '@sinclair/typebox'

import { enumToOpenApi } from '../src/openapi'

describe('convertEnumToOpenApi', () => {
	it('should convert enum schema to OpenAPI enum format', () => {
		const expectedSchema = {
			[Kind]: 'Union',
			anyOf: [{ const: 'male' }, { const: 'female' }]
		}

		const result = enumToOpenApi(expectedSchema as any)

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
					anyOf: [{ const: 'male' }, { const: 'female' }]
				}
			}
		}

		const result = enumToOpenApi(expectedSchema as any)

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

	it('should use number type for numeric literal unions', () => {
		const result = enumToOpenApi({
			[Kind]: 'Union',
			anyOf: [{ const: 1 }, { const: 2 }]
		} as any)

		expect(result).toEqual({
			type: 'number',
			enum: [1, 2]
		})
	})

	it('should use boolean type for boolean literal unions', () => {
		const result = enumToOpenApi({
			[Kind]: 'Union',
			anyOf: [{ const: true }, { const: false }]
		} as any)

		expect(result).toEqual({
			type: 'boolean',
			enum: [true, false]
		})
	})

	it('should keep string type for mixed literal unions', () => {
		const result = enumToOpenApi({
			[Kind]: 'Union',
			anyOf: [{ const: 'auto' }, { const: 0 }]
		} as any)

		expect(result).toEqual({
			type: 'string',
			enum: ['auto', 0]
		})
	})

	it('should return original schema if not enum', () => {
		const expectedSchema = {
			type: 'string',
			description: 'Regular string field'
		}

		const result = enumToOpenApi(expectedSchema as any)

		expect(result).toEqual(expectedSchema)
	})
})
