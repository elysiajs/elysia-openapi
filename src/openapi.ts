import { t, type AnyElysia, type TSchema, type InputSchema } from 'elysia'
import type {
	HookContainer,
	LocalHook,
	RouteSchema,
	SingletonBase,
	StandardSchemaV1Like
} from 'elysia/types'

import type { OpenAPIV3 } from 'openapi-types'
import {
	Kind,
	TAnySchema,
	type TProperties,
	type TObject
} from '@sinclair/typebox'

import type {
	AdditionalReference,
	AdditionalReferences,
	ElysiaOpenAPIConfig,
	MapJsonSchema
} from './types'
import { defineConfig } from 'tsup'

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

// ============================================================================
// Schema Flattening Helpers
// ============================================================================

/**
 * Merge object schemas together
 * Returns merged object schema and any non-object schemas that couldn't be merged
 */
const mergeObjectSchemas = (
	schemas: TSchema[]
): {
	schema: TObject | undefined
	notObjects: TSchema[]
} => {
	if (schemas.length === 0)
		return {
			schema: undefined,
			notObjects: []
		}

	if (schemas.length === 1)
		return schemas[0].type === 'object'
			? {
					schema: schemas[0] as TObject,
					notObjects: []
				}
			: {
					schema: undefined,
					notObjects: schemas
				}

	let newSchema: TObject
	const notObjects = <TSchema[]>[]

	let additionalPropertiesIsTrue = false
	let additionalPropertiesIsFalse = false

	for (const schema of schemas) {
		if (!schema) continue

		if (schema.type !== 'object') {
			notObjects.push(schema)
			continue
		}

		if ('additionalProperties' in schema) {
			if (schema.additionalProperties === true)
				additionalPropertiesIsTrue = true
			else if (schema.additionalProperties === false)
				additionalPropertiesIsFalse = true
		}

		if (!newSchema!) {
			newSchema = schema as TObject
			continue
		}

		newSchema = {
			...newSchema,
			...schema,
			properties: {
				...newSchema.properties,
				...schema.properties
			},
			required: [
				...(newSchema?.required ?? []),
				...(schema.required ?? [])
			]
		} as TObject
	}

	if (newSchema!) {
		if (newSchema.required)
			newSchema.required = [...new Set(newSchema.required)]

		if (additionalPropertiesIsFalse) newSchema.additionalProperties = false
		else if (additionalPropertiesIsTrue)
			newSchema.additionalProperties = true
	}

	return {
		schema: newSchema!,
		notObjects
	}
}

/**
 * Check if a value is a TypeBox schema (vs a status code object)
 * Uses the TypeBox Kind symbol which all schemas have.
 *
 * This method distinguishes between:
 * - TypeBox schemas: Have the Kind symbol (unions, intersects, objects, etc.)
 * - Status code objects: Plain objects with numeric keys like { 200: schema, 404: schema }
 */
const isTSchema = (value: any): value is TSchema => {
	if (!value || typeof value !== 'object') return false

	// All TypeBox schemas have the Kind symbol
	if (Kind in value) return true

	// Additional check: if it's an object with only numeric keys, it's likely a status code map
	const keys = Object.keys(value)
	if (keys.length > 0 && keys.every((k) => !isNaN(Number(k)))) {
		return false
	}

	return false
}

/**
 * Normalize string schema references to TRef nodes for proper merging
 */
const normalizeSchemaReference = (
	schema: TSchema | string | undefined
): TSchema | undefined => {
	if (!schema) return undefined
	if (typeof schema !== 'string') return schema

	// Convert string reference to t.Ref node
	// This allows string aliases to participate in schema composition
	return t.Ref(schema)
}

/**
 * Merge two schema properties (body, query, headers, params, cookie)
 */
