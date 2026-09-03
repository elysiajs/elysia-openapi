import { t, type AnyElysia, type TSchema, type InputSchema } from 'elysia'
import type {
	HookContainer,
	LocalHook,
	RouteSchema,
	SingletonBase,
	StandardSchemaV1Like
} from 'elysia/types'

import type { OpenAPIV3, OpenAPIV3_2 } from '@scalar/openapi-types'
import { Kind, TAnySchema, type TObject } from '@sinclair/typebox'

import type {
	AdditionalReference,
	AdditionalReferences,
	ElysiaOpenAPIConfig,
	MapJsonSchema,
	OpenAPI32OperationObject,
	OpenAPIVersion
} from './types'

export const capitalize = (word: string) =>
	word.charAt(0).toUpperCase() + word.slice(1)

const toRef = (name: string) =>
	t.Ref(name.startsWith('#/') ? name : `#/components/schemas/${name}`)

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

const OPENAPI_HTTP_METHODS = new Set([
	'get',
	'post',
	'put',
	'delete',
	'patch',
	'head',
	'options',
	'trace'
])

const isOpenAPI32 = (version: OpenAPIVersion) =>
	version.startsWith('3.2.')

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
	return toRef(schema)
}

/**
 * Merge two schema properties (body, query, headers, params, cookie)
 */
const mergeSchemaProperty = (
	existing: TSchema | string | undefined,
	incoming: TSchema | string | undefined,
	vendors?: MapJsonSchema,
	openapiVersion: OpenAPIVersion = '3.1.2'
): TSchema | string | undefined => {
	if (!existing) return incoming
	if (!incoming) return existing

	// Normalize string references to TRef nodes so they can be merged
	let existingSchema = normalizeSchemaReference(existing)
	let incomingSchema = normalizeSchemaReference(incoming)

	if (!existingSchema) return incoming
	if (!incomingSchema) return existing

	if (!isTSchema(incomingSchema) && incomingSchema['~standard'])
		incomingSchema = unwrapSchema(
			incomingSchema,
			vendors,
			'input',
			openapiVersion
		) as any

	if (!isTSchema(existingSchema) && existingSchema['~standard'])
		existingSchema = unwrapSchema(
			existingSchema,
			vendors,
			'input',
			openapiVersion
		) as any

	if (!incomingSchema) return existingSchema
	if (!existingSchema) return incomingSchema

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
	vendors?: MapJsonSchema,
	openapiVersion: OpenAPIVersion = '3.1.2'
) =>
	typeof schema === 'string'
		? normalizeSchemaReference(schema)
		: !schema
			? undefined
			: isTSchema(schema)
				? schema
				: // @ts-ignore
					schema['~standard']
					? unwrapSchema(
							schema as any,
							vendors,
							'output',
							openapiVersion
						)
					: Object.fromEntries(
							Object.entries(schema).map(([status, schema]) => [
								status,
								typeof schema === 'string'
									? normalizeSchemaReference(schema)
									: isTSchema(schema)
										? schema
										: unwrapSchema(
												schema as any,
												vendors,
												'output',
												openapiVersion
											)
							])
						)

/**
 * Merge response schemas (handles status code objects)
 */
