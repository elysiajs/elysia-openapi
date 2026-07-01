import { TypeBox } from '@sinclair/typemap'
import type { AdditionalReference } from '../types'

const matchRoute = /: Elysia<(.*)>/gs
const propertyKey = /([A-Za-z_]\w*|\d+):/g

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

export function extractTypeAliases(declaration: string): Record<string, string> {
	const aliases: Record<string, string> = {}
	const typePattern = /\btype\s+(\w+)\s*=\s*/g
	let match: RegExpExecArray | null

	while ((match = typePattern.exec(declaration)) !== null) {
		const name = match[1]
		const startIdx = match.index + match[0].length

		if (declaration[startIdx] !== '{') continue

		let depth = 0
		let end = startIdx
		for (; end < declaration.length; end++) {
			if (declaration[end] === '{') depth++
			else if (declaration[end] === '}') {
				depth--
				if (depth === 0) {
					end++
					break
				}
			}
		}

		aliases[name] = declaration
			.slice(startIdx, end)
			.replace(/\/\/[^\n]*/g, '')
			.replace(/\/\*[\s\S]*?\*\//g, '')
	}

	return aliases
}

export function inlineTypeReferences(
	code: string,
	aliases: Record<string, string>
): string {
	const names = Object.keys(aliases).sort((a, b) => b.length - a.length)

	for (const name of names)
		code = code.replace(new RegExp(`\\b${name}\\b`, 'g'), aliases[name])

	return code
}

const loadTypeScript = (projectRoot: string): typeof import('typescript') => {
	const module = process.getBuiltinModule?.('module') as
		| typeof import('module')
		| undefined
	const runtimeRequire =
		typeof require === 'function'
			? require
			: module?.createRequire?.(join(projectRoot, 'package.json'))

	if (!runtimeRequire)
		throw new Error(
			'[@elysiajs/openapi/gen] `fromTypes` import type resolution requires CommonJS require or module.createRequire'
		)

	try {
		return runtimeRequire('typescript')
	} catch {
		throw new Error(
			'[@elysiajs/openapi/gen] `fromTypes` import type resolution requires `typescript`. Install it with: bun add -d typescript'
		)
	}
}

export function resolveImportedTypes(
	declaration: string,
	projectRoot: string,
	tsconfigPath: string,
	sourceFilePath: string,
	existingAliases: Record<string, string>,
	fs: {
		existsSync: (path: string) => boolean
		readFileSync: (path: string, encoding: 'utf8') => string
	}
): Record<string, string> {
	const aliases = { ...existingAliases }
	const importPattern = /import\("([^"]+)"\)\.(\w+)/g
	const imports = new Map<string, Set<string>>()
	let match: RegExpExecArray | null

	while ((match = importPattern.exec(declaration)) !== null) {
		const [, modulePath, typeName] = match
		if (aliases[typeName]) continue
		if (!imports.has(modulePath)) imports.set(modulePath, new Set())
		imports.get(modulePath)!.add(typeName)
	}

	if (imports.size === 0) return aliases

	const ts = loadTypeScript(projectRoot)
	const fullTsconfigPath = tsconfigPath.startsWith('/')
		? tsconfigPath
		: join(projectRoot, tsconfigPath)
	let compilerOptions: Record<string, any> = {}

	if (fs.existsSync(fullTsconfigPath)) {
		const configFile = ts.readConfigFile(fullTsconfigPath, (path) =>
			fs.readFileSync(path, 'utf8')
		)

		if (configFile.config) {
			const parsed = ts.parseJsonConfigFileContent(
				configFile.config,
				ts.sys,
				projectRoot
			)
			compilerOptions = parsed.options
		}
	}

	const containingFile = sourceFilePath.startsWith('/')
		? sourceFilePath
		: join(projectRoot, sourceFilePath)

	for (const [modulePath, typeNames] of imports) {
		const resolved = ts.resolveModuleName(
			modulePath,
			containingFile,
			compilerOptions as any,
			ts.sys
		)
		const fileName = resolved.resolvedModule?.resolvedFileName

		if (!fileName || !fs.existsSync(fileName)) continue

		try {
			const source = fs.readFileSync(fileName, 'utf8')
			const moduleAliases = extractTypeAliases(source)

			for (const typeName of typeNames)
				if (moduleAliases[typeName])
					aliases[typeName] = moduleAliases[typeName]
		} catch {
			// Ignore unreadable modules; unresolved imports still degrade to refs.
		}
	}

	return aliases
}

export function flattenNestedIntersections(declaration: string): string {
	let result = declaration
	let changed = true

	while (changed) {
		changed = false
		const flattened: string[] = []

		for (const part of splitAtTopLevelIntersections(result)) {
			const expanded = expandOneLevel(part)
			if (expanded.length > 1) changed = true
			flattened.push(...expanded)
		}

		result = flattened.join(' & ')
	}

	return result
}

const splitAtTopLevelIntersections = (declaration: string): string[] => {
	const parts: string[] = []
	let depth = 0
	let start = 0

	for (let i = 0; i < declaration.length; i++) {
		const character = declaration[i]
		if (character === '{') depth++
		else if (character === '}') depth--
		else if (depth === 0 && character === '&') {
			parts.push(declaration.slice(start, i).trim())
			start = i + 1
		}
	}

	const last = declaration.slice(start).trim()
	if (last) parts.push(last)

	return parts.filter(Boolean)
}

