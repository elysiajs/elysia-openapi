import type { InputSchema, InternalRoute, TSchema } from 'elysia'
import {
	readFileSync,
	mkdirSync,
	writeFileSync,
	rmSync,
	existsSync,
	readdirSync
} from 'fs'
import { TypeBox } from '@sinclair/typemap'

import { tmpdir } from 'os'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { AdditionalReference } from '../types'

const matchRoute = /: Elysia<(.*)>/gs
const numberKey = /(\d+):/g

interface OpenAPIGeneratorOptions {
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

function extractRootObjects(code: string) {
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
	const routes: AdditionalReference = {}

	// Treaty is a collection of { ... } & { ... } & { ... }
	for (const route of extractRootObjects(
		declaration.replace(numberKey, '"$1":')
	)) {
		let schema = TypeBox(route.replaceAll(/readonly/g, ''))
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
		 */
		targetFilePath: string,
		{
			tsconfigPath = 'tsconfig.json',
			instanceName,
			projectRoot = process.cwd(),
			overrideOutputPath,
			debug = false,
			compilerOptions,
			tmpRoot = join(tmpdir(), '.ElysiaAutoOpenAPI'),
			silent = false
		}: OpenAPIGeneratorOptions = {}
	) =>
	() => {
		try {
			// targetFilePath is an actual dts reference
			if (targetFilePath.trim().startsWith('{'))
				return declarationToJSONSchema(targetFilePath)

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

			if (!existsSync(src))
				throw new Error(
					`Couldn't find "${targetFilePath}" from ${projectRoot}`
				)

			let targetFile: string

			// Since it's already a declaration file
			// We can just read it directly
			if (targetFilePath.endsWith('.d.ts')) targetFile = targetFilePath
			else {
				if (existsSync(tmpRoot))
					rmSync(tmpRoot, { recursive: true, force: true })

				mkdirSync(tmpRoot, { recursive: true })

				const tsconfig = tsconfigPath.startsWith('/')
					? tsconfigPath
					: join(projectRoot, tsconfigPath)

				let extendsRef = existsSync(tsconfig)
					? `"extends": "${join(projectRoot, 'tsconfig.json')}",`
					: ''

				let distDir = join(tmpRoot, 'dist')

				// Convert Windows path to Unix for TypeScript CLI
				if (
					typeof process !== 'undefined' &&
					process.platform === 'win32'
				) {
					extendsRef = extendsRef.replace(/\\/g, '/')
					src = src.replace(/\\/g, '/')
					distDir = distDir.replace(/\\/g, '/')
				}

				writeFileSync(
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
	"outDir": "${distDir}"
}`
	},
	"include": ["${src}"]
}`
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

				let existed = existsSync(targetFile)

				if (!existed && !overrideOutputPath) {
					targetFile = join(
						tmpRoot,
						'dist',
						// use original file name as-is eg. in monorepo
						fileName
					)

					existed = existsSync(targetFile)
				}

				if (!existed) {
					rmSync(join(tmpRoot, 'tsconfig.json'))

					console.warn(
						'[@elysiajs/openapi/gen] Failed to generate OpenAPI schema'
					)
					console.warn("Couldn't find generated declaration file")

					if (existsSync(join(tmpRoot, 'dist'))) {
						const tempFiles = readdirSync(join(tmpRoot, 'dist'), {
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

			const declaration = readFileSync(targetFile, 'utf8')

			// Check just in case of race-condition
			if (!debug && existsSync(tmpRoot))
				rmSync(tmpRoot, { recursive: true, force: true })

			let instance = declaration.match(
				instanceName
					? new RegExp(`${instanceName}: Elysia<(.*)`, 'gs')
					: matchRoute
			)?.[0]

			if (!instance) return

			// Get 5th generic parameter
			// Elysia<'', {}, {}, {}, Routes>
			// ------------------------^
			//         1   2   3   4   5
			// We want the 4th one
			for (let i = 0; i < 3; i++)
				instance = instance.slice(
					instance.indexOf(
						'}, {',
						// remove just `}, `, leaving `{`
						3
					)
				)

			return declarationToJSONSchema(instance.slice(2))
		} catch (error) {
			console.warn(
				'[@elysiajs/openapi/gen] Failed to generate OpenAPI schema'
			)
			console.warn(error)

			return
		} finally {
			if (!debug && existsSync(tmpRoot))
				rmSync(tmpRoot, { recursive: true, force: true })
		}
	}
