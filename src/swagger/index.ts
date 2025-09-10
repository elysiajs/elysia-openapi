import { OpenAPIV3 } from 'openapi-types'
import { ElysiaOpenAPIConfig } from '../types'
import { SwaggerUIOptions } from './types'

type DateTimeSchema = {
	type: 'string'
	format: 'date-time'
	default?: string
}

type SchemaObject = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject

function isSchemaObject(
	schema: SchemaObject
): schema is OpenAPIV3.SchemaObject {
	return 'type' in schema || 'properties' in schema || 'items' in schema
}

function isDateTimeProperty(
	key: string,
	schema: OpenAPIV3.SchemaObject
): boolean {
	return (
		(key === 'createdAt' || key === 'updatedAt') &&
		'anyOf' in schema &&
		Array.isArray(schema.anyOf)
	)
}

export function transformDateProperties(schema: SchemaObject): SchemaObject {
	if (
		!isSchemaObject(schema) ||
		typeof schema !== 'object' ||
		schema === null
	)
		return schema

	const newSchema: OpenAPIV3.SchemaObject = { ...schema }

	Object.entries(newSchema).forEach(([key, value]) => {
		if (isSchemaObject(value)) {
			if (isDateTimeProperty(key, value)) {
				const dateTimeFormat = value.anyOf?.find(
					(item): item is OpenAPIV3.SchemaObject =>
						isSchemaObject(item) && item.format === 'date-time'
				)

				if (dateTimeFormat) {
					const dateTimeSchema: DateTimeSchema = {
						type: 'string',
						format: 'date-time',
						default: dateTimeFormat.default
					}
					;(newSchema as Record<string, SchemaObject>)[key] =
						dateTimeSchema
				}
			} else {
				;(newSchema as Record<string, SchemaObject>)[key] =
					transformDateProperties(value)
			}
		}
	})

	return newSchema
}

export const SwaggerUIRender = (
	info: OpenAPIV3.InfoObject,
	config: NonNullable<ElysiaOpenAPIConfig['swagger']> & SwaggerUIOptions
): string => {
	const {
		version = 'latest',
		theme = `https://unpkg.com/swagger-ui-dist@${version ?? 'latest'}/swagger-ui.css`,
		cdn = `https://unpkg.com/swagger-ui-dist@${version}/swagger-ui-bundle.js`,
		autoDarkMode = true,
		...rest
	} = config

	// remove function in rest
	const stringifiedOptions = JSON.stringify(
		{
			dom_id: '#swagger-ui',
			...rest
		},
		(_, value) => (typeof value === 'function' ? undefined : value)
	)

	const options: OpenAPIV3.Document = JSON.parse(stringifiedOptions)

	if (options.components && options.components.schemas)
		options.components.schemas = Object.fromEntries(
			Object.entries(options.components.schemas).map(([key, schema]) => [
				key,
				transformDateProperties(schema)
			])
		)

	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${info.title}</title>
    <meta
        name="description"
        content="${info.description}"
    />
    <meta
        name="og:description"
        content="${info.description}"
    />
    ${
		autoDarkMode && typeof theme === 'string'
			? `<style>
@media (prefers-color-scheme: dark) {
    body {
        background-color: #222;
        color: #faf9a;
    }
    .swagger-ui {
        filter: invert(92%) hue-rotate(180deg);
    }

    .swagger-ui .microlight {
        filter: invert(100%) hue-rotate(180deg);
    }
}
</style>`
			: ''
	}
    ${
		typeof theme === 'string'
			? `<link rel="stylesheet" href="${theme}" />`
			: `<link rel="stylesheet" media="(prefers-color-scheme: light)" href="${theme.light}" />
<link rel="stylesheet" media="(prefers-color-scheme: dark)" href="${theme.dark}" />`
	}
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="${cdn}" crossorigin></script>
    <script>
        window.onload = () => {
            window.ui = SwaggerUIBundle(${stringifiedOptions});
        };
    </script>
</body>
</html>`
}
