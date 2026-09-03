import { Script } from 'typebox/type'
import type { AdditionalReference } from '../types'

const matchRoute = /: Elysia<(.*)>/gs
const numberKey = /(^|[{;,\s])(\d+):/g

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

		// scan braces
		let depth = 0
		let end = braceIdx
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

		results.push(`{${code.slice(keyStart + 1, end)};}`)

		i = end
	}

	return results
}

export function declarationToJSONSchema(declaration: string) {
	const routes: AdditionalReference = Object.create(null)

	// Treaty is a collection of { ... } & { ... } & { ... }
	for (const route of extractRootObjects(
		declaration.replace(numberKey, '$1"$2":')
	)) {
		let schema = Script(route.replaceAll(/readonly/g, '')) as any
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

function resolveExternalRefs(
	reference: AdditionalReference | undefined,
	sourceFile: string,
	tsconfigPath: string,
	projectRoot: string
): AdditionalReference | undefined {
	if (!reference) return reference

	const refs = [...collectRefs(reference)]
	if (!refs.length) return reference

	let ts: typeof import('typescript') | undefined
	try {
		const createRequire =
			process.getBuiltinModule?.('module')?.createRequire
		ts = createRequire?.(join(projectRoot, 'index.js'))?.('typescript')
	} catch {
		// typescript not importable
	}
	if (!ts) return reference

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
		const checker = program.getTypeChecker()
		const sf = program.getSourceFile(sourceFile)
		if (!sf) return reference

		const FLAGS =
			ts.TypeFormatFlags.NoTruncation |
			ts.TypeFormatFlags.UseStructuralFallback |
			ts.TypeFormatFlags.InTypeAlias

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
	instanceName?: string
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

			const arrow = handler.indexOf('=>')
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

			const reference = declarationToReference(declaration, instanceName)

			// Resolve any `$ref` the parser couldn't (imported/generic types)
			// via the TypeScript checker
			return resolveExternalRefs(
				reference,
				src,
				tsconfigPath.startsWith('/')
					? tsconfigPath
					: join(projectRoot, tsconfigPath),
				projectRoot
			)
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
