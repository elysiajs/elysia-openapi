export {}

const candidate = process.env.ELYSIA_CANDIDATE_DIR
if (!candidate)
	throw new Error(
		'ELYSIA_CANDIDATE_DIR is required for the retention-seal candidate gate'
	)

const { resolve } = await import('node:path')
const candidateIndex = resolve(candidate, 'src/index.ts')
const candidateBase = resolve(candidate, 'src/base.ts')

Bun.plugin({
	name: 'elysia-retention-seal-candidate',
	setup(build) {
		build.onResolve({ filter: /^elysia(?:\/base)?$/ }, ({ path }) => ({
			path: path === 'elysia/base' ? candidateBase : candidateIndex
		}))
	}
})

process.env.NODE_ENV = 'production'

const elysiaSpecifier = 'elysia'
const [candidateElysia, candidateOpenapi] = await Promise.all([
	import(elysiaSpecifier),
	import('../src/index')
])
const { Elysia, t } = candidateElysia as typeof import('elysia')
const { openapi } = candidateOpenapi as typeof import('../src/index')

const app = new Elysia()
	.use(openapi())
	.model('RetainedResponse', t.Object({ ok: t.Boolean() }))
	.get('/retained', { response: 'RetainedResponse' }, () => ({ ok: true }))

await app.handle(new Request('http://localhost/retained'))

const generation = app['~generation']
if (generation?.introspect !== true)
	throw new Error('OpenAPI did not opt into the candidate introspection image')
if (!app.routes.some(({ path }) => path === '/retained'))
	throw new Error('candidate production seal dropped OpenAPI route introspection')

const schema = (await app
	.handle(new Request('http://localhost/openapi/json'))
	.then((response) => response.json())) as any
if (!schema.paths?.['/retained']?.get)
	throw new Error('OpenAPI path is missing after the candidate production seal')
if (!schema.components?.schemas?.RetainedResponse)
	throw new Error(
		'OpenAPI named model is missing after the candidate production seal'
	)

console.log('retention-seal candidate: pass')
