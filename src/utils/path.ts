import { join, resolve, sep, isAbsolute } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { existsSync } from 'node:fs'

/**
 * 跨平台路径处理工具类
 * 解决 Windows/Linux/macOS 路径兼容性问题
 */
export class PathUtils {
	/**
	 * 获取系统特定的路径分隔符
	 */
	static separator = sep

	/**
	 * 标准化路径 - 将所有路径转换为当前系统的标准格式
	 * @param path 要标准化的路径
	 * @returns 标准化后的路径
	 */
	static normalize(path: string): string {
		if (!path) return path

		// 将 Windows 反斜杠转换为当前系统的分隔符
		let normalized = path.replace(/\\/g, this.separator)

		// 处理重复的分隔符（除了网络路径的 \\ 开头）
		if (this.separator === '/' || !normalized.startsWith('\\\\')) {
			normalized = normalized.replace(new RegExp(`${this.separator}{2,}`, 'g'), this.separator)
		}

		// 移除末尾的分隔符（根目录除外）
		if (normalized.length > 1 && normalized.endsWith(this.separator)) {
			normalized = normalized.slice(0, -1)
		}

		return normalized
	}

	/**
	 * 统一路径格式为 Unix 风格（用于比较和显示）
	 * @param path 要转换的路径
	 * @returns Unix 风格的路径
	 */
	static toUnix(path: string): string {
		return path.replace(/\\/g, '/')
	}

