import { Elysia, t } from 'elysia'

export const plugin = new Elysia({
    prefix: '/a'
})
    .model({
        sign: t.Object(
            {
                username: t.String(),
                password: t.String()
            },
            {
                description: 'Models for handling authentication'
            }
        ),
        number: t.Number()
    })
    .get('/', ({ set }) => 'hi', {
        detail: {
            summary: 'Ping Pong',
            description: 'Lorem Ipsum Dolar',
            tags: ['Test']
        }
    })
    .get('/unpath/:id', ({ params: { id } }) => id, {
        params: t.Object({
            id: t.String({
                description: 'Extract value from path parameter'
            })
        }),
        detail: {
            deprecated: true
        }
    })
    .post('/json', ({ body }) => body, {
        type: 'json',
        body: 'sign',
        response: {
            200: 'sign'
        },
        detail: {
            summary: 'Using reference model'
        }
    })
    .post(
        '/json/:id',
        ({ body, params: { id }, query: { name, email, } }) => ({
            ...body,
            id
        }),
        {
            body: 'sign',
            params: t.Object({
                id: t.Numeric()
            }),
            query: t.Object({
                name: t.String(),
                email: t.String({
                    description: 'sample email description',
                    format: 'email',
                    examples: ['test@test.com']
                }),
                birthday: t.String({
                    description: 'sample birthday description',
                    pattern: '\\d{4}-\\d{2}-\\d{2}',
                    minLength: 10,
                    maxLength: 10,
                    examples: ['2024-01-01']
                }),
                gender: t.Union([t.Literal('M'), t.Literal('F')])
            }),
            response: {
                200: t.Object(
                    {
                        id: t.Number(),
                        username: t.String(),
                        password: t.String()
                    },
                    {
                        title: 'User',
                        description: "Contains user's confidential metadata"
                    }
                ),
                418: t.Array(
                    t.Object({
                        error: t.String()
                    })
                ),
            },
            detail: {
                summary: 'Complex JSON'
            }
        }
    )
    .post('/file', ({ body: { file } }) => file, {
        type: 'formdata',
        body: t.Object({
            file: t.File({
                type: ['image/jpeg', 'image/'],
                minSize: '1k',
                maxSize: '5m'
            })
        }),
        response: t.File()
    })
// .post('/files', ({ body: { files } }) => files[0], {
//     schema: {
//         body: t.Object({
//             files: t.Files({
//                 type: 'image',
//                 maxSize: '5m'
//             })
//         }),
//         response: t.File()
//     }
// })
