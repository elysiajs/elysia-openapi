# 1.4.11 - 25 Sep 2025
Improvement:
- add `embedSpec` option to embed spec into documentation page
- add `data-configuration` for adding custom Scalar configuration

# 1.4.10 - 22 Sep 2025
Improvement:
- [#267](https://github.com/elysiajs/elysia-openapi/pull/267) enum eupport for OpenAPI
- populate params from path when no schema is provided
- type gen: accept number as path segment
- when failed to convert type to OpenAPI, log the error and continue
- type gen: use `process.getBuiltinModule` to import native node module conditionally
- type gen: `fromTypes` now accept direct declaration
- export `fromTypes` from index
- add test case for type gen, and OpenAPI schema

Bug fix:
- [#226](https://github.com/elysiajs/elysia-openapi/issues/266) accept operationId
- [#230](https://github.com/elysiajs/elysia-openapi/issues/230) do not inline Response if is Cloudflare Worker

# 1.4.9 - 21 Sep 2025
Improvement:
- type gen: match special, ad non-english character

# 1.4.8 - 21 Sep 2025
Improvement:
- type gen: handle array delimiter correctly

# 1.4.7 - 21 Sep 2025
Improvement:
- type gen: remove readonly from generated type to fix readonly tuple

# 1.4.6 - 21 Sep 2025
Bug fix:
- type gen: handle inline 200 response schema assignment

# 1.4.5 - 20 Sep 2025
Improvement:
- reference model now handle content type correctly
- type doesn't show up when body is primitive type

Bug fix:
- remove unintentional console.log
- reference model doesn't show up when using as response

# 1.4.4 - 20 Sep 2025
Improvement:
- cast `exclude.methods` to lowercase when checking for method exclusion
- type generator: handle non-intersect routes eg. group/guard

Change:
- type generator: enable type error log
- type generator: do not remove temp files when debug is enabled

Bug fix:
- exclude `options` method by default

# 1.4.3 - 18 Sep 2025
Improvement:
- unwrap model reference into parameter schema
- add warning for standard schema without `toJSONSchema` method
- remove `Provider` from generic type to allow auto-completion
- auto-completion for `mapJSONSchema`
- log error when failed to OpenAPI JSON

# 1.4.2 - 14 Sep 2025
Bug fix:
- remove xsschema from dependencies

# 1.4.1 - 14 Sep 2025
Feature:
- add `mapJsonSchema` to add custom JSON Schema mapping

Bug fix:
- build error when using --compile

Change:
- remove xsschema

# 1.4.0 - 13 Sep 2025
Improvement:
- support Standard Schema to OpenAPI
- use respective content type based on schema

# 1.3.12 - 10 Sep 2025
Improvement:
- type generator: add `compilerOptions`, `tmpRoot` options

Bug fix:
- type generator: use absolute path to generate types

# 1.3.11 - 9 Sep 2025
Bug fix:
- type generator: convert Windows path to Unix for TypeScript CLI

# 1.3.10 - 5 Sep 2025
Feature:
- type generator: accept `.d.ts` to prevent type generation in production

Bug fix:
- type generator: loose path generated file mapping

# 1.3.9 - 4 Sep 2025
Bug fix:
- type generator: loose path generated file mapping

# 1.3.8 - 4 Sep 2025
Bug fix:
- type generator: if failed, do not generate empty JSON
- type generator: friendly error message, and better error handling
- type generator: overrideOutputPath can be string

# 1.3.7 - 3 Sep 2025
Improvement:
- type generator: clean up temp files after generation

Bug fix:
- type generator: imbalance bracket or something

# 1.3.6 - 3 Sep 2025
Improvement:
- type generator: add loose path type matching
- type generator: try loose matching for schema type

# 1.3.5 - 3 Sep 2025
Bug fix:
- type generator: merge references with existing response status
- type generator: handle union type

# 1.3.4 - 3 Sep 2025
Bug fix:
- type generator: exclude unknown type

# 1.3.3 - 3 Sep 2025
Bug fix:
- type generator: collapse path when trying to access from dist

# 1.3.2 - 2 Sep 2025
Feature:
- add `withHeader` for adding custom headers to response schema
- spread all possible path for optional params
- provider can be `null` to disable provider
- export `toOpenAPI` to generate spec programmatically
- add `openapi/gen` to automatically generate OpenAPI spec from types

Breaking change:
- rename `@elysiajs/swagger` to `@elysiajs/openapi`
- map all `swagger`, and `scalar` prefix to respective `swagger` and `scalar` properties
- rename `swaggerConfig`, and `scalarConfig` to `swagger` and `scalar` respectively
- map `excludePaths`, `excludeMethods`, `excludeTags`, `excludeStaticFiles`	 to property of `excludes`

# 1.3.1 - 28 Jun 2025
Bug fix:
- Using relative path for specPath

# 1.3.0-exp.1 - 1 May 2025
Improvement:
- use static response for documentation page
- plugin is no longer async
- model should be synced globally
- use `parse` instead of `type` to determine content type

# 1.3.0-exp.0 - 23 Apr 2025
Change:
- Add support for Elysia 1.3

# 1.2.2 - 22 Feb 2024
Bug fix:
- [#185](https://github.com/elysiajs/elysia-swagger/pull/185) Fix path issue in Scalar config

# 1.2.1 - 19 Feb 2024
Bug fix:
- [#154](https://github.com/elysiajs/elysia-swagger/pull/154) prevent failed to fetch spec from URL error
- [elysia#1063](https://github.com/elysiajs/elysia/issues/1063) Using t.Ref as response schema results in invalid OpenAPI specification
- handle unfold recursive Ref to schema

# 1.2.0-rc.0 - 23 Dec 2024
Change:
- Add support for Elysia 1.2

# 1.1.6 - 17 Nov 2024
Bug fix:
- [#156](https://github.com/elysiajs/elysia-swagger/pull/156) add type check in cloneHook

# 1.1.4 - 9 Oct 2024
Bug fix:
- Fix duplicate object reference

# 1.1.2 - 5 Sep 2024
Feature:
- add provenance publish

# 1.1.1 - 12 Aug 2024
Feature:
- add hide flag

# 1.1.0 - 16 Jul 2024
Change:
- Add support for Elysia 1.1


# 1.1.0-rc.0 - 12 Jul 2024
Change:
- Add support for Elysia 1.1


# 1.0.2 - 18 Mar 2024
Change:
- Add support for Elysia 1.0


# 1.0.0 - 16 Mar 2024
Change:
- Add support for Elysia 1.0


# 1.0.0-rc.0 - 1 Mar 2024
Change:
- Add support for Elysia 1.0


# 1.0.0-beta.1 - 17 Feb 2024
Change:
- Add support for Elysia 1.0


# 1.0.0-beta.0 - 6 Feb 2024
Change:
- Add support for Elysia 1.0

# 0.8.5 - 24 Jan 2024
Bug fix:
- [#39](https://github.com/elysiajs/elysia-swagger/issues/39) Array type does not work

# 0.8.4 - 24 Jan 2024
Feature:
- [#96](https://github.com/elysiajs/elysia-swagger/pull/96) move to scalar configuration prop
- [#95](https://github.com/elysiajs/elysia-swagger/pulls?q=is%3Apr+is%3Aclosed) Scalar CDN option
- [#92](https://github.com/elysiajs/elysia-swagger/pull/92) update scalar to 1.13.0 and using latest instead of hardcoded version

# 0.8.3 - 8 Jan 2024
Bug fix:
- Using local Scalar API reference instead of leftover one (oppsie 👉👈)

# 0.8.2 - 8 Jan 2024
Improvement:
- Extract type inference to reduce bundle-size

# 0.8.1 - 7 Jan 2024
Change:
- Using Scalar provider as new default

# 0.8.0-rc.0 - 15 Dec 2023
Change:
- Add support for Elysia 0.8

# 0.7.5
Improvement:
- #[59](https://github.com/elysiajs/elysia-swagger/pull/59) use relative path to swagger json #59

# 0.7.4 - 27 Oct 2023
Improvement:
- [#24](https://github.com/elysiajs/elysia-swagger/pull/24) - adding schema validity test

Change:
- [#48](https://github.com/elysiajs/elysia-swagger/pull/48) update Swagger UI to 4.9.0
- [#36](https://github.com/elysiajs/elysia-swagger/pull/36 ) point to generated .d.ts instead of raw .ts

Bug fix:
- [#41](https://github.com/elysiajs/elysia-swagger/pull/41) parameters mapping, fix
- [#43](https://github.com/elysiajs/elysia-swagger/pull/43) typo in default documentation

# 0.7.3 - 26 Sep 2023
Feature:
- [#19](https://github.com/elysiajs/elysia-swagger/pull/19) feat: handle nullish response types
- [#18](https://github.com/elysiajs/elysia-swagger/pull/18) swagger ui options


Improvement:
- [#23](https://github.com/elysiajs/elysia-swagger/pull/23) Add github action to run bun test
- remove `removeComment` from tsconfig to show JSDoc
- add `theme` to customize Swagger CSS link
- add `autoDarkMode` using poor man Swagger dark mode CSS 😭

Change:
- Set default swagger version to 5.7.2

Bug fix:
- [#16](https://github.com/elysiajs/elysia-swagger/pull/16) fix: use global prefix

# 0.7.2 - 21 Sep 2023
Bug fix:
- Paths is undefined
- Models is not showing

# 0.7.1 - 20 Sep 2023
Bug fix:
- Add openapi-types as dependencies
- Fix `any` returned type

# 0.7.0 - 20 Sep 2023
- Add support for Elysia 0.

# 0.7.0-beta.0 - 18 Sep 2023
- Add support for Elysia 0.7

# 0.6.2 - 11 Sep 2023
- Ship lodash.cloneDeep type

# 0.6.1 - 17 Aug 2023
- Add support for user provided components

# 0.6.0 - 6 Aug 2023
- Add support for Elysia 0.6

# 0.6.0-rc.0 - 6 Aug 2023
- Add support for Elysia 0.6
# 0.5.0 - 15 May 2023
- Add support for Elysia 0.5
- Add CommonJS support

# 0.3.0 - 17 Mar 2023
Improvement:
- Add support for Elysia 0.3.0

# 0.3.0-rc.0 - 7 Mar 2023
Improvement:
- Add support for Elysia 0.3.0-rc.0

# 0.3.0-beta.0 - 25 Feb 2023
Improvement:
- Support Elysia >= 0.3.0-beta.0

Breaking Change:
- Update from OpenAPI 2.x to OpenAPI 3.0.3
- `swagger.swagger` is renamed to `swagger.documentation`

# 0.1.1 - 8 Jan 2023
Bug fix:
- Infers path type

# 0.1.0-rc.3 - 13 Dec 2022
Improvement:
- Add support for Elysia 0.1.0-rc.5

# 0.1.0-rc.2 - 9 Dec 2022
Improvement:
- Support for Elysia 0.1.0-rc.1 onward

Fix:
- Add main fields Bundlephobia

# 0.1.0-rc.1 - 6 Dec 2022
Improvement:
- Support for Elysia 0.1.0-rc.1 onward

# 0.0.0-experimental.3 - 29 Nov 2022
Change:
- Support for KingWorld 0.0.0-experimental.51

# 0.0.0-experimental.2 - 22 Nov 2022
Change:
- Support for KingWorld 0.0.0-experimental.51

# 0.0.0-experimental.1 - 12 Nov 2022
Improvement:
- Auto infers path params if schema is presented
- Auto infers path params now merge with schema.params
