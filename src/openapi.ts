import { t, type AnyElysia, type TSchema, type InputSchema } from 'elysia'
import type { HookContainer, StandardSchemaV1Like } from 'elysia/types'

import type { OpenAPIV3 } from 'openapi-types'
import { Kind, type TProperties } from '@sinclair/typebox'

import type {
	AdditionalReference,
	AdditionalReferences,
	ElysiaOpenAPIConfig,
	MapJsonSchema
} from './types'
import { DefaultErrorFunction } from '@sinclair/typebox/errors'

export const capitalize = (word: string) =>
	word.charAt(0).toUpperCase() + word.slice(1)

const toRef = (name: string) => t.Ref(`#/components/schemas/${name}`)

const toOperationId = (method: string, paths: string) => {
	let operationId = method.toLowerCase()

	if (!paths || paths === '/') return operationId + 'Index'

	for (const path of paths.split('/'))
		operationId += path.includes(':')
			? 'By' + capitalize(path.replace(':', ''))
			: capitalize(path)

	operationId = operationId.replace(/\?/g, 'Optional')

	return operationId
}

const optionalParamsRegex = /(\/:\w+\?)/g

/**
 * Get all possible paths of a path with optional parameters
 * @param {string} path
 * @returns {string[]} paths
 */
export const getPossiblePath = (path: string): string[] => {
	const optionalParams = path.match(optionalParamsRegex)
	if (!optionalParams) return [path]

	const originalPath = path.replace(/\?/g, '')
	const paths = [originalPath]

	for (let i = 0; i < optionalParams.length; i++) {
		const newPath = path.replace(optionalParams[i], '')

		paths.push(...getPossiblePath(newPath))
	}

	return paths
}

const isValidSchema = (schema: any): schema is TSchema =>
	schema &&
	typeof schema === 'object' &&
	((Kind in schema && schema[Kind] !== 'Unknown') ||
		schema.type ||
		schema.properties ||
		schema.items)

export const getLoosePath = (path: string) => {
	if (path.charCodeAt(path.length - 1) === 47)
		return path.slice(0, path.length - 1)

	return path + '/'
}

const warnings = {
	zod4: `import openapi from '@elysiajs/openapi'
import * as z from 'zod'

openapi({
  mapJsonSchema: {
    zod: z.toJSONSchema
  }
})`,
	zod3: `import openapi from '@elysiajs/openapi'
import { zodToJsonSchema } from 'zod-to-json-schema'

openapi({
  mapJsonSchema: {
    zod: zodToJsonSchema
  }
})`,
	valibot: `import openapi from '@elysiajs/openapi'
import { toJsonSchema } from '@valibot/to-json-schema'

openapi({
  mapJsonSchema: {
    valibot: toJsonSchema
  }
})`,
	effect: `import { JSONSchema } from 'effect'

openapi({
  mapJsonSchema: {
    effect: JSONSchema.make
  }
})`
} as const

const warned = {} as Record<keyof typeof warnings, boolean | undefined>

const unwrapReference = <T extends OpenAPIV3.SchemaObject | undefined>(
	schema: T,
	definitions: Record<string, unknown>
):
	| Exclude<T, OpenAPIV3.SchemaObject>
	| (Omit<NonNullable<T>, 'type'> & {
			$ref: string
			type: string | undefined
	  }) => {
	// @ts-ignore
	const ref = schema?.$ref
	if (!ref) return schema as any

	const name = ref.slice(ref.lastIndexOf('/') + 1)
	if (ref && definitions[name]) schema = definitions[name] as T

	return schema as any
}

export const unwrapSchema = (
	schema: InputSchema['body'],
	mapJsonSchema?: MapJsonSchema
): OpenAPIV3.SchemaObject | undefined => {
	if (!schema) return

	if (typeof schema === 'string') schema = toRef(schema)
	if (Kind in schema) return schema

	if (Kind in schema || !schema?.['~standard']) return

	// @ts-ignore
	const vendor = schema['~standard'].vendor

	if (mapJsonSchema?.[vendor] && typeof mapJsonSchema[vendor] === 'function')
		return mapJsonSchema[vendor](schema)

	switch (vendor) {
		case 'zod':
			if (warned.zod4 || warned.zod3) break

			console.warn(
				"[@elysiajs/openapi] Zod doesn't provide JSON Schema method on the schema"
			)

			if ('_zod' in schema) {
				warned.zod4 = true

				console.warn(
					'For Zod v4, please provide z.toJSONSchema as follows:\n'
				)
				console.warn(warnings.zod4)
			} else {
				warned.zod3 = true

				console.warn(
					'For Zod v3, please install zod-to-json-schema package and use it like this:\n'
				)
				console.warn(warnings.zod3)
			}
			break

		case 'valibot':
			if (warned.valibot) break
			warned.valibot = true

			console.warn(
				'[@elysiajs/openapi] Valibot require a separate package for JSON Schema conversion'
			)
			console.warn(
				'Please install @valibot/to-json-schema package and use it like this:\n'
			)
			console.warn(warnings.valibot)
			break

		case 'effect':
			// Effect does not support toJsonSchema method
			// Users have to use third party library like effect-zod
			if (warned.effect) break
			warned.effect = true

			console.warn(
				"[@elysiajs/openapi] Effect Schema doesn't provide JSON Schema method on the schema"
			)
			console.warn(
				"please provide JSONSchema from 'effect' package as follows:\n"
			)
			console.warn(warnings.effect)
			break
	}

	if (vendor === 'arktype')
		// @ts-ignore
		return schema?.toJsonSchema?.()

	// @ts-ignore
	return schema.toJSONSchema?.() ?? schema?.toJsonSchema?.()
}

