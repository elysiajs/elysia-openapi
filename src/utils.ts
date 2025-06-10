/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { normalize } from 'pathe'
import { replaceSchemaType, t, type HTTPMethod, type LocalHook } from 'elysia'

import { Kind, type TSchema } from '@sinclair/typebox'
import type { OpenAPIV3 } from 'openapi-types'

export const toOpenAPIPath = (path: string) =>
	path
		.split('/')
		.map((x) => {
			if (x.startsWith(':')) {
				x = x.slice(1, x.length)
				if (x.endsWith('?')) x = x.slice(0, -1)
				x = `{${x}}`
			}

			return x
		})
		.join('/')

export const mapProperties = (
	name: string,
	schema: TSchema | string | undefined,
	models: Record<string, TSchema>
) => {
	if (schema === undefined) return []

	if (typeof schema === 'string')
		if (schema in models) schema = models[schema]
		else throw new Error(`Can't find model ${schema}`)

	return Object.entries(schema?.properties ?? []).map(([key, value]) => {
		const {
			type: valueType = undefined,
			description,
			examples,
			...schemaKeywords
		} = value as any
		return {
			// @ts-ignore
			description,
			examples,
			schema: { type: valueType, ...schemaKeywords },
			in: name,
			name: key,
			// @ts-ignore
			required: schema!.required?.includes(key) ?? false
		}
	})
}

const mapTypesResponse = (
	types: string[],
	schema:
		| string
		| {
				type: string
				properties: Object
				required: string[]
		  }
) => {
	if (
		typeof schema === 'object' &&
		['void', 'undefined', 'null'].includes(schema.type)
	)
		return

	const responses: Record<string, OpenAPIV3.MediaTypeObject> = {}

	for (const type of types) {
		responses[type] = {
			schema:
				typeof schema === 'string'
					? {
							$ref: `#/components/schemas/${schema}`
						}
					: '$ref' in schema &&
						  Kind in schema &&
						  schema[Kind] === 'Ref'
						? {
								...schema,
								$ref: `#/components/schemas/${schema.$ref}`
							}
						: replaceSchemaType(
								{ ...(schema as any) },
								{
									from: t.Ref(''),
									// @ts-expect-error
									to: ({ $ref, ...options }) => {
										if (
											!$ref.startsWith(
												'#/components/schemas/'
											)
										)
											return t.Ref(
												`#/components/schemas/${$ref}`,
												options
											)

										return t.Ref($ref, options)
									}
								}
							)
		}
	}

	return responses
}

export const capitalize = (word: string) =>
	word.charAt(0).toUpperCase() + word.slice(1)

export const generateOperationId = (method: string, paths: string) => {
	let operationId = method.toLowerCase()

	if (paths === '/') return operationId + 'Index'

	for (const path of paths.split('/')) {
		if (path.charCodeAt(0) === 123) {
			operationId += 'By' + capitalize(path.slice(1, -1))
		} else {
			operationId += capitalize(path)
		}
	}

	return operationId
}

const cloneHook = <T>(hook: T) => {
	if (!hook) return
	if (typeof hook === 'string') return hook
	if (Array.isArray(hook)) return [...hook]
	return { ...hook }
}

