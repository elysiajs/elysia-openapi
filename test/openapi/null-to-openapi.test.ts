import { describe, expect, it } from 'bun:test'

import { nullToOpenApi } from '../../src/openapi'

describe('OpenAPI > nullToOpenApi', () => {
	it('normalizes nullable schemas without rewriting metadata', () => {
		const schema = {
			type: 'object',
			properties: {
				promoCode: {
					anyOf: [{ type: 'string' }, { type: 'null' }]
				}
			},
			default: { type: 'null', reason: 'metadata' }
		}

		expect(nullToOpenApi(schema, '3.0.3')).toMatchObject({
			properties: {
				promoCode: { type: 'string', nullable: true }
			},
			default: { type: 'null', reason: 'metadata' }
		})
		expect(nullToOpenApi(schema, '3.1.2')).toMatchObject({
			properties: {
				promoCode: { type: ['string', 'null'] }
			},
			default: { type: 'null', reason: 'metadata' }
		})
	})
})