const mergeSchemaProperty = (
	existing: TSchema | string | undefined,
	incoming: TSchema | string | undefined,
	vendors?: MapJsonSchema
): TSchema | string | undefined => {
	if (!existing) return incoming
	if (!incoming) return existing

	// Normalize string references to TRef nodes so they can be merged
	const existingSchema = normalizeSchemaReference(existing)
	let incomingSchema = normalizeSchemaReference(incoming)

	if (!existingSchema) return incoming
	if (!incomingSchema) return existing

	if (!isTSchema(incomingSchema) && incomingSchema['~standard'])
		incomingSchema = unwrapSchema(incomingSchema, vendors) as any

	if (!incomingSchema) return existing

	// If both are object schemas, merge them
	const { schema: mergedSchema, notObjects } = mergeObjectSchemas([
		existingSchema,
		incomingSchema
	])

	// If we have non-object schemas, create an Intersect
	if (notObjects.length > 0) {
		if (mergedSchema) return t.Intersect([mergedSchema, ...notObjects])

		return notObjects.length === 1 ? notObjects[0] : t.Intersect(notObjects)
	}

	return mergedSchema
}

type ResponseSchema =
	| TSchema
	| { [status: number]: TSchema }
	| string
	| { [status: number]: string | TSchema }
	| undefined

const unwrapResponseSchema = (
	schema: ResponseSchema,
	vendors?: MapJsonSchema
) =>
	typeof schema === 'string'
		? normalizeSchemaReference(schema)
		: !schema
			? undefined
			: isTSchema(schema)
				? schema
				: // @ts-ignore
					schema['~standard']
					? unwrapSchema(schema as any, vendors, 'output')
					: Object.fromEntries(
							Object.entries(schema).map(([status, schema]) => [
								status,
								typeof schema === 'string'
									? normalizeSchemaReference(schema)
									: isTSchema(schema)
										? schema
										: unwrapSchema(schema as any, vendors, 'output')
							])
						)

/**
 * Merge response schemas (handles status code objects)
 */
const mergeResponseSchema = (
	_existing: ResponseSchema,
	_incoming: ResponseSchema,
	vendors?: MapJsonSchema
): TSchema | { [status: number]: TSchema | string } | string | undefined => {
	if (!_existing) return _incoming
	if (!_incoming) return _existing

	// Normalize string references to TRef nodes
	let existing = unwrapResponseSchema(_existing, vendors)
	let incoming = unwrapResponseSchema(_incoming, vendors)

	if (!existing && !incoming) return undefined
	if (incoming && !existing) return incoming as any
	if (existing && !incoming) return existing as any

	// @ts-ignore
	if (isTSchema(existing) || existing?.['~standard'])
		existing = {
			200: existing as TSchema
		}

	// @ts-ignore
	if (isTSchema(incoming) || incoming?.['~standard'])
		incoming = {
			200: incoming as TSchema
		}

	const schema: Record<string, unknown> = {
		...incoming
	}

	for (const status of Object.keys(existing ?? {})) {
		const existingSchema = (existing as any)[status]
		const incomingSchema = (incoming as any)[status]

		if (existingSchema && incomingSchema)
			schema[status] = mergeSchemaProperty(
				existingSchema as TSchema,
				incomingSchema as TSchema,
				vendors
			)
		else if (existingSchema) schema[status] = existingSchema
		else if (incomingSchema) schema[status] = incomingSchema
	}

	// Both are status code objects, merge them
	return schema as any
}

/**
 * Merge standaloneValidator array into direct hook properties
 */
