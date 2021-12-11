const conditional = require('koa-conditional-get')
const etag = require('koa-etag')
const kompose = require('koa-compose')
const qs = require('qs')
const { error: errorToResponse } = require('./lib/error')
const { html } = require('./lib/html')
const { json } = require('./lib/json')
const { parseCookies } = require('./lib/parseCookies')
const { redirect } = require('./lib/redirect')
const { send } = require('./lib/send')

const {
  applySpec,
  compose,
  converge,
  curry,
  dissoc,
  either,
  merge,
  path,
  pipe,
  prop
} = require('ramda')

// setDefaults :: KoaContext -> KoaContext
const setDefaults = ctx => {
  ctx.set('Content-Type', 'application/octet-stream')
  return ctx
}

// parseProtocol :: KoaContext -> String
const parseProtocol = pipe(
  prop('request'),
  either(path(['headers', 'x-forwarded-proto']), prop('protocol'))
)

// parseQuery :: KoaContext -> Object
const parseQuery =
  compose(qs.parse, path(['request', 'querystring']))

// contextToRequest :: KoaContext -> PaperplaneRequest
const contextToRequest = applySpec({
  body: path(['request', 'body']),
  headers: prop('headers'),
  method: prop('method'),
  params: prop('params'),
  pathname: prop('path'),
  protocol: parseProtocol,
  query: parseQuery,
  url: prop('url')
})

// contextToPaperplane :: KoaContext -> PaperplaneRequest
const contextToPaperplane =
  converge(merge, [prop('state'), contextToRequest])

// handleError :: KoaContext -> Error -> PaperplaneReponse
const handleError = curry((ctx, err) => {
  if (!(err instanceof Error)) return err
  if (err.isAxiosError && !err.response) throw err

  const res = errorToResponse(err)

  if (res.statusCode >= 500 || err.cry) {
    ctx.app.emit('error', err, ctx)
  }

  if (err.expose === false || (err.expose == null && res.statusCode >= 500)) {
    return dissoc('body', res)
  }

  return res
})

// applyEtag :: (KoaContext, () -> Promise) -> Promise
const applyEtag =
  kompose([conditional(), etag()])

// writeResponse :: KoaContext -> PaperplaneResponse -> ()
const writeResponse = curry((ctx, res) => {
  const { body = '', headers = {}, statusCode = 200 } = res
  ctx.status = statusCode
  ctx.set(headers)
  ctx.body = body
})

// mount :: (PaperPlaneRequest -> PaperplaneResponse)
//       -> (KoaContext, () -> Promise)
//       -> Promise
const mount = handler => {
  const middle = ctx =>
    Promise.resolve(ctx)
      .then(setDefaults)
      .then(contextToPaperplane)
      .then(parseCookies)
      .then(handler)
      .catch(handleError(ctx))
      .then(writeResponse(ctx))

  return kompose([applyEtag, middle])
}

module.exports = {
  html,
  json,
  mount,
  redirect,
  send
}
