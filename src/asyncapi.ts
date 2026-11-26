import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

import { capitalize, type toOpenAPISchema } from './openapi'
import type { ElysiaOpenAPIConfig } from './types'

type Documentation = NonNullable<ElysiaOpenAPIConfig['documentation']> & {
	info: OpenAPIV3_1.InfoObject
}

const serverRegex = /^(\w+):\/\/([^/]+)(\/.*)?$/
const pathParamRegex = /{([^}]+)}/g
const schemaRefRegex = /"#\/components\/schemas\/([^"]+)"/g

const mapSecurityScheme = (
	scheme: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SecuritySchemeObject
) => {
	if ('$ref' in scheme) return scheme

	if (scheme.type === 'apiKey') return { ...scheme, type: 'httpApiKey' }
	if (scheme.type !== 'oauth2') return scheme

	const flows: Record<string, unknown> = {}
	for (const [name, { scopes, ...flow }] of Object.entries(scheme.flows))
		flows[name] = { ...flow, availableScopes: scopes }

	return { ...scheme, flows }
}

const parseServer = ({
	url,
	description,
	variables
}: OpenAPIV3.ServerObject) => {
	const [, protocol, host, pathname] = url.match(serverRegex) ?? []
	if (!host) return

	return {
		host,
		protocol: protocol === 'https' || protocol === 'wss' ? 'wss' : 'ws',
		pathname: pathname === '/' ? undefined : pathname,
		description,
		variables
	}
}

const getPayload = (body?: object) =>
	Object.values(
		(body as OpenAPIV3.ResponseObject | undefined)?.content ?? {}
	)[0]?.schema

const getBinding = (
	parameters: OpenAPIV3.ParameterObject[],
	location: 'query' | 'header'
) => {
	const properties: Record<string, unknown> = {}
	const required: string[] = []

	for (const parameter of parameters) {
		if (parameter.in !== location) continue

		properties[parameter.name] = parameter.schema
		if (parameter.required) required.push(parameter.name)
	}

	if (!Object.keys(properties).length) return

	return { type: 'object', properties, required }
}

export function createAsyncAPISchema(
	{ paths, components: { schemas } }: ReturnType<typeof toOpenAPISchema>,
	{
		info: { summary, license, ...info },
		servers = [],
		tags,
		security,
		components
	}: Documentation
) {
	const securitySchemes: Record<string, unknown> = Object.create(null)
	for (const [name, scheme] of Object.entries(
		components?.securitySchemes ?? {}
	))
		securitySchemes[name] = mapSecurityScheme(scheme)

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

		const body = getPayload(ws.requestBody)
		const response = getPayload(ws.responses?.['200'])

		// Scalar hides a channel without an operation
		if (body || !response) addOperation('receive', 'client', body)
		if (response) addOperation('send', 'server', response)

		const channelParameters: Record<string, unknown> = {}
		for (const [, name] of address.matchAll(pathParamRegex))
			channelParameters[name] = {
				description: (
					parameters.find((x) => x.in === 'path' && x.name === name)
						?.schema as OpenAPIV3.SchemaObject | undefined
				)?.description
			}

		const query = getBinding(parameters, 'query')
		const headers = getBinding(parameters, 'header')

		channels[id] = {
			address,
			summary: ws.summary,
			description: ws.description,
			tags: ws.tags?.map((name) => ({ name })),
			messages,
			parameters: channelParameters,
			bindings: query || headers ? { ws: { query, headers } } : undefined
		}
	}

	const allSchemas = { ...schemas, ...components?.schemas }
	const usedSchemas: Record<string, unknown> = Object.create(null)

	const collectSchemas = (value: unknown) => {
		for (const [, name] of JSON.stringify(value).matchAll(schemaRefRegex))
			if (name in allSchemas && !(name in usedSchemas)) {
				usedSchemas[name] = allSchemas[name]
				collectSchemas(allSchemas[name])
			}
	}

	collectSchemas(channels)

	const asyncServers: Record<string, unknown> = {}
	for (let i = 0; i < servers.length; i++) {
		const server = parseServer(servers[i])
		if (server) asyncServers[`server${i + 1}`] = server
	}

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
		servers: asyncServers,
		channels,
		operations,
		components: { schemas: usedSchemas, securitySchemes }
	}
}