/**
 * Converts Elysia routes to OpenAPI 3.0.3 paths schema
 * @param routes Array of Elysia route objects
 * @returns OpenAPI paths object
 */
export function toOpenAPISchema(
	app: AnyElysia,
	exclude?: ElysiaOpenAPIConfig['exclude'],
	references?: AdditionalReferences,
	vendors?: MapJsonSchema
) {
	let {
		methods: excludeMethods = ['options'],
		staticFile: excludeStaticFile = true,
		tags: excludeTags
	} = exclude ?? {}

	excludeMethods = excludeMethods.map((method) => method.toLowerCase())

	const excludePaths = Array.isArray(exclude?.paths)
		? exclude.paths
		: typeof exclude?.paths !== 'undefined'
			? [exclude.paths]
			: []

	const paths: OpenAPIV3.PathsObject = Object.create(null)
	// @ts-ignore
	const definitions = app.getGlobalDefinitions?.().type

	// @ts-ignore private property
	const routes = app.getGlobalRoutes()

	if (references) {
		if (!Array.isArray(references)) references = [references]

		for (let i = 0; i < references.length; i++) {
			const reference = references[i]

			if (typeof reference === 'function') references[i] = reference()
		}
	}

	for (const route of routes) {
		if (route.hooks?.detail?.hide) continue

		const method = route.method.toLowerCase()

		if (
			(excludeStaticFile && route.path.includes('.')) ||
			excludePaths.includes(route.path) ||
			excludeMethods.includes(method)
		)
			continue

		const hooks: InputSchema & {
			detail: Partial<OpenAPIV3.OperationObject>
		} = route.hooks ?? {}

		if (references?.length)
			for (const reference of references as AdditionalReference[]) {
				if (!reference) continue

				const refer =
					reference[route.path]?.[method] ??
					reference[getLoosePath(route.path)]?.[method]

				if (!refer) continue

				if (!hooks.body && isValidSchema(refer.body))
					hooks.body = refer.body

				if (!hooks.query && isValidSchema(refer.query))
					hooks.query = refer.query

				if (!hooks.params && isValidSchema(refer.params))
					hooks.params = refer.params

				if (!hooks.headers && isValidSchema(refer.headers))
					hooks.headers = refer.headers

				if (refer.response)
					for (const [status, schema] of Object.entries(
						refer.response
					))
						if (isValidSchema(schema)) {
							if (!hooks.response) hooks.response = {}

							if (
								!hooks.response[
									status as keyof (typeof hooks)['response']
								]
							)
								// @ts-ignore
								hooks.response[status] = schema
						}
			}

		if (
			excludeTags &&
			hooks.detail.tags?.some((tag) => excludeTags?.includes(tag))
		)
			continue

		// Start building the operation object
		const operation: Partial<OpenAPIV3.OperationObject> = {
			...hooks.detail
		}

		const parameters: Array<{
			name: string
			in: 'path' | 'query' | 'header' | 'cookie'
			required?: boolean
			schema: any
		}> = []

		// Handle path parameters
		if (hooks.params) {
			const params = unwrapReference(
				unwrapSchema(hooks.params, vendors),
				definitions
			)

			if (params && params.type === 'object' && params.properties)
				for (const [paramName, paramSchema] of Object.entries(
					params.properties
				))
					parameters.push({
						name: paramName,
						in: 'path',
						required: true, // Path parameters are always required
						schema: paramSchema
					})
		}

		// Handle query parameters
		if (hooks.query) {
			const query = unwrapReference(
				unwrapSchema(hooks.query, vendors),
				definitions
			)

			if (query && query.type === 'object' && query.properties) {
				const required = query.required || []
				for (const [queryName, querySchema] of Object.entries(
					query.properties
				))
					parameters.push({
						name: queryName,
						in: 'query',
						required: required.includes(queryName),
						schema: querySchema
					})
			}
		}

		// Handle header parameters
		if (hooks.headers) {
			const headers = unwrapReference(
				unwrapSchema(hooks.query, vendors),
				definitions
			)

			if (headers && headers.type === 'object' && headers.properties) {
				const required = headers.required || []
				for (const [headerName, headerSchema] of Object.entries(
					headers.properties
				))
					parameters.push({
						name: headerName,
						in: 'header',
						required: required.includes(headerName),
						schema: headerSchema
					})
			}
		}

		// Handle cookie parameters
		if (hooks.cookie) {
			const cookie = unwrapReference(
				unwrapSchema(hooks.cookie, vendors),
				definitions
			)

			if (cookie && cookie.type === 'object' && cookie.properties) {
				const required = cookie.required || []
				for (const [cookieName, cookieSchema] of Object.entries(
					cookie.properties
				))
					parameters.push({
						name: cookieName,
						in: 'cookie',
						required: required.includes(cookieName),
						schema: cookieSchema
					})
			}
		}

		// Add parameters if any exist
		if (parameters.length > 0) operation.parameters = parameters

		// Handle request body
		if (hooks.body && method !== 'get' && method !== 'head') {
			const body = unwrapSchema(hooks.body, vendors)

			if (body) {
				// @ts-ignore
				const { type, description, $ref, ...options } = unwrapReference(
					body,
					definitions
				)

				// @ts-ignore
				if (hooks.parse) {
					const content: Record<
						string,
						{ schema: OpenAPIV3.SchemaObject }
					> = {}

					// @ts-ignore
					const parsers = hooks.parse as HookContainer[]

					for (const parser of parsers) {
						if (typeof parser.fn === 'function') continue

						switch (parser.fn) {
							case 'text':
							case 'text/plain':
								content['text/plain'] = { schema: body }
								continue

							case 'urlencoded':
							case 'application/x-www-form-urlencoded':
								content['application/x-www-form-urlencoded'] = {
									schema: body
								}
								continue

							case 'json':
							case 'application/json':
								content['application/json'] = { schema: body }
								continue

							case 'formdata':
							case 'multipart/form-data':
								content['multipart/form-data'] = {
									schema: body
								}
								continue
						}
					}

					operation.requestBody = {
						description,
						content,
						required: true
					}
				} else {
					operation.requestBody = {
						description,
						content:
							type === 'string' ||
							type === 'number' ||
							type === 'integer' ||
							type === 'boolean'
								? {
										'text/plain': {
											schema: body
										}
									}
								: {
										'application/json': {
											schema: body
										},
										'application/x-www-form-urlencoded': {
											schema: body
										},
										'multipart/form-data': {
											schema: body
										}
									},
						required: true
					}
				}
			}
		}

		// Handle responses
		if (hooks.response) {
			operation.responses = {}

			if (
				typeof hooks.response === 'object' &&
				!(hooks.response as TSchema).type &&
				!(hooks.response as TSchema).$ref
			) {
				for (let [status, schema] of Object.entries(hooks.response)) {
					const response = unwrapSchema(schema, vendors)

					if (!response) continue

					// @ts-ignore Must exclude $ref from root options
					const { type, description, $ref, ...options } =
						unwrapReference(response, definitions)

					operation.responses[status] = {
						description:
							description ?? `Response for status ${status}`,
						content:
							type === 'void' ||
							type === 'null' ||
							type === 'undefined'
								? (response as any)
								: type === 'string' ||
									  type === 'number' ||
									  type === 'integer' ||
									  type === 'boolean'
									? {
											'text/plain': {
												schema: response
											}
										}
									: {
											'application/json': {
												schema: response
											}
										}
					}
				}
			} else {
				const response = unwrapSchema(hooks.response as any, vendors)

				if (response) {
					// @ts-ignore
					const {
						type: _type,
						description,
						...options
					} = unwrapReference(response, definitions)
					const type = _type as string | undefined

					// It's a single schema, default to 200
					operation.responses['200'] = {
						description: description ?? `Response for status 200`,
						content:
							type === 'void' ||
							type === 'null' ||
							type === 'undefined'
								? (response as any)
								: type === 'string' ||
									  type === 'number' ||
									  type === 'integer' ||
									  type === 'boolean'
									? {
											'text/plain': {
												schema: response
											}
										}
									: {
											'application/json': {
												schema: response
											}
										}
					}
				}
			}
		}

		for (let path of getPossiblePath(route.path)) {
			const operationId = toOperationId(route.method, path)

			path = path.replace(/:([^/]+)/g, '{$1}')

			if (!paths[path]) paths[path] = {}

			const current = paths[path] as any

			if (method !== 'all') {
				current[method] = {
					...operation,
					operationId
				}
				continue
			}

			// Handle 'ALL' method by assigning operation to all standard methods
			for (const method of [
				'get',
				'post',
				'put',
				'delete',
				'patch',
				'head',
				'options',
				'trace'
			])
				current[method] = {
					...operation,
					operationId
				}
		}
	}

	// @ts-ignore private property
	const schemas = Object.create(null)

	if (definitions)
		for (const [name, schema] of Object.entries(definitions)) {
			const jsonSchema = unwrapSchema(schema as any, vendors) as
				| OpenAPIV3.SchemaObject
				| undefined

			if (jsonSchema) schemas[name] = jsonSchema
		}

	return {
		components: {
			schemas
		},
		paths
	} satisfies Pick<OpenAPIV3.Document, 'paths' | 'components'>
}

export const withHeaders = (schema: TSchema, headers: TProperties) =>
	Object.assign(schema, {
		headers: headers
	})
