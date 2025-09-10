import { t, type AnyElysia, type TSchema, type InputSchema } from 'elysia'
import type { HookContainer, StandardSchemaV1Like } from 'elysia/types'

import type { OpenAPIV3 } from 'openapi-types'
import { Kind, type TProperties } from '@sinclair/typebox'

import { toJsonSchema } from 'xsschema'

import type {
	AdditionalReference,
	AdditionalReferences,
	ElysiaOpenAPIConfig
} from './types'

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

type MaybePromise<T> = T | Promise<T>

export const unwrapSchema = (
	schema: InputSchema['body']
): MaybePromise<OpenAPIV3.SchemaObject | undefined> => {
	if (!schema) return

	if (typeof schema === 'string') schema = toRef(schema)
	if (Kind in schema) return schema

	if (Kind in schema === false && schema['~standard'])
		return toJsonSchema(schema as any) as Promise<OpenAPIV3.SchemaObject>
}

/**
 * Converts Elysia routes to OpenAPI 3.0.3 paths schema
 * @param routes Array of Elysia route objects
 * @returns OpenAPI paths object
 */
export async function toOpenAPISchema(
	app: AnyElysia,
	exclude?: ElysiaOpenAPIConfig['exclude'],
	references?: AdditionalReferences
) {
	const {
		methods: excludeMethods = ['OPTIONS'],
		staticFile: excludeStaticFile = true,
		tags: excludeTags
	} = exclude ?? {}

	const excludePaths = Array.isArray(exclude?.paths)
		? exclude.paths
		: typeof exclude?.paths !== 'undefined'
			? [exclude.paths]
			: []

	const paths: OpenAPIV3.PathsObject = Object.create(null)

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

		if (references)
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
			let params = unwrapSchema(hooks.params)
			if (params) params = await params

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
			let query = unwrapSchema(hooks.query)
			if (query) query = await query

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
			let headers = unwrapSchema(hooks.query)
			if (headers) headers = await headers

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
			let cookie = unwrapSchema(hooks.cookie)
			if (cookie) cookie = await cookie

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
			let body = unwrapSchema(hooks.body)
			if (body) body = await body

			if (body) {
				// @ts-ignore
				const { type: _type, description, ...options } = body
				const type = _type as string | undefined

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
										'text/plain': body
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
					let response = unwrapSchema(schema)
					if (response) response = await response

					if (!response) continue

					// @ts-ignore Must exclude $ref from root options
					const { type: _type, description, ...options } = response
					const type = _type as string | undefined

					operation.responses[status] = {
						description:
							description ?? `Response for status ${status}`,
						...options,
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
				let response = unwrapSchema(hooks.response as any)
				if (response) response = await response

				if (response) {
					// @ts-ignore
					const { type: _type, description, ...options } = response
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
	const _schemas = app.getGlobalDefinitions?.().type

	const schemas = Object.create(null)

	if (_schemas)
		for (const [name, schema] of Object.entries(_schemas)) {
			let jsonSchema = unwrapSchema(schema as any) as
				| OpenAPIV3.SchemaObject
				| undefined

			if (jsonSchema instanceof Promise) jsonSchema = await jsonSchema

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