	/**
	 * 统一路径格式为 Windows 风格（用于比较和显示）
	 * @param path 要转换的路径
	 * @returns Windows 风格的路径
	 */
	static toWindows(path: string): string {
		return path.replace(/\//g, '\\')
	}

	/**
	 * 智能路径连接 - 自动处理不同平台的路径连接
	 * @param parts 路径片段
	 * @returns 连接后的路径
	 */
	static join(...parts: string[]): string {
		if (parts.length === 0) return ''

		// 标准化所有路径片段
		const normalizedParts = parts.map(part => this.normalize(part))

		// 使用 Node.js 原生 join 方法
		return this.normalize(join(...normalizedParts))
	}

	/**
	 * 获取绝对路径
	 * @param path 路径
	 * @param base 基础路径（可选）
	 * @returns 绝对路径
	 */
	static resolve(path: string, base?: string): string {
		if (base) {
			return this.normalize(resolve(base, path))
		}
		return this.normalize(resolve(path))
	}

	/**
	 * 检查路径是否为绝对路径
	 * @param path 路径
	 * @returns 是否为绝对路径
	 */
	static isAbsolute(path: string): boolean {
		// Windows 盘符检查
		if (/^[a-zA-Z]:/.test(path)) return true
		// Unix 绝对路径检查
		if (path.startsWith('/')) return true
		// Windows 网络路径检查
		if (path.startsWith('\\\\')) return true

		return isAbsolute(path)
	}

	/**
	 * 获取相对于基础路径的相对路径
	 * @param from 起始路径
	 * @param to 目标路径
	 * @returns 相对路径
	 */
	static relative(from: string, to: string): string {
		const { relative } = require('node:path')
		return this.normalize(relative(from, to))
	}

	/**
	 * 获取临时目录路径
	 * @param prefix 目录前缀
	 * @returns 临时目录路径
	 */
	static getTempDir(prefix = 'elysia-openapi'): string {
		const systemTemp = tmpdir()

		// Windows: 使用项目目录下的 node_modules/.cache 避免权限问题
		if (process.platform === 'win32') {
			const projectCache = this.join(process.cwd(), 'node_modules', '.cache', prefix)
			return projectCache
		}

		// Unix 系统: 使用系统临时目录
		return this.join(systemTemp, prefix)
	}

	/**
	 * 获取用户主目录
	 * @returns 用户主目录路径
	 */
	static getHomeDir(): string {
		return this.normalize(homedir())
	}

	/**
	 * 确保目录存在（如果不存在则创建）
	 * @param dirPath 目录路径
	 */
	static ensureDir(dirPath: string): void {
		const { mkdirSync } = require('node:fs')

		if (!existsSync(dirPath)) {
			mkdirSync(dirPath, { recursive: true })
		}
	}

	/**
	 * 安全删除文件或目录（处理 Windows 锁定问题）
	 * @param targetPath 要删除的路径
	 * @param retries 重试次数
	 * @param delay 重试延迟（毫秒）
	 */
	static safeRemove(targetPath: string, retries = 3, delay = 100): boolean {
		const { rmSync, existsSync } = require('node:fs')

		if (!existsSync(targetPath)) {
			return true
		}

		for (let i = 0; i < retries; i++) {
			try {
				rmSync(targetPath, {
					recursive: true,
					force: true,
					maxRetries: retries - i,
					retryDelay: delay
				})
				return true
			} catch (error: any) {
				// Windows EBUSY 或 EPERM 错误，重试
				if (process.platform === 'win32' &&
					(error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'ENOENT')) {
					if (i < retries - 1) {
						// 等待后重试
						setTimeout(() => {}, delay)
						continue
					}
				}
				// 其他错误或重试次数用完，抛出异常
				throw error
			}
		}

		return false
	}

	/**
	 * 比较两个路径是否相等（跨平台）
	 * @param path1 路径1
	 * @param path2 路径2
	 * @returns 是否相等
	 */
	static equals(path1: string, path2: string): boolean {
		const unix1 = this.toUnix(this.resolve(path1)).toLowerCase()
		const unix2 = this.toUnix(this.resolve(path2)).toLowerCase()
		return unix1 === unix2
	}

	/**
	 * 获取路径的文件扩展名
	 * @param path 路径
	 * @returns 扩展名（包含点号）
	 */
	static extname(path: string): string {
		const { extname } = require('node:path')
		return extname(path)
	}

	/**
	 * 获取路径的目录部分
	 * @param path 路径
	 * @returns 目录部分
	 */
	static dirname(path: string): string {
		const { dirname } = require('node:path')
		return this.normalize(dirname(path))
	}

	/**
	 * 获取路径的文件名部分
	 * @param path 路径
	 * @param withExtension 是否包含扩展名
	 * @returns 文件名
	 */
	static basename(path: string, withExtension = true): string {
		const { basename } = require('node:path')
		if (withExtension) {
			return basename(path)
		}
		const { extname } = require('node:path')
		return basename(path, extname(path))
	}

	/**
	 * 检查路径是否存在
	 * @param path 路径
	 * @returns 是否存在
	 */
	static exists(path: string): boolean {
		return existsSync(path)
	}

	/**
	 * 调试用：获取路径的详细信息
	 * @param path 路径
	 * @returns 路径信息
	 */
	static debug(path: string): {
		original: string
		normalized: string
		unix: string
		windows: string
		isAbsolute: boolean
		exists: boolean
		platform: string
	} {
		return {
			original: path,
			normalized: this.normalize(path),
			unix: this.toUnix(path),
			windows: this.toWindows(path),
			isAbsolute: this.isAbsolute(path),
			exists: this.exists(path),
			platform: process.platform
		}
	}
}

// 导出常用函数的简写形式，避免命名冲突
export const normalizePath = PathUtils.normalize.bind(PathUtils)
export const joinPath = PathUtils.join.bind(PathUtils)
export const resolvePath = PathUtils.resolve.bind(PathUtils)
export const isAbsolutePath = PathUtils.isAbsolute.bind(PathUtils)
export const getTempDirectory = PathUtils.getTempDir.bind(PathUtils)
export const safeRemovePath = PathUtils.safeRemove.bind(PathUtils)
export const pathsEqual = PathUtils.equals.bind(PathUtils)
export const convertToUnix = PathUtils.toUnix.bind(PathUtils)
export const convertToWindows = PathUtils.toWindows.bind(PathUtils)

export default PathUtils