import type { OpenAPIV3 } from 'openapi-types'
import type { ReferenceConfiguration, TagGroup } from '@scalar/types'
import type { SwaggerUIOptions } from './swagger/types'

export interface ElysiaSwaggerConfig<Path extends string = '/swagger'> {
	/**
	 * Customize Swagger config, refers to Swagger 2.0 config
	 *
	 * @see https://swagger.io/specification/v2/
	 */
	documentation?: ElysiaSwaggerDocumentation;
	/**
	 * Choose your provider, Scalar or Swagger UI
	 *
	 * @default 'scalar'
	 * @see https://github.com/scalar/scalar
	 * @see https://github.com/swagger-api/swagger-ui
	 */
	provider?: 'scalar' | 'swagger-ui'
	/**
	 * Version to use for Scalar cdn bundle
	 *
	 * @default 'latest'
	 * @see https://github.com/scalar/scalar
	 */
	scalarVersion?: string
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
	scalarCDN?: string
	/**
	 * Scalar configuration to customize scalar
	 *'
	 * @see https://github.com/scalar/scalar/blob/main/documentation/configuration.md
	 */
	scalarConfig?: ReferenceConfiguration
	/**
	 * Version to use for swagger cdn bundle
	 *
	 * @see unpkg.com/swagger-ui-dist
	 *
	 * @default 4.18.2
	 */
	version?: string
	/**
	 * Determine if Swagger should exclude static files.
	 *
	 * @default true
	 */
	excludeStaticFile?: boolean
	/**
	 * The endpoint to expose OpenAPI Documentation
	 *
	 * @default '/swagger'
	 */
	path?: Path
	/**
	 * The endpoint to expose OpenAPI JSON specification
	 *
	 * @default '/${path}/json'
	 */
	specPath?: string
	/**
	 * Paths to exclude from Swagger endpoint
	 *
	 * @default []
	 */
	exclude?: string | RegExp | (string | RegExp)[]
	/**
	 * Options to send to SwaggerUIBundle
	 * Currently, options that are defined as functions such as requestInterceptor
	 * and onComplete are not supported.
	 */
	swaggerOptions?: Omit<
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
	>
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
	 * Using poor man dark mode 😭
	 */
	autoDarkMode?: boolean

	/**
	 * Exclude methods from Swagger
	 */
	excludeMethods?: string[]

	/**
	 * Exclude tags from Swagger or Scalar
	 */
	excludeTags?: string[]
}

interface ElysiaSwaggerDocumentation extends Omit<
    Partial<OpenAPIV3.Document>,
    | 'x-express-openapi-additional-middleware'
    | 'x-express-openapi-validation-strict'
> {
    /**
     * Group tags in Scalar UI using `x-tagGroups` property
     */
    'x-tagGroups'?: TagGroup[]
}

