import { describe, it, expect } from 'bun:test'
import { Elysia } from 'elysia'

import { toOpenAPISchema } from '../../src/openapi'

const getPathKeys = (app: Elysia, exclude?: Parameters<typeof toOpenAPISchema>[1]) =>
	Object.keys(toOpenAPISchema(app, exclude).paths)

const app = new Elysia()
	.get('/users', () => 'ok')
	.get('/users/:id', () => 'ok')
	.get('/posts', () => 'ok')
	.get('/posts/:id', () => 'ok')
	.get('/health', () => 'ok')

describe('OpenAPI > exclude.paths', () => {
	it('includes all paths when exclude.paths is undefined', () => {
		const paths = getPathKeys(app, { paths: undefined })
		expect(paths).toContain('/users')
		expect(paths).toContain('/users/{id}')
		expect(paths).toContain('/posts')
		expect(paths).toContain('/posts/{id}')
		expect(paths).toContain('/health')
	})

	it('excludes a single string path', () => {
		const paths = getPathKeys(app, { paths: '/health' })
		expect(paths).not.toContain('/health')
		expect(paths).toContain('/users')
		expect(paths).toContain('/posts')
	})

	it('excludes multiple string paths in an array', () => {
		const paths = getPathKeys(app, { paths: ['/health', '/posts'] })
		expect(paths).not.toContain('/health')
		expect(paths).not.toContain('/posts')
		expect(paths).toContain('/users')
		expect(paths).toContain('/posts/{id}')
	})

	it('excludes paths matching a single RegExp', () => {
		const paths = getPathKeys(app, { paths: /^\/posts/ })
		expect(paths).not.toContain('/posts')
		expect(paths).not.toContain('/posts/{id}')
		expect(paths).toContain('/users')
		expect(paths).toContain('/users/{id}')
		expect(paths).toContain('/health')
	})

	it('excludes paths matching any RegExp in an array', () => {
		const paths = getPathKeys(app, { paths: [/^\/posts/, /^\/health/] })
		expect(paths).not.toContain('/posts')
		expect(paths).not.toContain('/posts/{id}')
		expect(paths).not.toContain('/health')
		expect(paths).toContain('/users')
		expect(paths).toContain('/users/{id}')
	})

	it('excludes paths matching a mixed (string | RegExp)[] array', () => {
		const paths = getPathKeys(app, { paths: ['/health', /^\/posts/] })
		expect(paths).not.toContain('/health')
		expect(paths).not.toContain('/posts')
		expect(paths).not.toContain('/posts/{id}')
		expect(paths).toContain('/users')
		expect(paths).toContain('/users/{id}')
	})

	it('does not exclude paths that only partially match a string', () => {
		const paths = getPathKeys(app, { paths: '/post' })
		// '/post' should not exclude '/posts' or '/posts/:id'
		expect(paths).toContain('/posts')
		expect(paths).toContain('/posts/{id}')
	})

	it('does not exclude paths that do not match a RegExp', () => {
		const paths = getPathKeys(app, { paths: /^\/admin/ })
		expect(paths).toContain('/users')
		expect(paths).toContain('/users/{id}')
		expect(paths).toContain('/posts')
		expect(paths).toContain('/posts/{id}')
		expect(paths).toContain('/health')
	})

	it('excludes exact string matches only', () => {
		const paths = getPathKeys(app, { paths: ['/users', '/posts/:id'] })
		expect(paths).not.toContain('/users')
		expect(paths).not.toContain('/posts/{id}')
		expect(paths).toContain('/users/{id}')
		expect(paths).toContain('/posts')
		expect(paths).toContain('/health')
	})
})
