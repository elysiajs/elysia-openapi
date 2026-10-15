import { Script } from 'typebox/type'
import type { AdditionalReference } from '../types'

const matchRoute = /: Elysia<(.*)>/gs
const numberKey = /(^|[{;,\s])(\d+):/g
const internalOperand = /\s*&\s*(?=\{\s*['"]?~)/y

export interface OpenAPIGeneratorOptions {
	/**
	 * Path to tsconfig.json
	 * @default tsconfig.json
	 */
	tsconfigPath?: string

	/**
	 * Name of the Elysia instance
	 *
	 * If multiple instances are found,
	 * instanceName should be provided
	 */
	instanceName?: string

	/**
	 * Project root directory
	 *
	 * @default process.cwd()
	 */
	projectRoot?: string

	/**
	 * Override output path
	 *
	 * Under any circumstance, that Elysia failed to find a correct schema,
	 * Put your own schema in this path
	 */
	overrideOutputPath?: string | ((tempDir: string) => string)

	/**
	 * don't remove temporary files
	 * for debugging purpose
	 * @default false
	 */
	debug?: boolean

	/**
	 * compilerOptions
	 *
	 * Override tsconfig.json compilerOptions
	 */
	compilerOptions?: Record<string, any>

	/**
	 * Temporary root
	 *
	 * a folder where temporary files are stored
	 * @default os.tmpdir()/.ElysiaAutoOpenAPI
	 *
	 * ! be careful that the folder will be removed after the process ends
	 */
	tmpRoot?: string

	/**
	 * disable log
	 * @default false
	 */
	silent?: boolean
}

/**
 * Polyfill path join for environments without Node.js path module
 */
const join = (...parts: string[]) => parts.join('/').replace(/\/{1,}/g, '/')

export function extractRootObjects(code: string) {
	const results = []
	let i = 0

	while (i < code.length) {
		// find the next colon
		const colonIdx = code.indexOf(':', i)
		if (colonIdx === -1) break

		// walk backwards from colon to find start of key
		let keyEnd = colonIdx - 1
		while (keyEnd >= 0 && /\s/.test(code[keyEnd])) keyEnd--

		let keyStart = keyEnd
		// keep going back until we hit a delimiter (whitespace, brace, semicolon, comma, or start of file)
		while (keyStart >= 0 && !/[\s{};,\n]/.test(code[keyStart])) {
			keyStart--
		}

		// find the opening brace after colon
		const braceIdx = code.indexOf('{', colonIdx)
		if (braceIdx === -1) break

		// scan braces, with an intersected `& { '~handled': ... }` as part of
		// the value, eg. a route at `/` is `get: { ... } & { '~handled': ... }`
		let end = braceIdx
		while (true) {
			let depth = 0
			for (; end < code.length; end++) {
				if (code[end] === '{') depth++
				else if (code[end] === '}') {
					depth--
					if (depth === 0) {
						end++ // move past closing brace
						break
					}
				}
			}

			internalOperand.lastIndex = end
			if (!internalOperand.test(code)) break
			end = internalOperand.lastIndex
		}

		results.push(`{${code.slice(keyStart + 1, end)};}`)

		i = end
	}

	return results
}

interface RouteObject {
	parent?: RouteObject
	// a member spans from its key to its trailing `;` or `,`, or the closing `}`
	fields: { name: string; colon: number; end: number }[]
	// `~` members, eg. `'~handled': ...;`
	internal: { start: number; end: number }[]
	// unclosed `<`, `(` and `[`, so `,` in `A<B, C>` doesn't end a member
	depth: number
	// opened in its parent's `<`, `(` or `[`, eg. `Record<string, {...}>`
	nested: boolean
	start: number
	end: number
}

// in any order, a route mapped over its keys may reorder them
const isRoute = (object: RouteObject) =>
	object.fields
		.map((field) => field.name)
		.sort()
		.join(',') === 'body,error,headers,params,query,response'

const scanRouteObjects = (route: string) => {
	let quote: string | undefined
	let escaped = false
	const objects: RouteObject[] = []
	const stack: RouteObject[] = []

	const isMemberStart = (at: number) => {
		let previous = at - 1
		while (previous >= 0 && /\s/.test(route[previous])) previous--

		return route[previous] === '{' || route[previous] === ';'
	}

	const addInternal = (start: number, keyEnd: number) => {
		if (!stack.length || !isMemberStart(start)) return

		while (keyEnd < route.length && /\s/.test(route[keyEnd])) keyEnd++
		if (route[keyEnd] === ':')
			stack.at(-1)!.internal.push({ start, end: -1 })
	}

	// a member ends at the next `;` or `,` of its own object, or where it closes
	const endMember = (object: RouteObject | undefined, end: number) => {
		for (const member of [object?.fields.at(-1), object?.internal.at(-1)])
			if (member?.end === -1) member.end = end
	}

	for (let i = 0; i < route.length; i++) {
		const char = route[i]

		if (quote) {
			if (escaped) escaped = false
			else if (char === '\\') escaped = true
			else if (char === quote) quote = undefined

			continue
		}

		if (char === '"' || char === "'" || char === '`') {
			if (route[i + 1] === '~')
				addInternal(i, route.indexOf(char, i + 1) + 1)

			quote = char
			continue
		}

		if (char === '{') {
			const parent = stack.at(-1)
			const object: RouteObject = {
				parent,
				fields: [],
				internal: [],
				depth: 0,
				nested: !!parent?.depth,
				start: i,
				end: -1
			}

			objects.push(object)
			stack.push(object)
			continue
		}

		if (char === '}') {
			const object = stack.pop()
			if (object) object.end = i
			endMember(object, i)
			continue
		}

		if (char === ';' || char === ',') {
			if (!stack.at(-1)?.depth) endMember(stack.at(-1), i + 1)
			continue
		}

		if (stack.length && '<(['.includes(char)) {
			stack.at(-1)!.depth++
			continue
		}

		if (stack.length && isClosing(char, route[i - 1])) {
			if (stack.at(-1)!.depth) stack.at(-1)!.depth--
			continue
		}

		if (char === '~') {
			let end = i + 1
			while (end < route.length && /[\w$]/.test(route[end])) end++

			addInternal(i, end)
			continue
		}

		if (!stack.length || !/[A-Za-z_$]/.test(char) || !isMemberStart(i))
			continue

		let end = i + 1
		while (end < route.length && /[\w$]/.test(route[end])) end++

		let colon = end
		while (colon < route.length && /\s/.test(route[colon])) colon++

		if (route[colon] === ':')
			stack.at(-1)!.fields.push({
				name: route.slice(i, end),
				colon,
				end: -1
			})
	}

	return objects
}

// Elysia keeps internal route metadata in `~` members of a route,
// eg. `{ body: ...; error: never } & { '~handled': ... }`
// A `~` path segment or schema property isn't a route member, so it stays
const omitInternalRouteMembers = (route: string) => {
	const objects = scanRouteObjects(route)
	const ranges: { start: number; end: number }[] = []

	// path segments and methods, down to the first object shaped like
	// a route. Anything in a route is its schema, even if shaped like one
	const map = new Set<RouteObject>()
	// where a route, or a `~` object intersected on one, closes
	const ends = new Set<number>()

	const skipSpace = (at: number) => {
		while (at >= 0 && /\s/.test(route[at])) at--

		return at
	}

	for (const object of objects) {
		if (object.end === -1) continue

		// a member's value, or an intersection in one
		const previous = skipSpace(object.start - 1)
		if (
			object.parent &&
			(object.nested ||
				!map.has(object.parent) ||
				(route[previous] !== ':' && route[previous] !== '&'))
		)
			continue

		if (isRoute(object)) {
			ends.add(object.end)
			ranges.push(...object.internal)
			continue
		}

		map.add(object)

		// `& { '~handled': ... }` with nothing else, intersected on a route
		if (
			!object.internal.length ||
			route[previous] !== '&' ||
			!ends.has(skipSpace(previous - 1))
		)
			continue

		let rest = ''
		let at = object.start + 1
		for (const member of object.internal) {
			rest += route.slice(at, member.start)
			at = member.end
		}
		if ((rest + route.slice(at, object.end)).trim()) continue

		ends.add(object.end)
		ranges.push({ start: previous, end: object.end + 1 })
	}

	ranges.sort((left, right) => left.start - right.start)

	let normalized = ''
	let at = 0
	for (const range of ranges) {
		// already removed with the member it's nested in
		if (range.start < at) continue

		normalized += route.slice(at, range.start)
		at = range.end
	}

	return normalized + route.slice(at)
}

function omitRouteError(route: string) {
	const objects = scanRouteObjects(route)
	const errorOf = (object: RouteObject) =>
		object.fields.find((field) => field.name === 'error')!

	const targets = objects
		.filter((object) => {
			if (!isRoute(object)) return false

			for (let parent = object.parent; parent; parent = parent.parent)
				if (isRoute(parent)) return false

			return true
		})
		.map((object) => ({
			start: errorOf(object).colon + 1,
			end: errorOf(object).end
		}))

	for (const target of targets.sort((left, right) => right.start - left.start))
		route =
			route.slice(0, target.start) +
			' never;' +
			route.slice(target.end)

	return route
}

export function declarationToJSONSchema(declaration: string) {
	const routes: AdditionalReference = Object.create(null)

	// Treaty is a collection of { ... } & { ... } & { ... }
	for (const route of extractRootObjects(
		declaration.replace(numberKey, '$1"$2":')
	)) {
		const source = omitInternalRouteMembers(
			route.replaceAll(/readonly/g, '')
		)
		let schema = Script(source) as any

		if (schema.type !== 'object') {
			// TypeBox can't parse error
			const normalized = omitRouteError(source)
			if (normalized !== source) schema = Script(normalized) as any
		}

		if (schema.type !== 'object') continue

		const paths = []

		while (true) {
			const keys = Object.keys(schema.properties)
			if (keys.length !== 1) break

			paths.push(keys[0])

			schema = schema.properties[keys[0]] as any
			if (!schema?.properties) break
		}

		const method = paths.pop()!
		// For whatever reason, if failed to infer route correctly
		if (!method) continue

		const path = '/' + paths.join('/')
		schema = schema.properties

		if (schema) delete (schema as any).error

		if (schema?.response?.type === 'object') {
			const responseSchema: Record<string, any> = Object.create(null)

			for (const key in schema.response.properties)
				responseSchema[key] = schema.response.properties[key]

			schema.response = responseSchema
		}

		if (!routes[path]) routes[path] = Object.create(null)
		// @ts-ignore
		routes[path][method.toLowerCase()] = schema
	}

	return routes
}

const isClosing = (char: string, prev: string) =>
	'>})]'.includes(char) && !(char === '>' && prev === '=')

function extractGenericBody(source: string, name: string) {
	const start = source.indexOf(name + '<')
	if (start === -1) return null

	let depth = 1
	let inString: string | null = null
	const bodyStart = start + name.length + 1

	for (let i = bodyStart; i < source.length; i++) {
		const char = source[i]

		if (inString) {
			if (char === inString) inString = null
			continue
		}

		if (char === '"' || char === "'" || char === '`') inString = char
		else if ('<{(['.includes(char)) depth++
		else if (isClosing(char, source[i - 1])) {
			depth--
			if (depth === 0) return source.slice(bodyStart, i)
		}
	}

	return null
}

// the `=>` of a function type itself, not one in its parameters,
// eg. `({ status }: { status: (code) => ... }) => Return`
function returnArrowOf(source: string) {
	let depth = 0
	let inString: string | null = null

	for (let i = 0; i < source.length; i++) {
		const char = source[i]

		if (inString) {
			if (char === inString) inString = null
			continue
		}

		if (char === '"' || char === "'" || char === '`') inString = char
		else if ('<{(['.includes(char)) depth++
		else if (isClosing(char, source[i - 1])) depth--
		else if (char === '>' && !depth) return i - 1
	}

	return -1
}

function splitGenerics(inner: string) {
	const args: string[] = []
	let depth = 0
	let start = 0
	let inString: string | null = null

	for (let i = 0; i < inner.length; i++) {
		const char = inner[i]

		if (inString) {
			if (char === inString) inString = null
			continue
		}

		if (char === '"' || char === "'" || char === '`') inString = char
		else if ('<{(['.includes(char)) depth++
		else if (isClosing(char, inner[i - 1])) depth--
		else if (char === ',' && depth === 0) {
			args.push(inner.slice(start, i).trim())
			start = i + 1
		}
	}

	args.push(inner.slice(start).trim())

	return args
}

/**
 * Collect top-level `type X = ...` aliases and `interface X ...` declarations
 * from a `.d.ts` into a name -> type-string map.
 */
export function extractTypeContext(declaration: string) {
	const context: Record<string, string> = Object.create(null)

	// type X = <definition>;
	const typeRe = /\btype\s+([A-Za-z_$][\w$]*)\s*=\s*/g
	let match: RegExpExecArray | null
	while ((match = typeRe.exec(declaration))) {
		let depth = 0
		let inString: string | null = null
		let i = typeRe.lastIndex
		const start = i

		for (; i < declaration.length; i++) {
			const char = declaration[i]
			if (inString) {
				if (char === inString) inString = null
				continue
			}
			if (char === '"' || char === "'" || char === '`') inString = char
			else if ('<{(['.includes(char)) depth++
			else if (isClosing(char, declaration[i - 1])) depth--
			else if (char === ';' && depth === 0) break
		}

		context[match[1]] = declaration.slice(start, i).trim()
		typeRe.lastIndex = i
	}

	// interface X [extends A, B] { <body> }  ->  A & B & { <body> }
	const interfaceRe = /\binterface\s+([A-Za-z_$][\w$]*)\s*([^{]*)\{/g
	while ((match = interfaceRe.exec(declaration))) {
		let depth = 1
		let inString: string | null = null
		let i = interfaceRe.lastIndex
		const start = i

		for (; i < declaration.length; i++) {
			const char = declaration[i]
			if (inString) {
				if (char === inString) inString = null
				continue
			}
			if (char === '"' || char === "'" || char === '`') inString = char
			else if ('<{(['.includes(char)) depth++
			else if (isClosing(char, declaration[i - 1])) {
				depth--
				if (depth === 0) break
			}
		}

		const body = '{' + declaration.slice(start, i) + '}'
		const bases = (match[2].match(/extends\s+([^{]+)/)?.[1] ?? '')
			.split(',')
			.map((base) => base.trim())
			.filter(Boolean)

		context[match[1]] = [...bases, body].join(' & ')
		interfaceRe.lastIndex = i + 1
	}

	return context
}

export function resolveTypeRefs(
	schema: any,
	context: Record<string, any>,
	chain: Set<string> = new Set()
): any {
	if (Array.isArray(schema))
		return schema.map((item) => resolveTypeRefs(item, context, chain))

	if (!schema || typeof schema !== 'object') return schema

	if (
		typeof schema.$ref === 'string' &&
		context[schema.$ref] &&
		!chain.has(schema.$ref)
	) {
		// context holds already-parsed schemas; clone and recurse to resolve
		// any nested references it still contains
		const resolved = JSON.parse(JSON.stringify(context[schema.$ref]))

		return resolveTypeRefs(
			resolved,
			context,
			new Set(chain).add(schema.$ref)
		)
	}

	const out: Record<string, unknown> = Object.create(null)
	for (const key in schema)
		out[key] = resolveTypeRefs(schema[key], context, chain)

	return out
}

function collectRefs(schema: any, into = new Set<string>()) {
	if (Array.isArray(schema)) schema.forEach((item) => collectRefs(item, into))
	else if (schema && typeof schema === 'object') {
		if (typeof schema.$ref === 'string') into.add(schema.$ref)
		for (const key in schema) collectRefs(schema[key], into)
	}

	return into
}

function substituteRefs(schema: any, map: Record<string, any>): any {
	if (Array.isArray(schema))
		return schema.map((item) => substituteRefs(item, map))

	if (!schema || typeof schema !== 'object') return schema
	if (typeof schema.$ref === 'string' && map[schema.$ref])
		return map[schema.$ref]

	const out: any = Object.create(null)
	for (const key in schema) out[key] = substituteRefs(schema[key], map)

	return out
}

function stripUndefined(schema: any): any {
	if (Array.isArray(schema)) return schema.map(stripUndefined)
	if (!schema || typeof schema !== 'object') return schema

	const out: any = Object.create(null)
	for (const key in schema) out[key] = stripUndefined(schema[key])

	if (Array.isArray(out.anyOf)) {
		const variants = out.anyOf.filter((v: any) => v?.type !== 'undefined')
		if (variants.length === 1) {
			const { anyOf, ...rest } = out
			return { ...rest, ...variants[0] }
		}

		out.anyOf = variants
	}

	return out
}

type TypeChecker = NonNullable<ReturnType<typeof createTypeChecker>>

function createTypeChecker(
	sourceFile: string,
	tsconfigPath: string,
	projectRoot: string
) {
	let ts: typeof import('typescript') | undefined
	try {
		const createRequire =
			process.getBuiltinModule?.('module')?.createRequire
		ts = createRequire?.(join(projectRoot, 'index.js'))?.('typescript')
	} catch {
		// typescript not importable
	}
	if (!ts) return

	try {
		const config = ts.sys.fileExists(tsconfigPath)
			? ts.readConfigFile(tsconfigPath, ts.sys.readFile).config
			: {}
		const parsed = ts.parseJsonConfigFileContent(
			config,
			ts.sys,
			projectRoot
		)

		const program = ts.createProgram([sourceFile], {
			...parsed.options,
			noEmit: true,
			skipLibCheck: true
		})
		const sf = program.getSourceFile(sourceFile)
		if (!sf) return

		return {
			ts,
			sf,
			checker: program.getTypeChecker(),
			FLAGS:
				ts.TypeFormatFlags.NoTruncation |
				ts.TypeFormatFlags.UseStructuralFallback |
				ts.TypeFormatFlags.InTypeAlias
		}
	} catch (error) {
		console.warn(
			'[@elysia/openapi/gen] Failed to load TypeScript checker',
			error
		)
	}
}

// `.get()` returns a deferred `AddRoute<...>`, which tsc emits unexpanded for
// the last route of a chain. The checker expands it like the routes before it
function expandLastRoute(
	declaration: string,
	instanceName: string | undefined,
	typeChecker: () => TypeChecker | undefined
) {
	const name = [
		...declaration.matchAll(
			/([\w$]+):\s*(?:import\([^)]*\)\.)?AddRoute</g
		)
	]
		.map((match) => match[1])
		.find((name) => !instanceName || name === instanceName)
	if (!name) return

	const typescript = typeChecker()
	if (!typescript) return

	const { ts, sf, checker, FLAGS } = typescript
	const instance =
		checker
			.getSymbolsInScope(sf, ts.SymbolFlags.Value)
			.find((symbol) => symbol.getName() === name) ??
		// `export default new Elysia()...` is emitted as `_default`
		(name === '_default'
			? checker
					.getExportsOfModule(checker.getSymbolAtLocation(sf)!)
					.find((symbol) => symbol.getName() === 'default')
			: undefined)

	// the type of an exported `const` is on its export symbol, not its local one
	const routes =
		instance &&
		checker
			.getTypeOfSymbol(checker.getExportSymbolOfSymbol(instance))
			.getProperty('~Routes')
	if (!routes) return

	// printed from the source file, Elysia's internal aliases expand like
	// they do in the emitted declaration
	return (
		checker
			.typeToString(checker.getTypeOfSymbol(routes), sf, FLAGS)
			// a no-op `& {}`, eg. params `{ id: string; } & {}`, would be an `allOf`
			.replace(/\s*&\s*\{\s*\}/g, '')
	)
}

function resolveExternalRefs(
	reference: AdditionalReference | undefined,
	typeChecker: () => TypeChecker | undefined
): AdditionalReference | undefined {
	if (!reference) return reference

	const refs = [...collectRefs(reference)]
	if (!refs.length) return reference

	const typescript = typeChecker()
	if (!typescript) return reference

	const { ts, sf, checker, FLAGS } = typescript

	try {
		const inScope = checker.getSymbolsInScope(
			sf,
			ts.SymbolFlags.Type | ts.SymbolFlags.Alias
		)

		const map: Record<string, any> = Object.create(null)
		for (const name of refs) {
			let symbol = inScope.find((s) => s.getName() === name)
			if (!symbol) continue
			if (symbol.getFlags() & ts.SymbolFlags.Alias)
				symbol = checker.getAliasedSymbol(symbol)

			const declared = checker.getDeclaredTypeOfSymbol(symbol)
			const typeString = checker.typeToString(declared, undefined, FLAGS)

			// generic type aliases keep their parameter names; resolve those to
			// the parameter defaults (Script's module form substitutes them)
			const context: Record<string, any> = Object.create(null)
			for (const declaration of symbol.getDeclarations() ?? [])
				for (const parameter of (declaration as any).typeParameters ??
					[])
					if (parameter.default)
						try {
							context[parameter.name.text] = Script(
								checker.typeToString(
									checker.getTypeFromTypeNode(
										parameter.default
									),
									undefined,
									FLAGS
								)
							)
						} catch {}

			try {
				map[name] = stripUndefined(
					JSON.parse(JSON.stringify(Script(context, typeString)))
				)
			} catch {}
		}

		return substituteRefs(reference, map)
	} catch (error) {
		console.warn(
			'[@elysia/openapi/gen] Failed to resolve external types',
			error
		)

		return reference
	}
}

export function declarationToReference(
	declaration: string,
	instanceName?: string,
	// the routes map, already expanded by the checker
	expandedRoutes?: string
): AdditionalReference | undefined {
	let scope = declaration
	if (instanceName) {
		const at = declaration.indexOf(`${instanceName}:`)
		if (at !== -1) scope = declaration.slice(at)
	}

	// Parse each type alias/interface into a schema so refs can be resolved
	const context: Record<string, any> = Object.create(null)
	for (const [name, type] of Object.entries(
		extractTypeContext(declaration)
	))
		try {
			context[name] = Script(type)
		} catch {
			// skip definitions Script can't parse; they stay as `$ref`
		}

	if (expandedRoutes)
		return resolveTypeRefs(declarationToJSONSchema(expandedRoutes), context)

	const addRouteBody = extractGenericBody(scope, 'AddRoute')
	if (addRouteBody) {
		const generics = splitGenerics(addRouteBody)
		const routes = generics[5] ? declarationToJSONSchema(generics[5]) : {}

		// The last `.get()/.post()` in the chain isn't folded into the routes
		// map yet; reconstruct it from the trailing method/path/handler generics
		const method = generics[8]?.replace(/['"]/g, '').toLowerCase()
		const path = generics[9]?.replace(/['"]/g, '')
		const handler = generics[12] ?? ''

		if (method && path && !routes[path]) {
			const route: Record<string, unknown> = {
				body: {},
				params: { type: 'object', properties: {} },
				query: {},
				headers: {},
				response: {}
			}

			const arrow = returnArrowOf(handler)
			if (arrow !== -1) {
				const returnType = handler
					.slice(arrow + 2)
					.trim()
					.replace(/readonly/g, '')

				try {
					const schema = Script(returnType)
					if (schema) route.response = { 200: schema }
				} catch {
					// best effort: leave response empty if the return type
					// can't be parsed (unions, Promise<...>, status(), ...)
				}
			}

			// @ts-ignore
			routes[path] = { [method]: route }
		}

		return resolveTypeRefs(routes, context)
	}

	// Plain instance (chain not ending in a route method)
	const instance = scope.match(
		instanceName
			? new RegExp(`${instanceName}: Elysia<(.*)`, 'gs')
			: matchRoute
	)?.[0]

	if (!instance) return

	const body = extractGenericBody(instance, 'Elysia')
	if (!body) return

	const generics = splitGenerics(body)

	// Elysia 2.x: `Elysia<'', 'local', Singleton, Definitions, Metadata, Routes>`
	// Elysia 1.x: `Elysia<'', Singleton, Definitions, Metadata, Routes>`
	const routes = /^['"]/.test(generics[1] ?? '') ? generics[5] : generics[4]
	if (!routes) return

	return resolveTypeRefs(declarationToJSONSchema(routes), context)
}

/**
 * Auto generate OpenAPI schema from Elysia instance
 *
 * It's expected that this command should run in project root
 */
export const fromTypes =
	(
		/**
		 * Path to file where Elysia instance is
		 *
		 * The path must export an Elysia instance
		 * or a literal TypeScript declaration
		 */
		targetFilePath = 'src/index.ts',
		{
			tsconfigPath = 'tsconfig.json',
			instanceName,
			projectRoot = process.cwd(),
			overrideOutputPath,
			debug = false,
			compilerOptions,
			tmpRoot,
			silent = false
		}: OpenAPIGeneratorOptions = Object.create(null)
	) =>
	() => {
		// targetFilePath is an actual TypeScript declaration
		if (
			targetFilePath.trimStart().startsWith('{') &&
			targetFilePath.trimEnd().endsWith('}')
		)
			return declarationToJSONSchema(targetFilePath)

		if (
			typeof process === 'undefined' ||
			typeof process.getBuiltinModule !== 'function'
		)
			throw new Error(
				'[@elysia/openapi/gen] `fromTypes` from file path is only available in Node.js/Bun environment or environments'
			)

		const fs = process.getBuiltinModule('fs')
		if (!fs)
			throw new Error(
				'[@elysia/openapi/gen] `fromTypes` require `fs` module which is not available in this environment'
			)

		try {
			if (
				!targetFilePath.endsWith('.ts') &&
				!targetFilePath.endsWith('.tsx')
			)
				throw new Error('Only .ts files are supported')

			if (targetFilePath.startsWith('./'))
				targetFilePath = targetFilePath.slice(2)

			let src = targetFilePath.startsWith('/')
				? targetFilePath
				: join(projectRoot, targetFilePath)

			if (!fs.existsSync(src))
				throw new Error(
					`Couldn't find "${targetFilePath}" from ${projectRoot}`
				)

			let targetFile: string

			if (!tmpRoot) {
				const os = process.getBuiltinModule('os')

				tmpRoot = join(
					os && typeof os.tmpdir === 'function'
						? os.tmpdir()
						: projectRoot,
					'.ElysiaAutoOpenAPI'
				)
			}

			// Since it's already a declaration file
			// We can just read it directly
			if (targetFilePath.endsWith('.d.ts')) targetFile = targetFilePath
			else {
				if (fs.existsSync(tmpRoot))
					fs.rmSync(tmpRoot, { recursive: true, force: true })

				fs.mkdirSync(tmpRoot, { recursive: true })

				const tsconfig = tsconfigPath.startsWith('/')
					? tsconfigPath
					: join(projectRoot, tsconfigPath)

				let extendsRef = fs.existsSync(tsconfig)
					? `"extends": "${join(projectRoot, 'tsconfig.json')}",`
					: ''

				let distDir = join(tmpRoot, 'dist')
				// Explicit rootDir: TypeScript 6.0+ no longer infers it when
				// emitting declarations with an outDir, and errors instead of
				// emitting. projectRoot contains the target file and its imports.
				let rootDir = projectRoot

				// Convert Windows path to Unix for TypeScript CLI
				if (
					typeof process !== 'undefined' &&
					process.platform === 'win32'
				) {
					extendsRef = extendsRef.replace(/\\/g, '/')
					src = src.replace(/\\/g, '/')
					distDir = distDir.replace(/\\/g, '/')
					rootDir = rootDir.replace(/\\/g, '/')
				}

				fs.writeFileSync(
					join(tmpRoot, 'tsconfig.json'),
					`{
	${extendsRef}
	"compilerOptions": ${
		compilerOptions
			? JSON.stringify(compilerOptions)
			: `{
	"lib": ["ESNext"],
	"module": "ESNext",
	"noEmit": false,
	"declaration": true,
	"emitDeclarationOnly": true,
	"moduleResolution": "bundler",
	"skipLibCheck": true,
	"skipDefaultLibCheck": true,
	"rootDir": "${rootDir}",
	"outDir": "${distDir}"
}`
	},
	"include": ["${src}"]
}`
				)

				const child_process = process.getBuiltinModule('child_process')
				if (!child_process)
					throw new Error(
						'[@elysia/openapi/gen] `fromTypes` declaration generation require `child_process` module which is not available in this environment'
					)
				const { spawnSync } = child_process
				if (typeof spawnSync !== 'function')
					throw new Error(
						'[@elysia/openapi/gen] `fromTypes` declaration generation require child_process.spawnSync which is not available in this environment'
					)

				spawnSync(`tsc`, {
					shell: true,
					cwd: tmpRoot,
					stdio: silent ? undefined : 'inherit'
				})

				const fileName = targetFilePath
					.replace(/.tsx$/, '.ts')
					.replace(/.ts$/, '.d.ts')

				targetFile =
					(overrideOutputPath
						? typeof overrideOutputPath === 'string'
							? overrideOutputPath.startsWith('/')
								? overrideOutputPath
								: join(tmpRoot, 'dist', overrideOutputPath)
							: overrideOutputPath(tmpRoot)
						: undefined) ??
					join(
						tmpRoot,
						'dist',
						// remove leading like src or something similar
						fileName.slice(fileName.indexOf('/') + 1)
					)

				let existed = fs.existsSync(targetFile)

				if (!existed && !overrideOutputPath) {
					targetFile = join(
						tmpRoot,
						'dist',
						// use original file name as-is eg. in monorepo
						fileName
					)

					existed = fs.existsSync(targetFile)
				}

				if (!existed) {
					fs.rmSync(join(tmpRoot, 'tsconfig.json'))

					console.warn(
						'[@elysia/openapi/gen] Failed to generate OpenAPI schema'
					)
					console.warn("Couldn't find generated declaration file")

					if (fs.existsSync(join(tmpRoot, 'dist'))) {
						const tempFiles = fs
							.readdirSync(join(tmpRoot, 'dist'), {
								recursive: true
							})
							.filter((x) => x.toString().endsWith('.d.ts'))
							.map((x) => `- ${x}`)
							.join('\n')

						if (tempFiles) {
							console.warn(
								'You can override with `overrideOutputPath` with one of the following:'
							)
							console.warn(tempFiles)
						}
					} else {
						console.warn(
							"reason: root folder doesn't exists",
							join(tmpRoot, 'dist')
						)
					}

					return
				}
			}

			const declaration = fs.readFileSync(targetFile, 'utf8')

			// Check just in case of race-condition
			if (!debug && fs.existsSync(tmpRoot))
				fs.rmSync(tmpRoot, { recursive: true, force: true })

			// created on first use, only if needed
			let typescript: TypeChecker | undefined
			const typeChecker = () =>
				(typescript ??= createTypeChecker(
					src,
					tsconfigPath.startsWith('/')
						? tsconfigPath
						: join(projectRoot, tsconfigPath),
					projectRoot
				))

			const reference = declarationToReference(
				declaration,
				instanceName,
				expandLastRoute(declaration, instanceName, typeChecker)
			)

			// Resolve any `$ref` the parser couldn't (imported/generic types)
			// via the TypeScript checker
			return resolveExternalRefs(reference, typeChecker)
		} catch (error) {
			console.warn(
				'[@elysia/openapi/gen] Failed to generate OpenAPI schema'
			)
			console.warn(error)

			return
		} finally {
			if (!debug && tmpRoot && fs.existsSync(tmpRoot))
				fs.rmSync(tmpRoot, { recursive: true, force: true })
		}
	}