const mergeResponseSchema = (
	_existing: ResponseSchema,
	_incoming: ResponseSchema,
	vendors?: MapJsonSchema,
	openapiVersion: OpenAPIVersion = '3.1.2'
): TSchema | { [status: number]: TSchema | string } | string | undefined => {
	if (!_existing) return _incoming
	if (!_incoming) return _existing

	// Normalize string references to TRef nodes
	let existing = unwrapResponseSchema(_existing, vendors, openapiVersion)
	let incoming = unwrapResponseSchema(_incoming, vendors, openapiVersion)

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
				vendors,
				openapiVersion
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
	vendors?: MapJsonSchema,
	openapiVersion: OpenAPIVersion = '3.1.2'
) => {
	const merged = { ...hooks }

	if (!hooks.standaloneValidator?.length) return merged

	for (const validator of hooks.standaloneValidator) {
		// Merge each schema property
		if (validator.body)
			merged.body = mergeSchemaProperty(
				merged.body as TSchema,
				validator.body as TSchema,
				vendors,
				openapiVersion
			)

		if (validator.headers)
			merged.headers = mergeSchemaProperty(
				merged.headers as TSchema,
				validator.headers as TSchema,
				vendors,
				openapiVersion
			)

		if (validator.query)
			merged.query = mergeSchemaProperty(
				merged.query as TSchema,
				validator.query as TSchema,
				vendors,
				openapiVersion
			)

		if (validator.params)
			merged.params = mergeSchemaProperty(
				merged.params as TSchema,
				validator.params as TSchema,
				vendors,
				openapiVersion
			)

		if (validator.cookie)
			merged.cookie = mergeSchemaProperty(
				merged.cookie as TSchema,
				validator.cookie as TSchema,
				vendors,
				openapiVersion
			)

		if (validator.response)
			merged.response = mergeResponseSchema(
				merged.response as TSchema,
				validator.response as TSchema,
				vendors,
				openapiVersion
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
const flattenRoutes = (
	routes: any[],
	vendors?: MapJsonSchema,
	openapiVersion: OpenAPIVersion = '3.1.2'
): any[] =>
	routes.map((route) => {
		if (!route.hooks?.standaloneValidator?.length) return route

		return {
			...route,
			hooks: mergeStandaloneValidators(
				route.hooks,
				vendors,
				openapiVersion
			)
		}
	})

// ============================================================================

const unwrapReference = <T extends OpenAPIV3.SchemaObject | undefined>(
	schema: T,
	definitions: Record<string, unknown>,
	openapiVersion: OpenAPIVersion = '3.1.2'
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

	return nullToOpenApi(enumToOpenApi(schema), openapiVersion) as any
}

export const unwrapSchema = (
	schema: InputSchema['body'],
	mapJsonSchema?: MapJsonSchema,
	io: 'input' | 'output' = 'input',
	openapiVersion: OpenAPIVersion = '3.1.2'
): OpenAPIV3.SchemaObject | undefined => {
	if (!schema) return

	if (typeof schema === 'string') schema = toRef(schema)
	if (Kind in schema)
		return nullToOpenApi(enumToOpenApi(schema), openapiVersion)

	// Already unwrapped by merging standalone validators
	if (
		!schema?.['~standard'] &&
		// @ts-ignore
		(schema.$schema || schema.type || schema.properties || schema.items)
	)
		return nullToOpenApi(schema as OpenAPIV3.SchemaObject, openapiVersion)

	if (!schema?.['~standard']) return

	const standard = schema['~standard'] as any
	const vendor = standard.vendor

	try {
		const jsonSchemaTarget = openapiVersion.startsWith('3.0.')
			? 'draft-07'
			: 'draft-2020-12'

		if (
			mapJsonSchema?.[vendor] &&
			typeof mapJsonSchema[vendor] === 'function'
		)
			return nullToOpenApi(
				enumToOpenApi(mapJsonSchema[vendor](schema)),
				openapiVersion
			)

		if (standard.jsonSchema?.[io])
			return nullToOpenApi(
				enumToOpenApi(
					standard.jsonSchema[io]({
						target: jsonSchemaTarget
					})
				),
				openapiVersion
			)

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
			return nullToOpenApi(
				enumToOpenApi((schema as any).toJsonSchema?.()),
				openapiVersion
			)

		return nullToOpenApi(
			enumToOpenApi(
				// @ts-ignore
				schema.toJSONSchema?.() ?? schema?.toJsonSchema?.()
			),
			openapiVersion
		)
	} catch (error) {
		console.warn(error)
	}
}

/**
 * Convert TypeBox enum-like Union schemas to OpenAPI enum schemas
 *
 * Otherwise, return the schema as is
 */
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

	// TypeBox's t.Date() serialises to anyOf: [{"type":"Date"}, ...].
	// "Date" is not a valid OpenAPI 3.0 type; replace it with
	// {"type":"string","format":"date-time"} which is what Elysia actually
	// serialises Date instances to on the wire.  Use replace (not filter) so
	// that nullable dates � t.Nullable(t.Date()) � keep their {"type":"null"}
	// sibling instead of collapsing to null-only.
	if (schema.anyOf && Array.isArray(schema.anyOf)) {
		const mapped = schema.anyOf.map((item) =>
			item &&
			typeof item === 'object' &&
			(item as Record<string, unknown>).type === 'Date'
				? { type: 'string', format: 'date-time' }
				: enumToOpenApi(item)
		)
		// Deduplicate: after the replacement above the anyOf may contain two
		// identical date-time entries because t.Date() already included one.
		// Compare by canonical (sorted-key) JSON to catch different key orderings.
		const seen = new Set<string>()
		const deduped = mapped.filter((item) => {
			if (!item || typeof item !== 'object') return true
			const key = JSON.stringify(
				Object.fromEntries(
					Object.entries(item as object).sort(([a], [b]) =>
						a < b ? -1 : a > b ? 1 : 0
					)
				)
			)
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
		if (deduped.length === 1) return deduped[0] as T
		return { ...schema, anyOf: deduped } as T
	}

	return schema as T
}

const SCHEMA_MAP_KEYS = new Set([
	'properties',
	'patternProperties',
	'$defs',
	'definitions',
	'dependentSchemas'
])
const SCHEMA_ARRAY_KEYS = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems'])
const SCHEMA_VALUE_KEYS = new Set([
	'items',
	'additionalProperties',
	'unevaluatedProperties',
	'contains',
	'not',
	'if',
	'then',
	'else',
	'propertyNames'
])

const isSchemaObject = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value)

export const nullToOpenApi = <T>(
	schema: T,
	openapiVersion: OpenAPIVersion
): T => {
	const normalize = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(normalize)
		if (!isSchemaObject(value)) return value

		const normalized = { ...value }
		const isOpenAPI30 = openapiVersion.startsWith('3.0.')

		for (const unionKey of ['anyOf', 'oneOf'] as const) {
			const union = normalized[unionKey]
			if (!Array.isArray(union)) continue

			const nonNull = union.filter(
				(item) => !isSchemaObject(item) || item.type !== 'null'
			)
			if (nonNull.length === union.length) continue

			const normalizedNonNull = nonNull.map(normalize)
			if (isOpenAPI30) {
				delete normalized[unionKey]
				if (
					normalizedNonNull.length === 1 &&
					isSchemaObject(normalizedNonNull[0])
				)
					Object.assign(normalized, normalizedNonNull[0])
				else if (normalizedNonNull.length)
					normalized[unionKey] = normalizedNonNull
				normalized.nullable = true
			} else if (
				normalizedNonNull.length === 1 &&
				isSchemaObject(normalizedNonNull[0]) &&
				typeof normalizedNonNull[0].type === 'string'
			) {
				delete normalized[unionKey]
				Object.assign(normalized, normalizedNonNull[0])
				normalized.type = [normalizedNonNull[0].type, 'null']
			} else normalized[unionKey] = union.map(normalize)
		}

		if (isOpenAPI30 && normalized.type === 'null') {
			delete normalized.type
			normalized.nullable = true
		} else if (
			isOpenAPI30 &&
			Array.isArray(normalized.type) &&
			normalized.type.includes('null')
		) {
			const types = normalized.type.filter((type) => type !== 'null')
			normalized.nullable = true
			if (types.length === 1) normalized.type = types[0]
			else if (types.length) normalized.type = types
			else delete normalized.type
		}

		for (const [key, nested] of Object.entries(normalized)) {
			if (SCHEMA_MAP_KEYS.has(key) && isSchemaObject(nested))
				normalized[key] = Object.fromEntries(
					Object.entries(nested).map(([name, child]) => [
						name,
						normalize(child)
					])
				)
			else if (SCHEMA_ARRAY_KEYS.has(key) && Array.isArray(nested))
				normalized[key] = nested.map(normalize)
			else if (SCHEMA_VALUE_KEYS.has(key) && isSchemaObject(nested))
				normalized[key] = normalize(nested)
			else if (key === 'dependencies' && isSchemaObject(nested))
				normalized[key] = Object.fromEntries(
					Object.entries(nested).map(([name, child]) => [
						name,
						isSchemaObject(child) ? normalize(child) : child
					])
				)
		}

		return normalized
	}

	return normalize(schema) as T
}

const toResponseHeaders = (
	schema: InputSchema['body'],
	vendors?: MapJsonSchema,
	openapiVersion: OpenAPIVersion = '3.1.2'
): Record<string, OpenAPIV3.HeaderObject> | undefined => {
	if (
		!schema ||
		typeof schema === 'string' ||
		!('headers' in schema) ||
		!schema.headers
	)
		return

	const entries = Object.entries(
		schema.headers as Record<string, InputSchema['headers']>
	)
		.map(
			([name, hs]) =>
				[
					name,
					{
						schema: unwrapSchema(
							hs as any,
							vendors,
							'output',
							openapiVersion
						)
					}
				] as const
		)
		.filter(([, v]) => v.schema)

	return entries.length ? Object.fromEntries(entries) : undefined
}

const stripHeaders = (
	schema: OpenAPIV3.SchemaObject & { headers?: unknown }
): OpenAPIV3.SchemaObject => {
	const { headers, ...rest } = schema
	return rest
}

const VOID_TYPES = new Set(['void', 'null', 'undefined'])
const PLAIN_TYPES = new Set(['string', 'number', 'integer', 'boolean'])

const toResponseContent = (
	schema: OpenAPIV3.SchemaObject,
	type: string | undefined,
	description: string | undefined
) =>
	VOID_TYPES.has(type!)
		? ({ type, description } as any)
		: PLAIN_TYPES.has(type!)
			? { 'text/plain': { schema } }
			: { 'application/json': { schema } }

const toResponseObject = (
	schema: InputSchema['body'],
	status: string,
	definitions: Record<string, unknown>,
	vendors?: MapJsonSchema,
	openapiVersion: OpenAPIVersion = '3.1.2'
): OpenAPIV3.ResponseObject | undefined => {
	const response = unwrapSchema(schema, vendors, 'output', openapiVersion)
	if (!response) return

	const responseSchema = stripHeaders(response)

	// @ts-ignore Must exclude $ref from root options
	const { type, description } = unwrapReference(
		responseSchema,
		definitions,
		openapiVersion
	)
	const headers = toResponseHeaders(schema, vendors, openapiVersion)

	return {
		description: description ?? `Response for status ${status}`,
		...(headers ? { headers } : {}),
		content: toResponseContent(responseSchema, type, description)
	}
}

/**
 * Converts Elysia routes to OpenAPI paths schema
 * @param routes Array of Elysia route objects
 * @returns OpenAPI paths object
 */
export function toOpenAPISchema(
	app: AnyElysia,
	exclude?: ElysiaOpenAPIConfig['exclude'],
	references?: AdditionalReferences,
	vendors?: MapJsonSchema,
	openapiVersion: OpenAPIVersion = '3.1.2'
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

	const paths: OpenAPIV3_2.PathsObject = Object.create(null)
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
	const routes = flattenRoutes(app.getGlobalRoutes(), vendors, openapiVersion)
	for (const route of routes) {
		if (route.hooks?.detail?.hide) continue

		const rawMethod = String(route.method)
		const method = rawMethod.toLowerCase()
		const supportsOpenAPI32 = isOpenAPI32(openapiVersion)
		const isOpenAPI32Method = supportsOpenAPI32 && method === 'query'
		const isAdditionalOperation =
			supportsOpenAPI32 &&
			method !== 'all' &&
			method !== 'ws' &&
			!OPENAPI_HTTP_METHODS.has(method) &&
			!isOpenAPI32Method

		if (
			(method !== 'all' &&
				!OPENAPI_HTTP_METHODS.has(method) &&
				!isOpenAPI32Method &&
				!isAdditionalOperation) ||
			(excludeStaticFile && route.path.includes('.')) ||
			excludePaths.some((exclusion) => {
				if (exclusion instanceof RegExp) {
					exclusion.lastIndex = 0
					return exclusion.test(route.path)
				}
				if (typeof exclusion === 'string')
					return exclusion === route.path
				return false
			}) ||
			excludeMethods.includes(method)
		)
			continue

		const hooks: InputSchema & {
			detail: Partial<OpenAPI32OperationObject>
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
			hooks.detail.tags?.some((tag: string) => excludeTags?.includes(tag))
		)
			continue

		// Start building the operation object
		const operation: Partial<OpenAPI32OperationObject> = {
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
				unwrapSchema(hooks.params, vendors, 'input', openapiVersion),
				definitions,
				openapiVersion
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
				unwrapSchema(hooks.query, vendors, 'input', openapiVersion),
				definitions,
				openapiVersion
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
				unwrapSchema(hooks.headers, vendors, 'input', openapiVersion),
				definitions,
				openapiVersion
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
				unwrapSchema(hooks.cookie, vendors, 'input', openapiVersion),
				definitions,
				openapiVersion
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
			const body = unwrapSchema(
				hooks.body,
				vendors,
				'input',
				openapiVersion
			)

			if (body) {
				// @ts-ignore
				const { type, description, $ref, ...options } = unwrapReference(
					body,
					definitions,
					openapiVersion
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

							case 'arrayBuffer':
							case 'application/octet-stream':
								content['application/octet-stream'] = {
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
				!(Kind in (hooks.response as object)) &&
				!(hooks.response as TSchema).type &&
				!(hooks.response as TSchema).$ref &&
				!(hooks.response as any)['~standard']
			) {
				for (let [status, schema] of Object.entries(hooks.response)) {
					const response = toResponseObject(
						schema,
						status,
						definitions,
						vendors,
						openapiVersion
					)

					if (response) operation.responses[status] = response
				}
			} else {
				const response = toResponseObject(
					hooks.response as InputSchema['body'],
					'200',
					definitions,
					vendors,
					openapiVersion
				)

				if (response) operation.responses['200'] = response
			}
		}

		for (let path of getPossiblePath(route.path)) {
			const operationId =
				hooks.detail?.operationId ?? toOperationId(route.method, path)

			path = path.replace(/:([^/]+)/g, '{$1}')

			if (!paths[path]) paths[path] = {}

			const current = paths[path] as any

			if (method !== 'all') {
				const describedOperation = {
					...operation,
					operationId
				}

				if (isAdditionalOperation) {
					current.additionalOperations ??= {}
					current.additionalOperations[rawMethod] = describedOperation
				} else current[method] = describedOperation

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
				'trace',
				...(supportsOpenAPI32 ? ['query'] : [])
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
			const jsonSchema = unwrapSchema(
				schema as any,
				vendors,
				'input',
				openapiVersion
			) as OpenAPIV3.SchemaObject | undefined

			if (jsonSchema) schemas[name] = jsonSchema
		}

	return {
		components: {
			schemas
		},
		paths
	} satisfies Pick<OpenAPIV3_2.Document, 'paths' | 'components'>
}

type ResponseHeaderSchemas = Record<
	string,
	Exclude<InputSchema['headers'], undefined>
>

export const withHeaders = <
	S extends Exclude<InputSchema['body'], string | undefined>,
	H extends ResponseHeaderSchemas
>(
	schema: S,
	headers: H
) => {
	const clone = Object.create(
		Object.getPrototypeOf(schema),
		Object.getOwnPropertyDescriptors(schema)
	) as S & { headers: H }

	Object.defineProperty(clone, 'headers', {
		value: headers,
		enumerable: true,
		configurable: true,
		writable: true
	})

	return clone
}
