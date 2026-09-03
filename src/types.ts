import type { TSchema } from 'elysia'
import type {
	OpenAPIV3,
	OpenAPIV3_1,
	OpenAPIV3_2
} from '@scalar/openapi-types'
import type { ApiReferenceConfiguration } from '@scalar/types'
import type { SwaggerUIOptions } from './swagger/types'

export type OpenAPIProvider = 'scalar' | 'swagger-ui' | null
export type OpenAPIVersion =
	| `3.0.${number}`
	| `3.1.${number}`
	| `3.2.${number}`

type MaybeArray<T> = T | T[]

export type OpenAPI32TagObject = OpenAPIV3_2.TagObject
export type OpenAPI32ServerObject = OpenAPIV3_2.ServerObject

export type OpenAPI32DiscriminatorObject = Omit<
	OpenAPIV3_2.DiscriminatorObject,
	'propertyName'
> & {
	propertyName: string
	defaultMapping?: string
}

export type OpenAPI32ExampleObject = OpenAPIV3_2.ExampleObject

export type OpenAPI32EncodingObject = Omit<
	OpenAPIV3_2.EncodingObject,
	'headers'
> & {
	headers?: Record<
		string,
		OpenAPIV3_2.ReferenceObject | OpenAPIV3_2.HeaderObject
	>
	encoding?: Record<string, OpenAPI32EncodingObject>
	prefixEncoding?: OpenAPI32EncodingObject[]
	itemEncoding?: OpenAPI32EncodingObject
}

export type OpenAPI32MediaTypeObject = Omit<
	OpenAPIV3_2.MediaTypeObject,
	'encoding' | 'examples'
> & {
	description?: string
	itemSchema?:
		| OpenAPIV3_2.SchemaObject
		| OpenAPIV3_2.ReferenceObject
	examples?: Record<
		string,
		OpenAPIV3_2.ReferenceObject | OpenAPI32ExampleObject
	>
	encoding?: Record<string, OpenAPI32EncodingObject>
	prefixEncoding?: OpenAPI32EncodingObject[]
	itemEncoding?: OpenAPI32EncodingObject
}

export type OpenAPI32ResponseObject = Omit<
	OpenAPIV3_2.ResponseObject,
	'description' | 'content'
> & {
	summary?: string
	description?: string
	content?: Record<string, OpenAPI32MediaTypeObject>
}

export type OpenAPI32OAuthFlowObject = {
	authorizationUrl?: string
	tokenUrl?: string
	deviceAuthorizationUrl?: string
	refreshUrl?: string
	scopes: Record<string, string>
}

export type OpenAPI32OAuth2SecurityScheme = Omit<
	OpenAPIV3_2.OAuth2SecurityScheme,
	'flows'
> & {
	deprecated?: boolean
	oauth2MetadataUrl?: string
	flows: {
		implicit?: OpenAPI32OAuthFlowObject
		password?: OpenAPI32OAuthFlowObject
		clientCredentials?: OpenAPI32OAuthFlowObject
		authorizationCode?: OpenAPI32OAuthFlowObject
		deviceAuthorization?: OpenAPI32OAuthFlowObject
	}
}

export type OpenAPI32SecuritySchemeObject =
	| (OpenAPIV3_2.SecuritySchemeObject & { deprecated?: boolean })
	| OpenAPI32OAuth2SecurityScheme

export type OpenAPI32OperationObject = Omit<
	OpenAPIV3_2.OperationObject,
	'responses' | 'servers'
> & {
	responses?: Record<
		string,
		OpenAPIV3_2.ReferenceObject | OpenAPI32ResponseObject
	>
	servers?: OpenAPI32ServerObject[]
}

export type OpenAPI32PathItemObject = Omit<
	OpenAPIV3_2.PathItemObject,
	| 'get'
	| 'put'
	| 'post'
	| 'delete'
	| 'options'
	| 'head'
	| 'patch'
	| 'trace'
	| 'query'
	| 'additionalOperations'
	| 'servers'
> & {
	get?: OpenAPI32OperationObject
	put?: OpenAPI32OperationObject
	post?: OpenAPI32OperationObject
	delete?: OpenAPI32OperationObject
	options?: OpenAPI32OperationObject
	head?: OpenAPI32OperationObject
	patch?: OpenAPI32OperationObject
	trace?: OpenAPI32OperationObject
	query?: OpenAPI32OperationObject
	additionalOperations?: Record<string, OpenAPI32OperationObject>
	servers?: OpenAPI32ServerObject[]
}

export type OpenAPI32ComponentsObject = Omit<
	OpenAPIV3_2.ComponentsObject,
	'responses' | 'securitySchemes' | 'mediaTypes'
> & {
	responses?: Record<
		string,
		OpenAPIV3_2.ReferenceObject | OpenAPI32ResponseObject
	>
	securitySchemes?: Record<
		string,
		OpenAPIV3_2.ReferenceObject | OpenAPI32SecuritySchemeObject
	>
	mediaTypes?: Record<
		string,
		OpenAPIV3_2.ReferenceObject | OpenAPI32MediaTypeObject
	>
}

export type OpenAPI32Documentation = Omit<
	Partial<OpenAPIV3_2.Document>,
	'components' | 'paths' | 'servers' | 'tags' | 'webhooks'
> & {
	$self?: string
	components?: OpenAPI32ComponentsObject
	paths?: Record<string, OpenAPI32PathItemObject | undefined>
	servers?: OpenAPI32ServerObject[]
	tags?: OpenAPI32TagObject[]
	webhooks?: Record<
		string,
		OpenAPI32PathItemObject | OpenAPIV3_2.ReferenceObject
	>
}

type DocumentationWithoutExpressExtensions<T> = Omit<
	T,
	| 'x-express-openapi-additional-middleware'
	| 'x-express-openapi-validation-strict'
>

export type OpenAPIDocumentation =
	| DocumentationWithoutExpressExtensions<Partial<OpenAPIV3.Document>>
	| DocumentationWithoutExpressExtensions<Partial<OpenAPIV3_1.Document>>
	| DocumentationWithoutExpressExtensions<OpenAPI32Documentation>

export type MapJsonSchema = { [vendor: string]: Function } & {
	[vendor in  // schema['~standard'].vendor
		| 'zod'
		| 'effect'
		| 'valibot'
		| 'arktype'
		| 'typemap'
		| 'yup'
		| 'joi']?: Function
}

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
	Path extends string = '/swagger'
> {
	/**
	 * @default true
	 */
	enabled?: Enabled

	/**
	 * OpenAPI document version to emit
	 *
	 * @default '3.1.2'
	 */
	openapiVersion?: OpenAPIVersion

	/**
	 * OpenAPI config
	 *
	 * @see https://spec.openapis.org/oas/latest.html
	 */
	documentation?: OpenAPIDocumentation

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
	provider?: OpenAPIProvider

	/**
	 * Additional reference for each endpoint
	 */
	references?: AdditionalReferences

	/**
	 * Embed OpenAPI schema to provider body if possible
	 *
	 * This is highly discouraged, unless you really have to inline OpenAPI schema
	 *
	 * @default false
	 */
	embedSpec?: boolean

	/**
	 * Mapping function from Standard schema to OpenAPI schema
	 *
	 * @example
	 * ```ts
	 * import { openapi } from '@elysiajs/openapi'
	 * import { toJsonSchema } from '@valibot/to-json-schema'
	 *
	 * openapi({
	 * 	mapJsonSchema: {
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
	scalar?: Partial<ApiReferenceConfiguration> & {
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
