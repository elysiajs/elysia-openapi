import { describe, it, expect } from 'bun:test'
import { Kind, Type } from '@sinclair/typebox'

import { enumToOpenApi } from '../src/openapi'
import { t } from 'elysia'

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

	it('should convert Date properties to date-time format', () => {
		const expectedSchema = {
			type: 'object',
			properties: {
				myDate: { type: 'Date' }
			}
		}

		const result = enumToOpenApi(expectedSchema as any)

		expect(result).toEqual({
			type: 'object',
			properties: {
				myDate: { type: 'string', format: 'date-time' }
			}
		})
	})

	it('should convert TDate TypeBox schema to date-time format', () => {
		const expectedSchema = Type.Object({
			myDate: Type.Optional(Type.Date())
		})

		const result = enumToOpenApi(expectedSchema as any)

		expect(result).toEqual({
			[Kind]: 'Object',
			type: 'object',
			properties: {
				myDate: { type: 'string', format: 'date-time' }
			}
		})
	})

	// Elysia's t.Date is an extension of the TypeBox Date type and behaves differently
	it('should convert Elysia t.Date TypeBox schema to date-time format', () => {
		const expectedSchema = t.Object({
			myDate: t.Optional(t.Date())
		})

		const result = enumToOpenApi(expectedSchema as any)

		expect(result).toEqual({
			[Kind]: 'Object',
			type: 'object',
			properties: {
				myDate: expect.objectContaining({
					anyOf: [
						{
							format: 'date-time',
							type: 'string'
						},
						{
							[Kind]: 'String',
							default: undefined,
							format: 'date',
							type: 'string'
						},
						{
							[Kind]: 'Number',
							default: undefined,
							type: 'number'
						}
					]
				})
			}
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