const mergeStandaloneValidators = (
	hooks: LocalHook<
		{},
		{
			response: {}
			return: {}
			resolve: {}
		},
		SingletonBase,
		{}
	> & {
		standaloneValidator?: InputSchema[]
	} & InputSchema,
	vendors?: MapJsonSchema
) => {
	const merged = { ...hooks }

	if (!hooks.standaloneValidator?.length) return merged

	for (const validator of hooks.standaloneValidator) {
		// Merge each schema property
		if (validator.body)
			merged.body = mergeSchemaProperty(
				merged.body as TSchema,
				validator.body as TSchema,
				vendors
			)

		if (validator.headers)
			merged.headers = mergeSchemaProperty(
				merged.headers as TSchema,
				validator.headers as TSchema,
				vendors
			)

		if (validator.query)
			merged.query = mergeSchemaProperty(
				merged.query as TSchema,
				validator.query as TSchema,
				vendors
			)

		if (validator.params)
			merged.params = mergeSchemaProperty(
				merged.params as TSchema,
				validator.params as TSchema,
				vendors
			)

		if (validator.cookie)
			merged.cookie = mergeSchemaProperty(
				merged.cookie as TSchema,
				validator.cookie as TSchema,
				vendors
			)

		if (validator.response)
			merged.response = mergeResponseSchema(
				merged.response as TSchema,
				validator.response as TSchema,
				vendors
			)
	}

	// Normalize any remaining string references in the final result
	if (typeof merged.body === 'string')
		merged.body = normalizeSchemaReference(merged.body)
	if (typeof merged.headers === 'string')
		merged.headers = normalizeSchemaReference(merged.headers)
	if (typeof merged.query === 'string')
		merged.query = normalizeSchemaReference(merged.query)
	if (typeof merged.params === 'string')
		merged.params = normalizeSchemaReference(merged.params)
	if (typeof merged.cookie === 'string')
		merged.cookie = normalizeSchemaReference(merged.cookie)
	if (merged.response && typeof merged.response !== 'string') {
		// Normalize string references in status code objects
		const response = merged.response as any
		if ('type' in response || '$ref' in response) {
			// It's a schema, not a status code object
			if (typeof response === 'string')
				merged.response = normalizeSchemaReference(response)
		} else {
			// It's a status code object, normalize each value
			for (const [status, schema] of Object.entries(response))
				if (typeof schema === 'string')
					response[status] = normalizeSchemaReference(schema)
		}
	}

	return merged
}

/**
 * Flatten routes by merging guard() schemas into direct hook properties.
 *
 * This makes guard() schemas accessible in the OpenAPI spec by converting
 * the standaloneValidator array into direct hook properties.
 */
const flattenRoutes = (routes: any[], vendors?: MapJsonSchema): any[] =>
	routes.map((route) => {
		if (!route.hooks?.standaloneValidator?.length) return route

		return {
			...route,
			hooks: mergeStandaloneValidators(route.hooks, vendors)
		}
	})

// ============================================================================

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

	return enumToOpenApi(schema) as any
}

export const unwrapSchema = (
	schema: InputSchema['body'],
	mapJsonSchema?: MapJsonSchema,
	io: 'input' | 'output' = 'input'
): OpenAPIV3.SchemaObject | undefined => {
	if (!schema) return

	if (typeof schema === 'string') schema = toRef(schema)
	if (Kind in schema) return enumToOpenApi(schema)

	if (Kind in schema || !schema?.['~standard']) return

	// @ts-ignore
	const vendor = schema['~standard'].vendor

	try {
		// @ts-ignore
		if (schema['~standard']?.jsonSchema?.[io])
		// @ts-ignore
			return schema['~standard']?.jsonSchema?.[io]?.()

		if (
			mapJsonSchema?.[vendor] &&
			typeof mapJsonSchema[vendor] === 'function'
		)
			return enumToOpenApi(mapJsonSchema[vendor](schema))

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
			return enumToOpenApi(schema?.toJsonSchema?.())

		return enumToOpenApi(
			// @ts-ignore
			schema.toJSONSchema?.() ?? schema?.toJsonSchema?.()
		)
	} catch (error) {
		console.warn(error)
	}
}

export const enumToOpenApi = <
	T extends
		| TAnySchema
		| OpenAPIV3.SchemaObject
		| OpenAPIV3.ReferenceObject
		| undefined