export const registerSchemaPath = ({
	schema,
	path,
	method,
	hook,
	models
}: {
	schema: Partial<OpenAPIV3.PathsObject>
	contentType?: string | string[]
	path: string
	method: HTTPMethod
	hook?: LocalHook<any, any, any, any, any, any>
	models: Record<string, TSchema>
}) => {
	hook = cloneHook(hook)

	if (hook.parse && !Array.isArray(hook.parse)) hook.parse = [hook.parse]

	let contentType = (hook.parse as unknown[])
		?.map((x) => {
			switch (typeof x) {
				case 'string':
					return x

				case 'object':
					if (
						x &&
						typeof (x as { fn: string | Function })?.fn !== 'string'
					)
						return

					switch ((x as { fn: string | Function })?.fn) {
						case 'json':
						case 'application/json':
							return 'application/json'

						case 'text':
						case 'text/plain':
							return 'text/plain'

						case 'urlencoded':
						case 'application/x-www-form-urlencoded':
							return 'application/x-www-form-urlencoded'

						case 'arrayBuffer':
						case 'application/octet-stream':
							return 'application/octet-stream'

						case 'formdata':
						case 'multipart/form-data':
							return 'multipart/form-data'
					}
			}
		})
		.filter((x) => x !== undefined)

	if (!contentType || contentType.length === 0)
		contentType = ['application/json', 'multipart/form-data', 'text/plain']

	path = toOpenAPIPath(path)

	const contentTypes =
		typeof contentType === 'string'
			? [contentType]
			: (contentType ?? ['application/json'])

	const bodySchema = cloneHook(hook?.body)
	const paramsSchema = cloneHook(hook?.params)
	const headerSchema = cloneHook(hook?.headers)
	const querySchema = cloneHook(hook?.query)
	let responseSchema: OpenAPIV3.ResponsesObject = cloneHook(hook?.response)

	if (typeof responseSchema === 'object') {
		if (Kind in responseSchema) {
			const {
				type,
				properties,
				required,
				additionalProperties,
				patternProperties,
				$ref,
				...rest
			} = responseSchema as typeof responseSchema & {
				type: string
				properties: Object
				required: string[]
			}

			responseSchema = {
				'200': {
					...rest,
					description: rest.description as any,
					content: mapTypesResponse(
						contentTypes,
						type === 'object' || type === 'array'
							? ({
									type,
									properties,
									patternProperties,
									items: responseSchema.items,
									required
								} as any)
							: responseSchema
					)
				}
			}
		} else {
			Object.entries(responseSchema as Record<string, TSchema>).forEach(
				([key, value]) => {
					if (typeof value === 'string') {
						if (!models[value]) return

						// eslint-disable-next-line @typescript-eslint/no-unused-vars
						const {
							type,
							properties,
							required,
							additionalProperties: _1,
							patternProperties: _2,
							...rest
						} = models[value] as TSchema & {
							type: string
							properties: Object
							required: string[]
						}

						responseSchema[key] = {
							...rest,
							description: rest.description as any,
							content: mapTypesResponse(contentTypes, value)
						}
					} else {
						const {
							type,
							properties,
							required,
							additionalProperties,
							patternProperties,
							...rest
						} = value as typeof value & {
							type: string
							properties: Object
							required: string[]
						}

						responseSchema[key] = {
							...rest,
							description: rest.description as any,
							content: mapTypesResponse(
								contentTypes,
								type === 'object' || type === 'array'
									? ({
											type,
											properties,
											patternProperties,
											items: value.items,
											required
										} as any)
									: value
							)
						}
					}
				}
			)
		}
	} else if (typeof responseSchema === 'string') {
		if (!(responseSchema in models)) return

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const {
			type,
			properties,
			required,
			$ref,
			additionalProperties: _1,
			patternProperties: _2,
			...rest
		} = models[responseSchema] as TSchema & {
			type: string
			properties: Object
			required: string[]
		}

		responseSchema = {
			// @ts-ignore
			'200': {
				...rest,
				content: mapTypesResponse(contentTypes, responseSchema)
			}
		}
	}

	const parameters = [
		...mapProperties('header', headerSchema, models),
		...mapProperties('path', paramsSchema, models),
		...mapProperties('query', querySchema, models)
	]

	schema[path] = {
		...(schema[path] ? schema[path] : {}),
		[method.toLowerCase()]: {
			...((headerSchema || paramsSchema || querySchema || bodySchema
				? ({ parameters } as any)
				: {}) satisfies OpenAPIV3.ParameterObject),
			...(responseSchema
				? {
						responses: responseSchema
					}
				: {}),
			operationId:
				hook?.detail?.operationId ?? generateOperationId(method, path),
			...hook?.detail,
			...(bodySchema
				? {
						requestBody: {
							required: true,
							content: mapTypesResponse(
								contentTypes,
								typeof bodySchema === 'string' && bodySchema.slice(-2) === '[]'
									? {
										type: 'array',
										items: {
											$ref: `#/components/schemas/${bodySchema.slice(0, -2)}`
										}
									}
								: typeof bodySchema === 'string'
									? {
											$ref: `#/components/schemas/${bodySchema}`
										}
									: (bodySchema as any)
							)
						}
					}
				: null)
		} satisfies OpenAPIV3.OperationObject
	}
}

export const filterPaths = (
	paths: Record<string, any>,
	{
		excludeStaticFile = true,
		exclude = []
	}: {
		excludeStaticFile: boolean
		exclude: (string | RegExp)[]
	}
) => {
	const newPaths: Record<string, any> = {}

	for (const [key, value] of Object.entries(paths))
		if (
			!exclude.some((x) => {
				if (typeof x === 'string') return key === x

				return x.test(key)
			}) &&
			!key.includes('*') &&
			(excludeStaticFile ? !key.includes('.') : true)
		) {
			Object.keys(value).forEach((method) => {
				const schema = value[method]

				if (key.includes('{')) {
					if (!schema.parameters) schema.parameters = []

					schema.parameters = [
						...key
							.split('/')
							.filter(
								(x) =>
									x.startsWith('{') &&
									!schema.parameters.find(
										(params: Record<string, any>) =>
											params.in === 'path' &&
											params.name ===
												x.slice(1, x.length - 1)
									)
							)
							.map((x) => ({
								schema: { type: 'string' },
								in: 'path',
								name: x.slice(1, x.length - 1),
								required: true
							})),
						...schema.parameters
					]
				}

				if (!schema.responses)
					schema.responses = {
						200: {}
					}
			})

			newPaths[key] = value
		}

	return newPaths
}
