import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

import { capitalize, type toOpenAPISchema } from './openapi'
import type { ElysiaOpenAPIConfig } from './types'

type Documentation = NonNullable<ElysiaOpenAPIConfig['documentation']> & {
	info: OpenAPIV3_1.InfoObject
}

const toSecurityScheme = (
	scheme: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SecuritySchemeObject
) => {
	if ('$ref' in scheme) return scheme

	switch (scheme.type) {
		case 'apiKey':
			return { ...scheme, type: 'httpApiKey' }

		case 'oauth2':
			return {
				...scheme,
				flows: Object.fromEntries(
					Object.entries(scheme.flows).map(
						([name, { scopes, ...flow }]) => [
							name,
							{ ...flow, availableScopes: scopes }
						]
					)
				)
			}

		default:
			return scheme
	}
}

const toServer = ({ url, description, variables }: OpenAPIV3.ServerObject) => {
	const [, protocol, host, pathname] =
		url.match(/^(\w+):\/\/([^/]+)(\/.*)?$/) ?? []

	if (!host) return

	return {
		host,
		protocol: protocol === 'https' || protocol === 'wss' ? 'wss' : 'ws',
		pathname: pathname === '/' ? undefined : pathname,
		description,
		variables
	}
}

const toPayload = (body?: object) =>
	Object.values(
		(body as OpenAPIV3.ResponseObject | undefined)?.content ?? {}
	)[0]?.schema

export const toAsyncAPISchema = (
	{ paths, components: { schemas } }: ReturnType<typeof toOpenAPISchema>,
	{
		info: { summary, license, ...info },
		servers = [],
		tags,
		security,
		components
	}: Documentation
) => {
	const securitySchemes = Object.fromEntries(
		Object.entries(components?.securitySchemes ?? {}).map(
			([name, scheme]) => [name, toSecurityScheme(scheme)]
		)
	)

	const channels: Record<string, unknown> = Object.create(null)
	const operations: Record<string, unknown> = {}

	for (const [address, item] of Object.entries(paths)) {
		const ws: OpenAPIV3.OperationObject | undefined = (item as any).ws
		if (!ws) continue

		const operationId = ws.operationId!.replace(/[^\w.-]/g, '_')

		let id = operationId
		for (let i = 2; id in channels; i++) id = operationId + i

		const parameters = (ws.parameters ?? []) as OpenAPIV3.ParameterObject[]
		const messages: Record<string, unknown> = {}

		const toBinding = (location: 'query' | 'header') => {
			const fields = parameters.filter((x) => x.in === location)
			if (!fields.length) return

			return {
				type: 'object',
				properties: Object.fromEntries(
					fields.map((x) => [x.name, x.schema])
				),
				required: fields.filter((x) => x.required).map((x) => x.name)
			}
		}

		const addOperation = (
			action: 'send' | 'receive',
			sender: 'client' | 'server',
			payload: unknown
		) => {
			const message = `${sender}Message`
			if (payload) messages[message] = { payload }

			operations[id + capitalize(action)] = {
				action,
				summary: `Message from the ${sender}`,
				channel: { $ref: `#/channels/${id}` },
				messages: payload
					? [{ $ref: `#/channels/${id}/messages/${message}` }]
					: undefined,
				security: (ws.security ?? security)
					?.flatMap(Object.keys)
					.filter((name) => name in securitySchemes)
					.map((name) => ({
						$ref: `#/components/securitySchemes/${name}`
					}))
			}
		}

		const body = toPayload(ws.requestBody)
		const response = toPayload(ws.responses?.['200'])

		// Scalar hides a channel without an operation
		if (body || !response) addOperation('receive', 'client', body)
		if (response) addOperation('send', 'server', response)

		const query = toBinding('query')
		const headers = toBinding('header')

		channels[id] = {
			address,
			summary: ws.summary,
			description: ws.description,
			tags: ws.tags?.map((name) => ({ name })),
			messages,
			parameters: Object.fromEntries(
				[...address.matchAll(/{([^}]+)}/g)].map(([, name]) => [
					name,
					{
						description: (
							parameters.find(
								(x) => x.in === 'path' && x.name === name
							)?.schema as OpenAPIV3.SchemaObject
						)?.description
					}
				])
			),
			bindings: query || headers ? { ws: { query, headers } } : undefined
		}
	}

	const allSchemas = { ...schemas, ...components?.schemas }
	const usedSchemas: Record<string, unknown> = Object.create(null)
	const collectSchemas = (value: unknown) => {
		for (const [, name] of JSON.stringify(value).matchAll(
			/"#\/components\/schemas\/([^"]+)"/g
		))
			if (name in allSchemas && !(name in usedSchemas)) {
				usedSchemas[name] = allSchemas[name]
				collectSchemas(allSchemas[name])
			}
	}
	collectSchemas(channels)

	return {
		asyncapi: '3.0.0',
		info: {
			...info,
			license: license && { name: license.name, url: license.url },
			tags: tags?.filter(({ name }) =>
				Object.values(paths).some((item: any) =>
					item.ws?.tags?.includes(name)
				)
			)
		},
		servers: Object.fromEntries(
			servers.flatMap((server, index) => {
				const converted = toServer(server)
				return converted ? [[`server${index + 1}`, converted]] : []
			})
		),
		channels,
		operations,
		components: { schemas: usedSchemas, securitySchemes }
	}
}
