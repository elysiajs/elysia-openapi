import { Elysia } from 'elysia'

import { SwaggerUIRender } from './swagger'
import { ScalarRender } from './scalar'

import { toOpenAPISchema } from './openapi'

import type { OpenAPIV3 } from 'openapi-types'
import type { ApiReferenceConfiguration } from '@scalar/types'
import type { ElysiaOpenAPIConfig } from './types'

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
	specPath = `${path}/json`,
	documentation = {},
	exclude,
	swagger,
	scalar,
	references,
	mapJsonSchema
}: ElysiaOpenAPIConfig<Enabled, Path> = {}) => {
	if (!enabled) return new Elysia({ name: '@elysiajs/openapi' })

	const info = {
		title: 'Elysia Documentation',
		description: 'Development documentation',
		version: '0.0.0',
		...documentation.info
	}

	const relativePath = specPath.startsWith('/') ? specPath.slice(1) : specPath

	let totalRoutes = 0
	let cachedSchema: OpenAPIV3.Document | undefined

	const app = new Elysia({ name: '@elysiajs/openapi' })
		.use((app) => {
			if (provider === null) return app

			return app.get(
				path,
				() => new Response(
					provider === 'swagger-ui'
						? SwaggerUIRender(info, {
								url: relativePath,
								dom_id: '#swagger-ui',
								version: 'latest',
								autoDarkMode: true,
								...swagger
							})
						: ScalarRender(info, {
								url: relativePath,
								version: 'latest',
								cdn: `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${scalar?.version ?? 'latest'}/dist/browser/standalone.min.js`,
								...(scalar as ApiReferenceConfiguration),
								_integration: 'elysiajs'
							}),
					{
						headers: {
							'content-type': 'text/html; charset=utf8'
						}
					}
				),
				{
					detail: {
						hide: true
					}
				}
			)
		})
		.get(
			specPath,
			function openAPISchema() {
				if (totalRoutes === app.routes.length) return cachedSchema

				totalRoutes = app.routes.length

				const {
					paths,
					components: { schemas }
				} = toOpenAPISchema(app, exclude, references, mapJsonSchema)

				return (cachedSchema = {
					openapi: '3.0.3',
					...documentation,
					tags: !exclude?.tags
						? documentation.tags
						: documentation.tags?.filter(
								(tag) => !exclude.tags?.includes(tag.name)
							),
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
				} satisfies OpenAPIV3.Document)
			},
			{
				error({ error }) {
					console.log('[@elysiajs/openapi] error at specPath')
					console.warn(error)
				},
				detail: {
					hide: true
				}
			}
		)

	return app
}

export { toOpenAPISchema, withHeaders } from './openapi'
export type { ElysiaOpenAPIConfig }

export default openapi
