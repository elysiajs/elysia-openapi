import { Elysia, t } from 'elysia'
import z from 'zod'
import { JSONSchema, Schema } from 'effect'

import { openapi, withHeaders } from '../src/index'

const app = new Elysia()
	.use(
		openapi({
			mapJsonSchema: {
				zod: z.toJSONSchema
			},
			scalar: {
				onBeforeRequest: ({ request }) => {
					console.info('onBeforeRequest', request.method, request.url)
				}
			}
		})
	)
	.get('/test', ({ status }) => status(204, undefined), {
		response: {
			204: z.void()
		}
	})
	.listen(3000)
