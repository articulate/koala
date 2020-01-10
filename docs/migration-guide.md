# Migration Guide

## From Paperplane

This library provides a subset of paperplane's core functionality. The differences are as follows.

* [`mount`](#mount)
  * [Cry & logger](#cry--logger)
  * [Lambda](#lambda)
  * [Middleware](#middleware)
* [`bufferBody` & `parseJson`](#bufferbody--parsejson) 
* [`cors`](#cors)
* [`logger`](#logger)
* [`routes` and `methods`](#routes--methods)
* [`serve`](#serve)
* [`use`](#use)

### [`mount`](API.md#mount)

The `mount` function only accepts a single handler function without any options.

**paperplane**
```js
const http = require('http')
const { mount, send } = require('paperplane')

const http.createServer(mount({ app: send }))
```

**koala**
```js
const Koa = require('koa')
const { mount, send } = require('@articulate/koala')

const server = new Koa()
server.use(mount(send))
```

### Cry & logger

Paperplane's `cry` & `log` functions are not supported.
* For logging, we can use one of [`koa's` third-party middleware](https://github.com/koajs/koa/wiki#logging) instead.
* For cry, errors that are emitted are printed to stderr by default. This behavior can be customized by adding an `error` event listener on the koa application.

See [koa's error handling](https://github.com/koajs/koa/blob/master/docs/error-handling.md) for more.

### Lambda

Serverless mode is not supported.

### Middleware

Redux middleware for unwrapping ADTs is not supported.

## [`bufferBody`](https://github.com/articulate/paperplane/blob/v3.1.1/docs/API.md#bufferbody) & [`parseJson`](https://github.com/articulate/paperplane/blob/v3.1.1/docs/API.md#parsejson)

This library does not parse request bodies. The value of `ctx.request.body` will be added to the [`Request`](getting-started.md#request-object). [Any middleware that sets `ctx.request.body is supported`](https://github.com/koajs/koa/wiki#body-parsing).

**paperplane**
```js
const http = require('http')
const { compose } = require('ramda')
const { mount, parseJson } = require('paperplane')

const handler = req => ({ body: req.body })
const app = compose(handler, parseJson)

http.createServer(mount({ app }))
```

**koala**
```js
const Koa = require('koa')
const bodyParser = require('koa-bodyparser')

const handler = req => ({ body: req.body })

const server = new Koa()
server.use(bodyParser())
server.use(mount(handler))
```

### [`cors`](https://github.com/articulate/paperplane/blob/v3.1.1/docs/API.md#cors)

No cors helper is provided. Use [third-party middleware](https://github.com/koajs/cors).

**paperplane**
```js
const http = require('http')
const { compose } = require('ramda')
const { cors, mount, send } = require('paperplane')

const opts = {
  headers: 'x-custom-header',
  methods: 'GET,PUT',
}

const app = cors(send, opts)

http.createServer(mount({ app }))
```

**koala**
```js
const Koa = require('koa')
const cors = require('koa-cors')
const { mount, send } = require('@articulate/koala')

const server = new Koa()

server.use(cors({
  allowedHeaders: 'x-custom-header',
  allowedMethods: 'GET,PUT'
}))

server.use(mount(send))
```

### [`logger`](https://github.com/articulate/paperplane/blob/v3.1.1/docs/API.md#logger)

No logger helper is provided. See koa's list of [logging middleware](https://github.com/koajs/koa/wiki#logging).

### [`routes`](https://github.com/articulate/paperplane/blob/v3.1.1/docs/API.md#routes) & [`methods`](https://github.com/articulate/paperplane/blob/v3.1.1/docs/API.md#methods)

No routing helpers are provided. Use [`koa middleware`](https://github.com/koajs/koa/wiki#routing-and-mounting) to provide routing to your application.

**paperplane**
```js
const http = require('http')
const { methods, mount, routes } = require('paperplane')

const crud = require('./crud')

const app = routes({
 '/collection': methods({
    GET: crud.readAll,
    POST: crud.create,
  }),

  '/collection/:entity': methods({
    GET: crud.readOne,
    PUT: crud.update,
    DELETE: crud.delete,
  })
})

http.createServer(mount({ app }))
```

**koala**
```js
const Koa = require('koa')
const Router = require('koa-router')
const { mount } = require('@articulate/koala')

const crud = require('./crud')

const router = new Router()
router.get('/collection', mount(crud.readAll))
router.post('/collection', mount(crud.create))
router.get('/collection/:entity', mount(crud.readOne))
router.put('/collection/:entity', mount(crud.update))
router.delete('/collection/:entity', mount(crud.delete))

const server = new Koa()
server.use(router.routes())
server.use(router.allowedMethods())
```

### [`serve`](https://github.com/articulate/paperplane/blob/v3.1.1/docs/API.md#serve)

No file serving helpers are provided. [See koa's list of middleware](https://github.com/koajs/koa/wiki#file-serving).

### [`use`](https://github.com/articulate/paperplane/blob/v3.1.1/docs/API.md#use)

Connect-style middleware is not supported. See [koa's list of middleware](https://github.com/koajs/koa/wiki) or [`koa-connect`](https://github.com/vkurchatkin/koa-connect) to convert connect middleware to koa middleware.
