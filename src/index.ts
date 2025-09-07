import { Elysia, type InternalRoute } from 'elysia'

import { SwaggerUIRender } from './swagger'
import { ScalarRender } from './scalar'

import { toOpenAPISchema } from './openapi'

import type { OpenAPIV3 } from 'openapi-types'
import type { ApiReferenceConfiguration } from '@scalar/types'
import type { ElysiaOpenAPIConfig, OpenAPIProvider } from './types'

/**
 * Plugin for [elysia](https://github.com/elysiajs/elysia) that auto-generate OpenAPI documentation page.
 *
 * @see https://github.com/elysiajs/elysia-swagger
 */
export const openapi = <
	const Enabled extends boolean = true,
	const Path extends string = '/openapi',
	const Provider extends OpenAPIProvider = 'scalar'
>({
	enabled = true as Enabled,
	path = '/openapi' as Path,
	provider = 'scalar' as Provider,
	specPath = `${path}/json`,
	documentation = {},
	exclude,
	swagger,
	scalar,
	references
}: ElysiaOpenAPIConfig<Enabled, Path, Provider> = {}) => {
	if (!enabled) return new Elysia({ name: '@elysiajs/openapi' })

	const info = {
		title: 'Elysia Documentation',
		description: 'Development documentation',
		version: '0.0.0',
		...documentation.info
	}

	// Determine the correct URL for the OpenAPI spec
	// Use absolute path to avoid browser URL resolution issues when paths have complex hierarchies
	const getSpecUrl = () => {
		if (!specPath.startsWith('/')) {
			// Already relative
			return specPath
		}
		
		// For default case where specPath follows the pattern path + '/json', use relative path
		const defaultSpecPath = `${path}/json`
		if (specPath === defaultSpecPath) {
			return specPath.startsWith('/') ? specPath.slice(1) : specPath
		}
		
		// For custom specPath, use absolute path to prevent browser URL resolution issues
		return specPath
	}
	
	const specUrl = getSpecUrl()

	let totalRoutes = 0
	let cachedSchema: OpenAPIV3.Document | undefined

	const app = new Elysia({ name: '@elysiajs/openapi' })
		.use((app) => {
			if (provider === null) return app

			return app.get(
				path,
				new Response(
					provider === 'swagger-ui'
						? SwaggerUIRender(info, {
								url: specUrl,
								dom_id: '#swagger-ui',
								version: 'latest',
								autoDarkMode: true,
								...swagger
							})
						: ScalarRender(info, {
								url: specUrl,
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
				} = toOpenAPISchema(app, exclude, references)

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
							...documentation.components?.schemas
						}
					}
				} satisfies OpenAPIV3.Document)
			},
			{
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
