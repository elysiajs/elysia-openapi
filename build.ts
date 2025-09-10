import { $ } from 'bun'
import { build, type Options } from 'tsup'

await $`rm -rf dist`

const tsupConfig: Options = {
	entry: ['src/**/*.ts'],
	splitting: false,
	sourcemap: false,
	clean: true,
	bundle: true
} satisfies Options

await Promise.all([
	// ? tsup esm
	build({
		outDir: 'dist',
		format: 'esm',
		target: 'node20',
		cjsInterop: false,
		...tsupConfig
	}),
	// ? tsup cjs
	build({
		outDir: 'dist/cjs',
		format: 'cjs',
		target: 'node20',
		// dts: true,
		...tsupConfig
	})
])

await $`tsc --project tsconfig.dts.json`

await Promise.all([$`cp dist/*.d.ts dist/cjs`])

process.exit()
