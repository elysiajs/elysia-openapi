import { $ } from 'bun'
import { build } from 'tsdown'

await $`rm -rf dist`

await build({
	outDir: 'dist',
	entry: ['src/**/*.ts'],
	cjsDefault: false,
	target: 'node22',
	format: ['esm', 'cjs'],
	minify: false,
	unbundle: true,
	deps: {
		neverBundle: true
	},
	dts: true,
	outExtensions(c) {
		return {
			dts: '.d.ts',
			js: c.format === 'es' ? '.mjs' : '.js'
		}
	}
})

for (const format of ['index.mjs', 'index.js']) {
	const generatedEntry = await Bun.file(`dist/gen/${format}`).text()

	if (generatedEntry.includes('../node_modules/typebox/'))
		throw new Error('Build emitted a package-relative TypeBox import')
}
