import { Elysia } from 'elysia'
import type { AnyElysia } from 'elysia/base'

import { SwaggerUIRender } from './swagger'
import { ScalarRender } from './scalar'

import { getLoosePath, toOpenAPISchema } from './openapi'
import { toAsyncAPISchema } from './asyncapi'

import type { ApiReferenceConfiguration } from '@scalar/types'
import type { ElysiaOpenAPIConfig, OpenAPIVersion } from './types'

type OpenAPIDocument = {
	openapi: OpenAPIVersion
	[key: string]: unknown
}

const DEFAULT_OPENAPI_VERSION: OpenAPIVersion = '3.1.2'
const OPENAPI_VERSION_REGEX = /^3\.(0|1)\.\d+$/

const normalizeOpenAPIVersion = (version: string): OpenAPIVersion => {
	if (OPENAPI_VERSION_REGEX.test(version)) return version as OpenAPIVersion

	console.warn(
		`[@elysiajs/openapi] Invalid openapiVersion "${version}". Expected 3.0.x or 3.1.x. Falling back to ${DEFAULT_OPENAPI_VERSION}.`
	)

	return DEFAULT_OPENAPI_VERSION
}

const relativeTo = (page: string, target: string) => {
	const from = page.replace(/^\//, '').split('/').slice(0, -1)
	const to = target.replace(/^\//, '').split('/')

	let shared = 0
	while (shared < from.length && from[shared] === to[shared]) shared++

	return '../'.repeat(from.length - shared) + to.slice(shared).join('/')
}

function isCloudflareWorker() {
	try {
		// Check for the presence of caches.default, which is a global in Workers
		if (
			// @ts-ignore
			typeof caches !== 'undefined' &&
			// @ts-ignore
			typeof caches.default !== 'undefined'
		)
			return true

		// @ts-ignore
		if (typeof WebSocketPair !== 'undefined') {
			return true
		}
	} catch (e) {
		// If accessing these globals throws an error, it's likely not a Worker
		return false
	}

	return false
}

/**
 * Plugin for [elysia](https://github.com/elysiajs/elysia) that auto-generate OpenAPI documentation page.
 *
 * @see https://github.com/elysiajs/elysia-swagger
 */
export const openapi = <
	const Enabled extends boolean = true,
	const Path extends string = '/openapi'
>({
	enabled = true as Enabled,
	path = '/openapi' as Path,
	provider = 'scalar',
	specPath = `${path.replace(/\/$/, '')}/json`,
	openapiVersion = DEFAULT_OPENAPI_VERSION,
	documentation = {},
	exclude,
	swagger,
	scalar,
	references,
	mapJsonSchema,
	embedSpec,
	asyncapi
}: ElysiaOpenAPIConfig<Enabled, Path> = {}) => {
	if (!enabled) return new Elysia({ name: '@elysiajs/openapi' })

	const info = {
		title: 'Elysia Documentation',
		description: 'Development documentation',
		version: '0.0.0',
		...documentation.info
	}

	const tags = !exclude?.tags
		? documentation.tags
		: documentation.tags?.filter((tag) => !exclude.tags?.includes(tag.name))

	const effectiveOpenAPIVersion = normalizeOpenAPIVersion(openapiVersion)
	const asyncapiPath = `${path.replace(/\/$/, '')}/asyncapi/json`

	let totalRoutes = 0
	let cachedSchema: OpenAPIDocument | undefined
	let cachedAsyncAPI: ReturnType<typeof toAsyncAPISchema> | undefined

	const toFullSchema = ({
		paths,
		components: { schemas }
	}: ReturnType<typeof toOpenAPISchema>): OpenAPIDocument => {
		return (cachedSchema = {
			...documentation,
			openapi: effectiveOpenAPIVersion,
			tags,
			info: {
				title: 'Elysia Documentation',
				description: 'Development documentation',
				version: '0.0.0',
				...documentation.info
			},
			paths: {
				...paths,
				...documentation.paths
			},
			components: {
				...documentation.components,
				schemas: {
					...schemas,
					...(documentation.components?.schemas as any)
				}
			}
		})
	}

	return (host: AnyElysia) => {
		const plugin = new Elysia({
			name: '@elysia/openapi'
		})

		if (provider === null) return host.use(plugin)

		const generate = () => {
			if (totalRoutes === host.routes.length && cachedSchema)
				return cachedSchema

			totalRoutes = host.routes.length

			const schema = toOpenAPISchema(
				host,
				exclude,
				references,
				mapJsonSchema,
				effectiveOpenAPIVersion
			)

			if (asyncapi) {
				cachedAsyncAPI = toAsyncAPISchema(
					// AsyncAPI reads JSON Schema, which has no `nullable`
					effectiveOpenAPIVersion.startsWith('3.0.')
						? toOpenAPISchema(
								host,
								exclude,
								references,
								mapJsonSchema
							)
						: schema,
					{
						...documentation,
						info,
						tags
					}
				)

				for (const [path, item] of Object.entries(schema.paths)) {
					delete (item as { ws?: unknown }).ws
					if (!Object.keys(item!).length) delete schema.paths[path]
				}
			}

			return toFullSchema(schema)
		}

		const page = (address: string) =>
			new Response(
				provider === 'swagger-ui'
					? SwaggerUIRender(info, {
							url: relativeTo(address, specPath),
							dom_id: '#swagger-ui',
							version: 'latest',
							autoDarkMode: true,
							...swagger
						})
					: ScalarRender(
							info,
							{
								...(asyncapi && !embedSpec && !scalar?.url
									? {
											sources: [
												{
													title: 'HTTP',
													url: relativeTo(
														address,
														specPath
													)
												},
												{
													title: 'WebSocket',
													url: relativeTo(
														address,
														asyncapiPath
													)
												}
											]
										}
									: { url: relativeTo(address, specPath) }),
								version: 'latest',
								cdn: `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${scalar?.version ?? 'latest'}/dist/browser/standalone.min.js`,
								...(scalar as ApiReferenceConfiguration),
								_integration: 'elysiajs'
							},
							embedSpec ? JSON.stringify(generate()) : undefined
						),
				{
					headers: {
						'content-type': 'text/html; charset=utf8'
					}
				}
			)

		if (host['~config']?.strictPath !== true) {
			const loosePath = getLoosePath(path)

			plugin.get(
				loosePath,
				{
					detail: {
						hide: true
					}
				},
				embedSpec || isCloudflareWorker()
					? () => page(loosePath)
					: page(loosePath)
			)
		}

		plugin
			.get(
				path,
				{
					detail: {
						hide: true
					}
				},
				embedSpec || isCloudflareWorker()
					? () => page(path)
					: page(path)
			)
			.get(
				specPath,
				{
					error({ error }) {
						console.log('[@elysia/openapi] error at specPath')
						console.warn(error)
					},
					detail: {
						hide: true
					}
				},
				function openAPISchema(): OpenAPIDocument {
					return generate()
				}
			)

		if (asyncapi)
			plugin.get(
				asyncapiPath,
				{
					detail: {
						hide: true
					}
				},
				function asyncAPISchema() {
					generate()

					return cachedAsyncAPI
				}
			)

		return host.use(plugin)
	}
}

export { fromTypes } from './gen'
export { toOpenAPISchema, withHeaders } from './openapi'
export type { ElysiaOpenAPIConfig, OpenAPIVersion } from './types'

export default openapi
