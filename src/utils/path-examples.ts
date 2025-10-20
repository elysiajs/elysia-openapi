/**
 * 路径处理工具使用示例
 * 演示如何处理跨平台路径问题
 */

import { PathUtils } from './path'

export function demonstratePathHandling() {
	console.log('=== PathUtils 跨平台路径处理示例 ===')
	console.log(`当前平台: ${process.platform}`)
	console.log(`路径分隔符: ${PathUtils.separator}`)
	console.log('')

	// 示例1: 标准化路径
	console.log('1. 路径标准化:')
	const windowsPath = 'C:\\Users\\boer\\Desktop\\project\\src\\index.ts'
	const unixPath = '/home/user/project/src/index.ts'
	console.log(`Windows路径: ${windowsPath}`)
	console.log(`标准化后: ${PathUtils.normalize(windowsPath)}`)
	console.log(`Unix路径: ${unixPath}`)
	console.log(`标准化后: ${PathUtils.normalize(unixPath)}`)
	console.log('')

	// 示例2: 路径连接
	console.log('2. 路径连接:')
	const parts = ['src', 'components', 'Button', 'index.tsx']
	const joined = PathUtils.join(...parts)
	console.log(`连接片段: ${parts.join(', ')}`)
	console.log(`连接结果: ${joined}`)
	console.log('')

	// 示例3: 临时目录
	console.log('3. 临时目录获取:')
	const tempDir = PathUtils.getTempDir('elysia-openapi')
	console.log(`临时目录: ${tempDir}`)
	console.log('')

	// 示例4: 路径比较
	console.log('4. 路径比较:')
	const path1 = './src/index.ts'
	const path2 = 'src/index.ts'
	const absolutePath1 = PathUtils.resolve(path1)
	const absolutePath2 = PathUtils.resolve(path2)
	console.log(`路径1: ${path1} -> ${absolutePath1}`)
	console.log(`路径2: ${path2} -> ${absolutePath2}`)
	console.log(`是否相等: ${PathUtils.equals(absolutePath1, absolutePath2)}`)
	console.log('')

	// 示例5: 路径格式转换
	console.log('5. 路径格式转换:')
	const mixedPath = 'C:/Users\\boer/Desktop/project/src'
	console.log(`混合路径: ${mixedPath}`)
	console.log(`Unix格式: ${PathUtils.toUnix(mixedPath)}`)
	console.log(`Windows格式: ${PathUtils.toWindows(mixedPath)}`)
	console.log('')

	// 示例6: 调试信息
	console.log('6. 路径调试信息:')
	const debugPath = 'C:\\Users\\boer\\Desktop\\project\\src\\index.ts'
	const debugInfo = PathUtils.debug(debugPath)
	Object.entries(debugInfo).forEach(([key, value]) => {
		console.log(`${key}: ${value}`)
	})
}

/**
 * 处理常见的路径问题场景
 */
export function handleCommonPathIssues() {
	console.log('\n=== 常见路径问题处理示例 ===')

	// 问题1: Windows路径在TypeScript编译中的问题
	console.log('1. TypeScript编译路径问题:')
	const windowsSrcPath = 'D:\\Users\\boer\\Desktop\\monorepo\\packages\\backend\\src\\index.ts'
	const unixPathForTS = PathUtils.toUnix(windowsSrcPath)
	console.log(`原始Windows路径: ${windowsSrcPath}`)
	console.log(`TypeScript使用的Unix路径: ${unixPathForTS}`)
	console.log('')

	// 问题2: 临时目录权限问题
	console.log('2. 临时目录权限处理:')
	const systemTemp = PathUtils.getTempDir('test')
	console.log(`跨平台临时目录: ${systemTemp}`)
	console.log('')

	// 问题3: 相对路径和绝对路径的混用
	console.log('3. 路径标准化处理:')
	const mixedPaths = [
		'./src/index.ts',
		'..\\components\\Button.tsx',
		'/absolute/path/to/file.js',
		'C:\\Windows\\absolute\\path.bat'
	]

	mixedPaths.forEach(path => {
		const normalized = PathUtils.normalize(path)
		const isAbsolute = PathUtils.isAbsolute(path)
		const debug = PathUtils.debug(path)

		console.log(`路径: ${path}`)
		console.log(`  标准化: ${normalized}`)
		console.log(`  是否绝对路径: ${isAbsolute}`)
		console.log(`  存在: ${debug.exists}`)
		console.log('')
	})
}

/**
 * 在 gen/index.ts 中的实际应用示例
 */
export function genPathUsageExample() {
	console.log('\n=== gen/index.ts 中的实际应用示例 ===')

	const projectRoot = process.cwd()
	const targetFilePath = 'src/index.ts'
	const tsconfigPath = 'tsconfig.json'

	// 使用 PathUtils 替代原有的简单 join 函数
	const src = PathUtils.isAbsolute(targetFilePath)
		? targetFilePath
		: PathUtils.join(projectRoot, targetFilePath)

	const tsconfig = PathUtils.isAbsolute(tsconfigPath)
		? tsconfigPath
		: PathUtils.join(projectRoot, tsconfigPath)

	const tmpRoot = PathUtils.getTempDir('.ElysiaAutoOpenAPI')
	const distDir = PathUtils.join(tmpRoot, 'dist')

	console.log(`项目根目录: ${projectRoot}`)
	console.log(`目标文件路径: ${src}`)
	console.log(`TypeScript配置: ${tsconfig}`)
	console.log(`临时目录: ${tmpRoot}`)
	console.log(`输出目录: ${distDir}`)

	// 转换为Unix格式给TypeScript CLI使用
	const unixSrc = PathUtils.toUnix(src)
	const unixDistDir = PathUtils.toUnix(distDir)
	const unixTsconfig = PathUtils.toUnix(tsconfig)

	console.log('')
	console.log('TypeScript CLI 使用的路径 (Unix格式):')
	console.log(`源文件: ${unixSrc}`)
	console.log(`输出目录: ${unixDistDir}`)
	console.log(`配置文件: ${unixTsconfig}`)
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
	demonstratePathHandling()
	handleCommonPathIssues()
	genPathUsageExample()
}