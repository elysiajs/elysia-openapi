import { Elysia, t } from 'elysia'
import z from 'zod'
import { JSONSchema, Schema } from 'effect'

import { openapi, withHeaders } from '../src/index'

const schema = t.Object({
	test: t.Literal('hello')
})

const schema2 = t.Object({
	test: t.Literal('world')
})

const user = t.Object({
	name: t.String({
		example: 'saltyaom'
	})
})

const model = new Elysia().model(
	'body',
	t.Object({
		name: t.Literal('Lilith')
	})
)

const app = new Elysia()
	.use(openapi())
	.use(model)
	.post('/user', () => 'hello', {
		body: 'body'
	})
	.listen(3000)