const expandOneLevel = (object: string): string[] => {
	let bestIndex = -1
	let bestDepth = -1
	let depth = 0

	for (let i = 0; i < object.length - 4; i++) {
		const character = object[i]
		if (character === '{') depth++
		else if (character === '}') {
			depth--
			if (/^\}\s*&\s*\{/.test(object.slice(i)) && depth > bestDepth) {
				bestIndex = i
				bestDepth = depth
			}
		}
	}

	if (bestIndex === -1) return [object]

	let groupStart = -1
	depth = 1
	for (let i = bestIndex - 1; i >= 0; i--) {
		if (object[i] === '}') depth++
		else if (object[i] === '{') {
			depth--
			if (depth === 0) {
				groupStart = i
				break
			}
		}
	}

	if (groupStart === -1) return [object]

	const members: string[] = []
	let position = groupStart

	while (position < object.length) {
		if (object[position] !== '{') break

		depth = 0
		let end = position
		for (; end < object.length; end++) {
			if (object[end] === '{') depth++
			else if (object[end] === '}') {
				depth--
				if (depth === 0) {
					end++
					break
				}
			}
		}

		members.push(object.slice(position, end))
		position = end

		const separator = object.slice(position).match(/^\s*&\s*/)
		if (!separator) break
		position += separator[0].length
	}

	if (members.length <= 1) return [object]

	const prefix = object.slice(0, groupStart)
	const suffix = object.slice(position)

	return members.map((member) => prefix + member + suffix)
}

export function extractGenericParam(
	instance: string,
	paramIndex: number
): string | undefined {
	const openAngle = instance.indexOf('<')
	if (openAngle === -1) return

	let depth = 0
	let currentParam = 0
	let paramStart = openAngle + 1

	for (let i = openAngle + 1; i < instance.length; i++) {
		const character = instance[i]

		if (
			character === '<' ||
			character === '{' ||
			character === '[' ||
			character === '('
		)
			depth++
		else if (
			character === '>' ||
			character === '}' ||
			character === ']' ||
			character === ')'
		) {
			if (depth === 0)
				return currentParam === paramIndex
					? instance.slice(paramStart, i).trim()
					: undefined

			depth--
		} else if (character === ',' && depth === 0) {
			if (currentParam === paramIndex)
				return instance.slice(paramStart, i).trim()

			currentParam++
			paramStart = i + 1
		}
	}
}

export function declarationToJSONSchema(
	declaration: string,
	typeAliases?: Record<string, string>
) {
	const routes: AdditionalReference = {}
	const flattened = flattenNestedIntersections(declaration)

	// Treaty is a collection of { ... } & { ... } & { ... }
	for (const route of extractRootObjects(
		flattened.replace(propertyKey, '"$1":')
	)) {
		let processed = route
			.replaceAll(/readonly/g, '')
			.replace(/import\([^)]*\)\.(\w+)/g, '$1')

		if (typeAliases) processed = inlineTypeReferences(processed, typeAliases)

		let schema = TypeBox(processed)
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

		if (schema?.response?.type === 'object') {
			const responseSchema: Record<string, any> = {}

			for (const key in schema.response.properties)
				responseSchema[key] = schema.response.properties[key]

			schema.response = responseSchema
		}

		if (!routes[path]) routes[path] = {}
		// @ts-ignore
		routes[path][method.toLowerCase()] = schema
	}

	return routes
}

/**
 * Auto generate OpenAPI schema from Elysia instance
 *
 * It's expected that this command should run in project root
 *
 * @experimental use at your own risk
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
		}: OpenAPIGeneratorOptions = {}
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
				'[@elysiajs/openapi/gen] `fromTypes` from file path is only available in Node.js/Bun environment or environments'
			)

		const fs = process.getBuiltinModule('fs')
		if (!fs)
			throw new Error(
				'[@elysiajs/openapi/gen] `fromTypes` require `fs` module which is not available in this environment'
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

				const resolvedCompilerOptions = {
					lib: ['ESNext'],
					module: 'ESNext',
					noEmit: false,
					declaration: true,
					emitDeclarationOnly: true,
					moduleResolution: 'bundler',
					skipLibCheck: true,
					skipDefaultLibCheck: true,
					rootDir,
					outDir: distDir,
					...compilerOptions
				}

				fs.writeFileSync(
					join(tmpRoot, 'tsconfig.json'),
					`{
	${extendsRef}
	"compilerOptions": ${JSON.stringify(resolvedCompilerOptions)},
	"include": ["${src}"]
}`
				)

				const child_process = process.getBuiltinModule('child_process')
				if (!child_process)
					throw new Error(
						'[@elysiajs/openapi/gen] `fromTypes` declaration generation require `child_process` module which is not available in this environment'
					)
				const { spawnSync } = child_process
				if (typeof spawnSync !== 'function')
					throw new Error(
						'[@elysiajs/openapi/gen] `fromTypes` declaration generation require child_process.spawnSync which is not available in this environment'
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
						'[@elysiajs/openapi/gen] Failed to generate OpenAPI schema'
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

			let typeAliases = extractTypeAliases(declaration)
			typeAliases = resolveImportedTypes(
				declaration,
				projectRoot,
				tsconfigPath,
				src,
				typeAliases,
				fs
			)

			let instance = declaration.match(
				instanceName
					? new RegExp(`${instanceName}: Elysia<(.*)`, 'gs')
					: matchRoute
			)?.[0]

			if (!instance) return

			const routeSection = extractGenericParam(instance, 4)
			if (!routeSection) return

			return declarationToJSONSchema(routeSection, typeAliases)
		} catch (error) {
			console.warn(
				'[@elysiajs/openapi/gen] Failed to generate OpenAPI schema'
			)
			console.warn(error)

			return
		} finally {
			if (!debug && tmpRoot && fs.existsSync(tmpRoot))
				fs.rmSync(tmpRoot, { recursive: true, force: true })
		}
	}
