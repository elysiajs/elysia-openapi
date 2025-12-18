import { Elysia, t } from 'elysia'
import z from 'zod'
import { JSONSchema, Schema } from 'effect'

import { openapi, withHeaders } from '../src/index'

const app = new Elysia()
	.use(
		openapi({
			mapJsonSchema: {
				zod: z.toJSONSchema
			}
		})
	)
	.guard({
		schema: 'standalone',
		response: {
			403: t.Object({
				age: t.Number()
			})
		}
	})
	// .guard({
	// 	schema: 'standalone',
	// 	response: {
	// 		403: z.object({
	// 			code: z.string()
	// 		})
	// 	}
	// })
	.post('/', ({ body }) => body, {
		body: t.Object({
			name: t.String()
		})
	})
	.get('/test', ({ status }) => {}, {
		response: {
			403: t.Object({
				name: t.String()
			})
		}
	})
	.listen(3000)
