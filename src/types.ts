import type { TSchema } from 'elysia'
import type { OpenAPIV3 } from 'openapi-types'
import type { ApiReferenceConfiguration } from '@scalar/types'
import type { SwaggerUIOptions } from './swagger/types'

export type OpenAPIProvider = 'scalar' | 'swagger-ui' | null

type MaybeArray<T> = T | T[]

export type MapJsonSchema = { [vendor: string]: Function }

export type AdditionalReference = {
	[path in string]: {
		[method in string]: {
			params: TSchema
			query: TSchema
			headers: TSchema
			body: TSchema
			response: { [status in number]: TSchema }
		}
	}
}

export type AdditionalReferences = MaybeArray<
	AdditionalReference | undefined | (() => AdditionalReference | undefined)
>

export interface ElysiaOpenAPIConfig<
	Enabled extends boolean = true,
	Path extends string = '/swagger',
	Provider extends OpenAPIProvider = 'scalar'
> {
	/**
	 * @default true
	 */
	enabled?: Enabled

	/**
	 * OpenAPI config
	 *
	 * @see https://spec.openapis.org/oas/v3.0.3.html
	 */
	documentation?: Omit<
		Partial<OpenAPIV3.Document>,
		| 'x-express-openapi-additional-middleware'
		| 'x-express-openapi-validation-strict'
	>

	exclude?: {
		/**
		 * Exclude methods from OpenAPI
		 */
		methods?: string[]

		/**
		 * Paths to exclude from OpenAPI endpoint
		 *
		 * @default []
		 */
		paths?: string | RegExp | (string | RegExp)[]

		/**
		 * Determine if OpenAPI should exclude static files.
		 *
		 * @default true
		 */
		staticFile?: boolean

		/**
		 * Exclude tags from OpenAPI
		 */
		tags?: string[]
	}

	/**
	 * The endpoint to expose OpenAPI Documentation
	 *
	 * @default '/openapi'
	 */
	path?: Path

	/**
	 * Choose your provider, Scalar or Swagger UI
	 *
	 * @default 'scalar'
	 * @see https://github.com/scalar/scalar
	 * @see https://github.com/swagger-api/swagger-ui
	 */
	provider?: Provider

	/**
	 * Additional reference for each endpoint
	 */
	references?: AdditionalReferences

	/**
	 * Mapping function from Standard schema to OpenAPI schema
	 *
	 * @example
	 * ```ts
	 * import { openapi } from '@elysiajs/openapi'
	 * import { toJsonSchema } from '@valibot/to-json-schema'
	 *
	 * openapi({
	 * 	vendors: {
	 * 	  valibot: toJsonSchema
	 *   }
	 * })
	 */
	mapJsonSchema?: MapJsonSchema

	/**
	 * Scalar configuration to customize scalar
	 *'
	 * @see https://github.com/scalar/scalar/blob/main/documentation/configuration.md
	 */
	scalar?: ApiReferenceConfiguration & {
		/**
		 * Version to use for Scalar cdn bundle
		 *
		 * @default 'latest'
		 * @see https://github.com/scalar/scalar
		 */
		version?: string
		/**
		 * Optional override to specifying the path for the Scalar bundle
		 *
		 * Custom URL or path to locally hosted Scalar bundle
		 *
		 * Lease blank to use default jsdeliver.net CDN
		 *
		 * @default ''
		 * @example 'https://unpkg.com/@scalar/api-reference@1.13.10/dist/browser/standalone.js'
		 * @example '/public/standalone.js'
		 * @see https://github.com/scalar/scalar
		 */
		cdn?: string
	}
	/**
	 * The endpoint to expose OpenAPI JSON specification
	 *
	 * @default '/${path}/json'
	 */
	specPath?: string

	/**
	 * Options to send to SwaggerUIBundle
	 * Currently, options that are defined as functions such as requestInterceptor
	 * and onComplete are not supported.
	 */
	swagger?: Omit<
		Partial<SwaggerUIOptions>,
		| 'dom_id'
		| 'dom_node'
		| 'spec'
		| 'url'
		| 'urls'
		| 'layout'
		| 'pluginsOptions'
		| 'plugins'
		| 'presets'
		| 'onComplete'
		| 'requestInterceptor'
		| 'responseInterceptor'
		| 'modelPropertyMacro'
		| 'parameterMacro'
	> & {
		/**
		 * Custom Swagger CSS
		 */
		theme?:
			| string
			| {
					light: string
					dark: string
			  }

		/**
		 * Version to use for swagger cdn bundle
		 *
		 * @see unpkg.com/swagger-ui-dist
		 *
		 * @default 4.18.2
		 */
		version?: string

		/**
		 * Using poor man dark mode 😭
		 */
		autoDarkMode?: boolean

		/**
		 * Optional override to specifying the path for the Swagger UI bundle
		 * Custom URL or path to locally hosted Swagger UI bundle
		 */
		cdn?: string
	}
}