>(
	_schema: T
): T => {
	if (!_schema || typeof _schema !== 'object') return _schema

	if (Kind in _schema) {
		const schema = _schema as TAnySchema

		if (
			schema[Kind] === 'Union' &&
			schema.anyOf &&
			Array.isArray(schema.anyOf) &&
			schema.anyOf.length > 0 &&
			schema.anyOf.every(
				(item) =>
					item && typeof item === 'object' && item.const !== undefined
			)
		)
			return {
				type: 'string',
				enum: schema.anyOf.map((item) => item.const)
			} as any
	}

	const schema = _schema as OpenAPIV3.SchemaObject

	if (schema.type === 'object' && schema.properties) {
		const properties: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(schema.properties))
			properties[key] = enumToOpenApi(value)

		return {
			...schema,
			properties
		} as T
	}

	if (schema.type === 'array' && schema.items)
		return {
			...schema,
			items: enumToOpenApi(schema.items)
		} as T

	return schema as T
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

	if (references) {
		if (!Array.isArray(references)) references = [references]

		for (let i = 0; i < references.length; i++) {
			const reference = references[i]

			if (typeof reference === 'function') references[i] = reference()
		}
	}

	// Flatten routes to merge guard() schemas into direct hook properties
	// This makes guard schemas accessible for OpenAPI documentation generation
	// @ts-ignore private property
	const routes = flattenRoutes(app.getGlobalRoutes(), vendors)
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
							else if (
								typeof hooks.response !== 'object' ||
								(hooks.response as TSchema).type ||
								(hooks.response as TSchema).$ref ||
								(hooks.response as any)['~standard']
							)
								hooks.response = {
									200: hooks.response as any
								}

							if (
								!hooks.response[
									status as keyof (typeof hooks)['response']
								]
							)
								try {
									// @ts-ignore
									hooks.response[status] = schema
								} catch (error) {
									console.log(
										'[@elysiajs/openapi/gen] Failed to assigned response schema'
									)
									console.log(error)
								}
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
				for (const [name, schema] of Object.entries(params.properties))
					parameters.push({
						name,
						in: 'path',
						required: true, // Path parameters are always required
						schema
					})
		} else {
			for (const match of route.path.matchAll(/:([^/]+)/g)) {
				const name = match[1].replace('?', '')

				parameters.push({
					name,
					in: 'path',
					required: true,
					schema: { type: 'string' }
				})
			}
		}

		// Handle query parameters
		if (hooks.query) {
			const query = unwrapReference(
				unwrapSchema(hooks.query, vendors),
				definitions
			)

			if (query && query.type === 'object' && query.properties) {
				const required = query.required || []
				for (const [name, schema] of Object.entries(query.properties))
					parameters.push({
						name,
						in: 'query',
						required: required.includes(name),
						schema
					})
			}
		}

		// Handle header parameters
		if (hooks.headers) {
			const headers = unwrapReference(
				unwrapSchema(hooks.headers, vendors),
				definitions
			)

			if (headers && headers.type === 'object' && headers.properties) {
				const required = headers.required || []
				for (const [name, schema] of Object.entries(headers.properties))
					parameters.push({
						name,
						in: 'header',
						required: required.includes(name),
						schema
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
				for (const [name, schema] of Object.entries(cookie.properties))
					parameters.push({
						name,
						in: 'cookie',
						required: required.includes(name),
						schema
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
						required: true,
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
									}
					}
				}
			}
		}

		// Handle responses
		if (hooks.response) {
			operation.responses = {}

			if (
				typeof hooks.response === 'object' &&
				// TypeBox
				!(hooks.response as TSchema).type &&
				!(hooks.response as TSchema).$ref &&
				!(hooks.response as any)['~standard']
			) {
				for (let [status, schema] of Object.entries(hooks.response)) {
					const response = unwrapSchema(schema, vendors, 'output')

					if (!response) continue

					// @ts-ignore Must exclude $ref from root options
					const { type, description, $ref, ..._options } =
						unwrapReference(response, definitions)

					operation.responses[status] = {
						description:
							description ?? `Response for status ${status}`,
						content:
							type === 'void' ||
							type === 'null' ||
							type === 'undefined'
								? ({ type, description } as any)
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
				const response = unwrapSchema(hooks.response as any, vendors, 'output')

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
								? ({ type, description } as any)
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
			const operationId =
				hooks.detail?.operationId ?? toOperationId(route.method, path)

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
