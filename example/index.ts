import { Elysia, t } from 'elysia'
import z from 'zod'
import { JSONSchema, Schema } from 'effect'

import { openapi } from '../src/index'

const app = new Elysia()
	.use(openapi())
	.post('/', ({ body }) => body, {
		body: z.object({
			name: z.string()
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
