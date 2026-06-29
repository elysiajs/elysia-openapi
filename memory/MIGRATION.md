## 1. Hook and handler argument are swapped

The verb methods take the **schema/hook object before the handler**.

Applies to `get`/`post`/`put`/`patch`/`delete`/`options`/`head`/`all`/`method`

**Migration:** swap position of hook and handler

```ts
// 1.x
app.get('/user/:id', ({ params, query }) => params.id, {
  params: t.Object({ id: t.Number() }),
  query: t.Object({ name: t.String() })
})

// 2.0
app.get('/user/:id', {
  params: t.Object({ id: t.Number() }),
  query: t.Object({ name: t.String() })
}, ({ params, query }) => params.id)

// no hook, unchanged
app.get('/', () => 'hi')
```

---

## 2. WebSocket

- `.ws()` now accept 2-3 arguments
	- 2-arg forms (`.ws('/ws', handler)`, `.ws('/ws', options)`) are unchanged
	- 3-arg form is now `.ws('/ws', options, handler)`
- `ws.data` is now inline to `ws` directly
- generator function and `yield` is now preferred way of sending data instead of `ws.send` for type safety

```ts
// 1.x
new Elysia()
	.ws('/', {
		message({ send, data: { params: { id } } }) {
			send(id)
		}
	})

// 2.x
new Elysia()
	.ws('/', ({ params: { id } }) => id)
```

## 3. Drop `on` prefix for event

Use the bare-named methods.

| Removed | Use |
|---|---|
| `onRequest` | `request` |
| `onParse` | `parse` |
| `onTransform` | `transform` |
| `onBeforeHandle` | `beforeHandle` |
| `onAfterHandle` | `afterHandle` |
| `onAfterResponse` | `afterResponse` |
| `onError` | `error` |

The lifecycle hooks are also **renamed** (not just de-prefixed): `onStart` → **`setup`**, `onStop`
→ **`cleanup`**.

```ts
// 1.x
app.
	onRequest(fn)
	.onBeforeHandle(fn)
	.onAfterResponse(fn)

// 2.0
app
	.request(fn)
	.beforeHandle(fn)
	.afterResponse(fn)
```

---

## 4. Code is drop from error

- `error(ErrorClass, fn)` registers a per-class handler
- `error(fn)` registers the general handler
- **`error.code` is removed**: dispatch with `instanceof` or `error(SomeError, fn)`

```ts
// 1.x
app
	.onError(({ code, error }) => {
	  	if (code === 'NOT_FOUND') return 'nope'
	})

// 2.0
app.error(NotFound, () => 'nope')
app.error(({ error }) => { /* ... */ })
```

---

## 5. `resolve` removed entirely

- `derive` now run on `beforeHandle` (previous `resolve` behavior)
- `resolve` are now removed

```ts
// 1.x
app.resolve(({ headers }) => ({ user: auth(headers) }))
// 2.0
app.derive(({ headers }) => ({ user: auth(headers) }))
```

## 6. Scope changes

- The `'scoped'` scope is **renamed to `'plugin'`**
- The `{ as: 'scope' }` **object form is removed**
- `.decorate()` / `.state()` `{ as: 'append' | 'override' }`

```ts
// 1.x
app.beforeHandle({ as: 'scoped' }, fn)
app.as('scoped')
app.guard({ as: 'scoped' }, fn)
app.decorate({ as: 'override' }, 'db', db)

// 2.0
app.beforeHandle('plugin', fn)
app.as('plugin')
app.guard('plugin', fn)
app.decorate('override', 'db', db)
```

---

## 7. Guard/group default to OVERRIDE channel

**Every** `.guard()` and `.group()` is default to **override**

- the closer to the route, the more power, the nearer schema **replaces** an inherited one
- `schema: 'standalone'` is explicitly required across all APIs

**Migration:** if you use `guard`, add `schema: 'standalone'`:

```ts
// 1.x string-scope & run forms were implicitly additive (standalone)
app.guard({ body: t.Object({ a: t.String() }) })

// 2.0 now overrides by default; prefer closer schema first
app.guard({ schema: 'standalone', body: t.Object({ a: t.String() }) })
```

---

## 8. TypeBox 1.0 alignment

