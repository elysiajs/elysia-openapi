import { Elysia, HTTPError } from 'elysia'

class OutOfStock extends HTTPError.id('OUT_OF_STOCK', 409) {}

export const app = new Elysia().get('/id/:id', ({ params: { id } }) => {
	if (Math.random() > 0.5) return new OutOfStock()

	return `bought ${id}` as const
})
