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

	it('should return original schema if not enum', () => {
		const expectedSchema = {
			type: 'string',
			description: 'Regular string field'
		}

		const result = enumToOpenApi(expectedSchema as any)

		expect(result).toEqual(expectedSchema)
	})
})
