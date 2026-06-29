import { Elysia, t } from 'elysia'
import { openapi, withHeaders } from '../../src'
import { fromTypes } from '../../src/gen'

export const app = new Elysia()
	.model({
		'character.name': t.String(),
		'character.thing': t.Object({
			name: t.String()
		})
	})
	.get(
		'/const',
		() =>
			({
				name: 'Lilith',
				friends: ['Sartre', 'Fouco']
			}) as const
	)
	.get('/', {
			response: {
				204: withHeaders(
					t.Void({
						title: 'Thing',
						description: 'Void response'
					}),
					{
						'X-Custom-Header': t.Literal('Elysia')
					}
				)
			}
		}, () =>
			({ test: 'hello' as const }) as any as
				| { test: 'hello' }
				| undefined)
	.post('/json', {
			body: t.Object({
				hello: t.String()
			})
		}, ({ body, status }) => (Math.random() > 0.5 ? status(418) : body))
	.post('/character', {
			body: 'character.name'
		}, () => ({
			name: 'Lilith' as const
		}))
	.get('/no-manual', () => ({
		name: 'lilith'
	}))
