import { describe, expect, it } from 'bun:test'
import { t } from 'elysia'

import { nullToOpenApi } from '../../src/openapi'

describe('OpenAPI > nullToOpenAPI', () => {
	it('converts nullable union to nullable:true for OAS 3.0', () => {
		const schema = t.Object({
			promo_code: t.Optional(
				t.Union([t.String({ example: 'SUMMER20' }), t.Null()])
			)
		})

		const result = nullToOpenApi(schema as any, '3.0.3') as any

		expect(result.properties.promo_code).toMatchObject({
			type: 'string',
			example: 'SUMMER20',
			nullable: true
		})
	})

	it('converts nullable union to type:[string, null] for OAS 3.1', () => {
		const schema = t.Object({
			promo_code: t.Optional(
				t.Union([t.String({ example: 'SUMMER20' }), t.Null()])
			)
		})

		const result = nullToOpenApi(schema as any, '3.1.2') as any

		expect(result.properties.promo_code).toMatchObject({
			type: ['string', 'null'],
			example: 'SUMMER20'
		})
		expect(result.properties.promo_code.nullable).toBeUndefined()
	})
})
