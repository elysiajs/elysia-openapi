import { Elysia, t } from 'elysia'
import { openapi } from '../src'

import { describe, expect, it } from 'bun:test'
import z from 'zod'

const req = (path: string) => new Request(`http://localhost${path}`)

const getSpec = async (app: Elysia<any, any, any, any, any, any, any, any>) => {
	await app.modules
	return app.handle(req('/openapi/json')).then((r) => r.json())
}

describe('Model Reference Resolution', () => {
	it('replaces direct model usage with $ref (TypeBox)', async () => {
		const app = new Elysia()
			.use(openapi())
			.model({ User: t.Object({ id: t.String(), name: t.String() }) })
			.get('/user', () => ({}), {
				response: t.Object({ id: t.String(), name: t.String() })
			})

		const spec = await getSpec(app)
		const schema = spec.paths['/user'].get.responses['200'].content['application/json'].schema

		expect(schema).toEqual({ $ref: '#/components/schemas/User' })
	})

	it('replaces direct model usage with $ref (Zod)', async () => {
		const User = z.object({ id: z.string(), name: z.string() })

		const app = new Elysia()
			.use(openapi({ mapJsonSchema: { zod: z.toJSONSchema } }))
			.model({ User })
			.get('/user', () => ({}), { response: User })

		const spec = await getSpec(app)
		const schema = spec.paths['/user'].get.responses['200'].content['application/json'].schema

		expect(schema).toEqual({ $ref: '#/components/schemas/User' })
	})

	it('replaces nested model inside z.array() with $ref', async () => {
		const User = z.object({ id: z.string(), name: z.string() })

		const app = new Elysia()
			.use(openapi({ mapJsonSchema: { zod: z.toJSONSchema } }))
			.model({ User })
			.get('/users', () => [], { response: z.array(User) })

		const spec = await getSpec(app)
		const schema = spec.paths['/users'].get.responses['200'].content['application/json'].schema

		expect(schema.type).toBe('array')
		expect(schema.items).toEqual({ $ref: '#/components/schemas/User' })
	})

	it('replaces nested model inside t.Array() with $ref', async () => {
		const User = t.Object({ id: t.String(), name: t.String() })

		const app = new Elysia()
			.use(openapi())
			.model({ User })
			.get('/users', () => [], { response: t.Array(User) })

		const spec = await getSpec(app)
		const schema = spec.paths['/users'].get.responses['200'].content['application/json'].schema

		expect(schema.type).toBe('array')
		expect(schema.items).toEqual({ $ref: '#/components/schemas/User' })
	})

	it('replaces model in status code map responses', async () => {
		const User = z.object({ id: z.string(), name: z.string() })

		const app = new Elysia()
			.use(openapi({ mapJsonSchema: { zod: z.toJSONSchema } }))
			.model({ User })
			.get('/user', () => ({}), {
				response: { 200: User, 404: z.string() }
			})

		const spec = await getSpec(app)
		const ok = spec.paths['/user'].get.responses['200'].content['application/json'].schema
		const notFound = spec.paths['/user'].get.responses['404'].content['text/plain'].schema

		expect(ok).toEqual({ $ref: '#/components/schemas/User' })
		expect(notFound.type).toBe('string')
	})

	it('does not replace schemas that do not match a model', async () => {
		const User = z.object({ id: z.string(), name: z.string() })
		const Other = z.object({ foo: z.string(), bar: z.number() })

		const app = new Elysia()
			.use(openapi({ mapJsonSchema: { zod: z.toJSONSchema } }))
			.model({ User })
			.get('/other', () => ({}), { response: Other })

		const spec = await getSpec(app)
		const schema = spec.paths['/other'].get.responses['200'].content['application/json'].schema

		expect(schema.$ref).toBeUndefined()
		expect(schema.type).toBe('object')
		expect(schema.properties.foo).toBeDefined()
	})

	it('registers models in components/schemas', async () => {
		const User = z.object({ id: z.string(), name: z.string() })

		const app = new Elysia()
			.use(openapi({ mapJsonSchema: { zod: z.toJSONSchema } }))
			.model({ User })
			.get('/user', () => ({}), { response: User })

		const spec = await getSpec(app)

		expect(spec.components.schemas.User).toBeDefined()
		expect(spec.components.schemas.User.type).toBe('object')
		expect(spec.components.schemas.User.properties.id.type).toBe('string')
	})

	it('handles multiple models without cross-contamination', async () => {
		const User = z.object({ id: z.string(), name: z.string() })
		const Post = z.object({ id: z.string(), title: z.string(), body: z.string() })

		const app = new Elysia()
			.use(openapi({ mapJsonSchema: { zod: z.toJSONSchema } }))
			.model({ User, Post })
			.get('/user', () => ({}), { response: User })
			.get('/post', () => ({}), { response: Post })

		const spec = await getSpec(app)

		expect(spec.paths['/user'].get.responses['200'].content['application/json'].schema)
			.toEqual({ $ref: '#/components/schemas/User' })
		expect(spec.paths['/post'].get.responses['200'].content['application/json'].schema)
			.toEqual({ $ref: '#/components/schemas/Post' })
	})
})