See [TypeBox 1.0 migration](https://github.com/sinclairzx81/typebox/blob/main/changelog/1.0.0-migration.md)

But to summarize:
- `t.Transform` → **`t.Codec`**.
- Removed `t.Recursive`, `t.Not`, `t.RegExp`
- **`t.NoValidate` semantics changed:** now skips `Check` only `Default`/`Convert`/`Decode`/`Encode` still run.
	- `NoValidate` will throw `ValidationError` if Encode runs.
- `Error.summary` now uses TypeBox's default message (and supports Standard Schema).

---

## 9. Macros

- **Functional macro must use the object form:** `.macro({ name: fn })`.
- **`.macro(name, definition)` removed**, use `.macro({ [name]: definition })`.
	- The object form is now fully inferred (own schema, derive results, function-form arg, typo rejection)
- **Requires TypeScript ≥ 5.7** for macro definition inference.

```ts
// 1.x named form
app.macro('auth', {
  resolve: ({ headers }) => ({ user: auth(headers) })
})

// 2.0 object form only (fully inferred)
app.macro({
  auth: {
    resolve: ({ headers }) => ({ user: auth(headers) })
  }
})
```

## 10. Removed / renamed APIs & exports

- `NotFoundError` → **`NotFound`** (a thrown 404 is `instanceof NotFound`)
- `getSchemaValidator` → **`Validator.create`**
- `set.redirect`: use the `redirect()` context helper
- `context.contentType` is removed from `Context` in `parse`, use `context.contentType` instead
- Deprecated `response` field on `mapResponse`/`afterResponse` is removed
- Removed instance methods `.route()`, `.connect()`, `.env()`,
  `.affix()`/`.prefix()`/`.suffix()` and the `.store`/`.decorator`/`.config`
  **instance getters**, use the verb methods, `new Elysia({ name, prefix })` for
  plugin naming, and in-handler `context.store`/`context.decorator`
- Passing an Elysia instance to `.mount` is deprecated, use `.use` instead
- `config.encodeSchema` dropped (always enabled now)

```ts
import { NotFound } from 'elysia'          // was NotFoundError
import { Validator } from 'elysia'         // getSchemaValidator → Validator.create

// redirect
;({ set }) => { set.redirect = '/' }       // 1.x
;({ redirect }) => redirect('/')           // 2.0

// afterResponse / mapResponse field
app.afterResponse(({ responseValue }) => {})   // was `response`

// parse contentType
app.parse((ctx, contentType) => {})        // 1.x (2nd param)
app.parse((ctx) => ctx.contentType)        // 2.0

// removed instance getters / methods → use context or constructor
new Elysia({ name: 'x', prefix: '/v1' })   // was .prefix()/.affix()/.suffix()/name
;({ store, decorator }) => {}              // was app.store / app.decorator getters

// mount an instance
app.use(plugin)                            // was app.mount(plugin)
```

---

## 11. Behavior changes worth knowing (no API change, but observable)

- **`afterHandle` skips the rest on short-circuit.**
- **Bodyless `GET`/`HEAD` no longer run `parse` hooks**, a `parse` hook that must run on every request belongs in `request`/`transform`
- **422 response no longer echoes large bodies**, `found` is scoped; a request body whose JSON exceeds 4KB isn't reflected back in full. `error.value` still exposes the full value to custom handlers.
- **Returned `Response` passed by reference when `set` is untouched** (preserves
  `content-length`).
	- **Trap:** returning the *same* `Response` object across requests while writing per-request `set.headers` now mutates the shared object and leaks headers (previously errored loudly). Return a fresh `Response` per
  request.
- **`streamResponse` yields raw bytes**, re-streamed bodies are now byte-identical; a headerless binary-first chunked stream defaults to `application/octet-stream` (was `application/json`)
- **WS query parsing** now matches HTTP (duplicate keys → arrays, not last-wins; null-prototype records)
- **Validator runs `Convert → Check → DecodeUnsafe`** for codec schemas (fixes `t.Numeric({ minimum, maximum })` and `t.Codec(...).Decode(...)` against wire input)
- When file use `t.File` has `type` **`t.File({ type: 'image/jpg' })`**, project must initialize `setFileTypeDetector` with a function that returns the MIME type. (By default Elysia use `file-type` package to detect file type)
