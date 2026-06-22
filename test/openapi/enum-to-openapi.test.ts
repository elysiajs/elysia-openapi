import { describe, it, expect } from 'bun:test'
import { Kind } from '@sinclair/typebox'

import { enumToOpenApi } from '../../src/openapi'

describe('OpenAPI > enumToOpenAPI', () => {
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

	it('should replace {"type":"Date"} with {"type":"string","format":"date-time"} and deduplicate', () => {
		// TypeBox t.Date() expands to this anyOf; "Date" is not a valid OpenAPI type
		const schema = {
			anyOf: [
				{ type: 'Date' },
				{ format: 'date-time', type: 'string' },
				{ format: 'date', type: 'string' },
				{ type: 'number' }
			]
		}

		const result = enumToOpenApi(schema as any) as any

		// The invalid Date entry is replaced; the duplicate date-time is removed
		expect(result.anyOf).not.toContainEqual({ type: 'Date' })
		expect(result.anyOf.filter((x: any) => x.type === 'string' && x.format === 'date-time')).toHaveLength(1)
		expect(result.anyOf).toContainEqual({ type: 'string', format: 'date-time' })
	})

	it('should preserve {"type":"null"} sibling when replacing Date in a nullable date field', () => {
		// t.Nullable(t.Date()) -- after plugin processing -- can appear as this flat anyOf
		const schema = {
			anyOf: [{ type: 'Date' }, { type: 'null' }]
		}

		const result = enumToOpenApi(schema as any) as any

		expect(result.anyOf).toContainEqual({ type: 'string', format: 'date-time' })
		expect(result.anyOf).toContainEqual({ type: 'null' })
		expect(result.anyOf).not.toContainEqual({ type: 'Date' })
	})

	it('should fix Date types nested in object properties', () => {
		const schema = {
			type: 'object',
			properties: {
				name: { type: 'string' },
				createdAt: {
					anyOf: [
						{ type: 'Date' },
						{ format: 'date-time', type: 'string' },
						{ format: 'date', type: 'string' },
						{ type: 'number' }
					]
				}
			}
		}

		const result = enumToOpenApi(schema as any) as any

		expect(result.properties.createdAt.anyOf).not.toContainEqual({ type: 'Date' })
		expect(result.properties.createdAt.anyOf).toContainEqual({
			type: 'string',
			format: 'date-time'
		})
	})

	it('should fix Date types nested in array items', () => {
		const schema = {
			type: 'array',
			items: {
				anyOf: [
					{ type: 'Date' },
					{ format: 'date-time', type: 'string' }
				]
			}
		}

		const result = enumToOpenApi(schema as any) as any

		// Both entries normalise to date-time; dedup collapses anyOf to a bare schema
		expect(result.items).toEqual({ type: 'string', format: 'date-time' })
	})
})
