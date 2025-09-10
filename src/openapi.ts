import { t, type AnyElysia, type TSchema, type InputSchema } from 'elysia'
import type { HookContainer } from 'elysia/types'

import type { OpenAPIV3 } from 'openapi-types'
import { Kind, type TProperties } from '@sinclair/typebox'

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

/**
 * Converts Elysia routes to OpenAPI 3.0.3 paths schema
 * @param routes Array of Elysia route objects
 * @returns OpenAPI paths object
 */
export function toOpenAPISchema(
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
				if(!reference) continue

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
			if (typeof hooks.params === 'string')
				hooks.params = toRef(hooks.params)

			if (hooks.params.type === 'object' && hooks.params.properties) {
				for (const [paramName, paramSchema] of Object.entries(
					hooks.params.properties
				))
					parameters.push({
						name: paramName,
						in: 'path',
						required: true, // Path parameters are always required
						schema: paramSchema
					})
			}
		}

		// Handle query parameters
		if (hooks.query) {
			if (typeof hooks.query === 'string')
				hooks.query = toRef(hooks.query)

			if (hooks.query.type === 'object' && hooks.query.properties) {
				const required = hooks.query.required || []
				for (const [queryName, querySchema] of Object.entries(
					hooks.query.properties
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
			if (typeof hooks.headers === 'string')
				hooks.headers = toRef(hooks.headers)

			if (hooks.headers.type === 'object' && hooks.headers.properties) {
				const required = hooks.headers.required || []
				for (const [headerName, headerSchema] of Object.entries(
					hooks.headers.properties
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
			if (typeof hooks.cookie === 'string')
				hooks.cookie = toRef(hooks.cookie)

			if (hooks.cookie.type === 'object' && hooks.cookie.properties) {
				const required = hooks.cookie.required || []
				for (const [cookieName, cookieSchema] of Object.entries(
					hooks.cookie.properties
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
			if (typeof hooks.body === 'string') hooks.body = toRef(hooks.body)

			// @ts-ignore
			if (hooks.parse) {
				const content: Record<string, { schema: TSchema }> = {}

				// @ts-ignore
				const parsers = hooks.parse as HookContainer[]

				for (const parser of parsers) {
					if (typeof parser.fn === 'function') continue

					switch (parser.fn) {
						case 'text':
						case 'text/plain':
							content['text/plain'] = { schema: hooks.body }
							continue

						case 'urlencoded':
						case 'application/x-www-form-urlencoded':
							content['application/x-www-form-urlencoded'] = {
								schema: hooks.body
							}
							continue

						case 'json':
						case 'application/json':
							content['application/json'] = { schema: hooks.body }
							continue

						case 'formdata':
						case 'multipart/form-data':
							content['multipart/form-data'] = {
								schema: hooks.body
							}
							continue
					}
				}

				operation.requestBody = { content, required: true }
			} else {
				operation.requestBody = {
					content: {
						'application/json': {
							schema: hooks.body
						},
						'application/x-www-form-urlencoded': {
							schema: hooks.body
						},
						'multipart/form-data': {
							schema: hooks.body
						}
					},
					required: true
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
					if (typeof schema === 'string') schema = toRef(schema)

					// Must exclude $ref from root options
					const { type, examples, $ref, ...options } = schema

					operation.responses[status] = {
						description: `Response for status ${status}`,
						...options,
						content:
							type === 'void' ||
							type === 'null' ||
							type === 'undefined'
								? schema
								: {
										'application/json': {
											schema
										}
									}
					}
				}
			} else {
				if (typeof hooks.response === 'string')
					hooks.response = toRef(hooks.response)

				// It's a single schema, default to 200
				operation.responses['200'] = {
					description: 'Successful response',
					content: {
						'application/json': {
							schema: hooks.response
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
	const schemas = app.getGlobalDefinitions?.().type

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
