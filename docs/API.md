# API

| Function                | Description                                     |
| ---                     | ---                                             |
| [`html`](#html)         | response helper, type `text/html`               |
| [`json`](#json)         | response helper, type `application/json`        |
| [`mount`](#mount)       | converts a paperplane handler to koa middleware |
| [`redirect`](#redirect) | redirect response helper                        |
| [`send`](#send)         | basic response helper                           |

### html

```haskell
html :: (String | Buffer | Stream) -> Response
```

Port from [`paperplane`](https://github.com/articulate/paperplane/blob/v3.1.1/docs/API.md#html).

Returns a [`Response`](getting-started.md#response-object), with the `content-type` header set to `text/html`.

See also [`json`](#json), [`redirect`](#redirect), [`send`](#send).

```js
const { html } = require('@articulate/koala')
const template = require('../views/template.pug')

const usersPage = () =>
  fetchUsers()
    .then(template)
    .then(html)
```

In the example above, it resolves with a [`Response`](getting-started.md#response-object) similar to:

```js
{
  body: '<html>...</html>',
  headers: {
    'content-type': 'text/html'
  },
  statusCode: 200
}
```

### json

```haskell
json :: a -> Response
```

Port from [`paperplane`](https://github.com/articulate/paperplane/blob/v3.1.1/docs/API.md#json).

Returns a [`Response`](getting-started.md#response-object), with a `body` encoded with `JSON.stringify`, and the `content-type` header set to `application/json`.

See also [`html`](#html), [`redirect`](#redirect), [`send`](#send).

```js
const { json } = require('@articulate/koala')

const users = () =>
  fetchUsers()
    .then(json)
```

In the example above, it resolves with a [`Response`](getting-started.md#response-object) similar to:

```js
{
  body: '[{"id":1,"name":"John"}]',
  headers: {
    'content-type': 'application/json'
  },
  statusCode: 200
}
```

### mount

```haskell
mount :: Request -> Promise Response
```

Wraps a paperplane handler in Koa v2 middleware.

```js
const Koa = require('koa')
const { mount } = require('@articulate/koala')

const handler = () =>
  Promise.resolve({ statusCode: 200 })

const server = new Koa()
server.use(mount(handler))

server.listen(3000)
```

### redirect

```haskell
redirect :: (String, Number) -> Response
```

Port from [`paperplane`](https://github.com/articulate/paperplane/blob/v3.1.1/docs/API.md#redirect).

Accept a `Location` and optional `statusCode` (defaults to `302`), and returns a [`Response`](getting-started.md#response-object) denoting a redirect.

**Pro-tip:** if you want an earlier function in your composed application to respond with a redirect and skip everything else, just wrap it in a `Promise.reject` (see example below).  The error-handling code in `koala` will ignore it since it's not a real error.

See also [`html`](#html), [`json`](#json), [`send`](#send).

```js
const Koa = require('koa')
const Router = require('koa-router')
const { compose, composeP } = require('ramda')
const { html, mount, send } = require('@articulate/koala')

const login = require('./views/login')

// Please make your authorization better than this
const authorize = req =>
  req.headers.authorization
    ? Promise.resolve(req)
    : Promise.reject(redirect('/login'))

const echo = req =>
  Promise.resolve(req.body).then(send)

const router = new Router()
router.post('/echo', mount(composeP(echo, authorize)))
router.get('/login', mount(compose(html, loginPage)))

const server = new Koa()
server.use(router.routes())
server.use(router.allowedMethods())

server.listen(3000)
```

In the example above, `redirect()` returns a [`Response`](getting-started.md#response-object) similar to:

```js
{
  body: '',
  headers: {
    Location: '/login'
  },
  statusCode: 302
}
```

### send

```haskell
send :: (String | Buffer | Stream) -> Response
```

Port from [`paperplane`](https://github.com/articulate/paperplane/blob/v3.1.1/docs/API.md#send).

The most basic response helper.  Simply accepts a `body`, and returns a properly formatted [`Response`](getting-started.md#response-object), without making any further assumptions.

See also [`html`](#html), [`json`](#json), [`redirect`](#redirect).

```js
const { send } = require('@articulate/koala')

send('This is the response body')
```

In the example above, it returns a [`Response`](https://github.com/articulate/paperplane/blob/master/docs/getting-started.md#response-object) similar to:

```js
{
  body: 'This is the response body',
  headers: {},
  statusCode: 200
}
```
