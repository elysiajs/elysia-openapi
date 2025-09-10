# @elysiajs/openapi
Plugin for [elysia](https://github.com/elysiajs/elysia) to auto-generate API documentation page.

## Installation
```bash
bun add @elysiajs/openapi
```

## Example
```typescript
import { Elysia, t } from 'elysia'
import { openapi } from '@elysiajs/openapi'

const app = new Elysia()
    .use(openapi())
    .get('/', () => 'hi', { response: t.String({ description: 'sample description' }) })
    .post(
        '/json/:id',
        ({ body, params: { id }, query: { name } }) => ({
            ...body,
            id,
            name
        }),
        {
            params: t.Object({
                id: t.String()
            }),
            query: t.Object({
                name: t.String()
            }),
            body: t.Object({
                username: t.String(),
                password: t.String()
            }),
            response: t.Object({
                username: t.String(),
                password: t.String(),
                id: t.String(),
                name: t.String()
            }, { description: 'sample description' })
        }
    )
    .listen(8080);
```

Then go to `http://localhost:8080/openapi`.

# config

## enabled
@default true
Enable/Disable the plugin

## documentation
OpenAPI documentation information

@see https://spec.openapis.org/oas/v3.0.3.html

## exclude
Configuration to exclude paths or methods from documentation

## exclude.methods
List of methods to exclude from documentation

## exclude.paths
List of paths to exclude from documentation

## exclude.staticFile
@default true

Exclude static file routes from documentation

## exclude.tags
List of tags to exclude from documentation

## path
@default '/openapi'

The endpoint to expose OpenAPI documentation frontend

## provider
@default 'scalar'

OpenAPI documentation frontend between:
- [Scalar](https://github.com/scalar/scalar)
- [SwaggerUI](https://github.com/openapi-api/openapi-ui)
- null: disable frontend

## references
Additional OpenAPI reference for each endpoint

## scalar
Scalar configuration, refers to [Scalar config](https://github.com/scalar/scalar/blob/main/documentation/configuration.md)

## specPath
@default '/${path}/json'

The endpoint to expose OpenAPI specification in JSON format

## swagger
Swagger config, refers to [Swagger config](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/)
