import { Elysia, t } from 'elysia'
import type { SSEPayload } from 'elysia'

type User = { id: string; name: string; profile: Profile }
type Profile = { bio: string; age: number }
interface Account {
	owner: User
	active: boolean
}

export const app = new Elysia()
	// named type alias as response (no runtime schema)
	.post('/named', { body: t.Object({ id: t.String() }) }, () => ({}) as User)
	// interface, with a nested named type
	.get('/interface', () => ({}) as Account)
	// inline object literal
	.get('/inline', () => ({}) as { a: string; b: number })
	// primitive
	.get('/primitive', () => 'hello' as string)
	// array of a named type
	.get('/array', () => [] as User[])
	// imported generic type (from elysia) — the declaration parser can't see
	// its definition, so it's resolved via the TypeScript checker
	.get('/imported', () => ({}) as SSEPayload)
	// trailing route (last in chain) returning a named type
	.get('/trailing', () => ({}) as User)
