const axios = require('axios').default
const { always: K, compose, pick, prop } = require('ramda')
const { expect } = require('chai')
const createHttpError = require('http-errors')
const { Readable } = require('stream')
const { validate } = require('@articulate/funky')
const Boom = require('@hapi/boom')
const Joi = require('joi')
const Koa = require('koa')
const Router = require('koa-router')
const http = require('http')
const request = require('supertest')
const spy = require('@articulate/spy')
const str = require('string-to-stream')
const nock = require('nock')

const assertBody = require('./lib/assertBody')
const errorStream = require('./lib/errorStream')

const { json, mount } = require('../')

describe('mount', () => {
  const router = new Router()

  router.get('/axios', mount(() => { return axios.get('http://127.0.0.1/dummy-url') }))
  router.get('/body', mount(req => json({ isReadable: req.body instanceof Readable })))
  router.post('/body', mount(req => json({ isReadable: req.body instanceof Readable })))
  router.get('/boom', mount(() => { throw Boom.unauthorized('error message', 'Basic', { realm: 'protected area' }) }))
  router.get('/boom-expose', mount(() => { throw Object.assign(Boom.unauthorized('error message', 'Basic', { realm: 'protected area' }), { expose: true }) }))
  router.get('/boom-hidden', mount(() => { throw Object.assign(Boom.unauthorized('error message', 'Basic', { realm: 'protected area' }), { expose: false }) }))
  router.get('/broke', mount(() => ({ body: errorStream() })))
  router.get('/buffer', mount(K({ body: Buffer.from([0x62, 0x75, 0x66, 0x66, 0x65, 0x72]) })))
  router.get('/cookie', mount(compose(json, prop('cookies'))))
  router.get('/cry', mount(() => { throw Object.assign(Boom.badRequest(), { cry: true }) }))
  router.get('/error', mount(() => { throw new Error('error') }))
  router.get('/error-expose', mount(() => { throw Object.assign(new Error('error'), { expose: true }) }))
  router.get('/error-hidden', mount(() => { throw Object.assign(new Error('error'), { expose: false }) }))
  router.get('/http', mount(() => { throw new createHttpError.NotFound() }))
  router.get('/http-expose', mount(() => { throw createHttpError(404, 'Not Found', { expose: true }) }))
  router.get('/http-hidden', mount(() => { throw createHttpError(404, 'Not Found', { expose: false }) }))
  router.get('/joi', mount(() => validate(Joi.string(), 123)))
  router.get('/joi-expose', mount(() => validate(Joi.string(), 123).catch(err => Promise.reject(Object.assign(err, { expose: true })))))
  router.get('/joi-hidden', mount(() => validate(Joi.string(), 123).catch(err => Promise.reject(Object.assign(err, { expose: false })))))
  router.get('/json', mount(K(json({}))))
  router.get('/none', mount(K({ body: undefined })))
  router.get('/protocol', mount(compose(json, pick(['protocol']))))
  // eslint-disable-next-line prefer-promise-reject-errors
  router.get('/reject', mount(() => Promise.reject({ body: 'rejected' })))
  router.get('/stream', mount(() => ({ body: str('stream') })))
  router.get('/string', mount(K({ body: 'string' })))
  router.get('/url', mount(compose(json, pick(['pathname', 'query']))))

  const cry = spy()
  const logger = spy()

  const koa = new Koa()
  koa.on('error', cry)
  koa.use(router.routes())
  koa.use(router.allowedMethods())

  const server = http.createServer(koa.callback())
  const agent = request.agent(server)

  afterEach(() => {
    cry.reset()
    logger.reset()
  })

  after(() => {
    server.close()
  })

  describe('request', () => {
    it('parses the pathname and query', () =>
      agent.get('/url?foo=bar')
        .expect(200, { pathname: '/url', query: { foo: 'bar' } })
    )

    it('parses the protocol', () =>
      agent.get('/protocol')
        .expect(200, { protocol: 'http' })
    )

    it('parses the cookies', function (done) {
      agent.get('/cookie')
        .set('cookie', 'foo=bar; equation=E%3Dmc%5E2')
        .end((err, res) => {
          expect(res.body.foo).to.equal('bar')
          expect(res.body.equation).to.equal('E=mc^2')
          done()
        })
    })
  })

  describe('request headers', () => {
    describe('if-none-match header does not match etag', () => {
      it('returns 200 with full response body', () =>
        agent.get('/string').set({ 'if-none-match': '"not-the-right-etag"' })
          .expect(200)
          .expect('etag', '"6-7LJSBEteoPZ57njsGhKQRznikE0"')
          .then(assertBody('string'))
      )
    })

    describe('if-none-match header matches etag', () => {
      it('returns 304 with empty response body', () =>
        agent.get('/string').set({ 'if-none-match': '"6-7LJSBEteoPZ57njsGhKQRznikE0"' })
          .expect(304, '')
          .expect('etag', '"6-7LJSBEteoPZ57njsGhKQRznikE0"')
      )
    })

    describe('when content-length is "0"', () => {
      it('does not parse the body', () =>
        agent.get('/body')
          .set('content-length', '0')
          .expect(200)
      )
    })

    describe('when content-type is missing', () => {
      it('does not explode', () =>
        agent.post('/body')
          .send('body')
          .set('content-type', '')
          .expect(200)
      )
    })

    it('uses x-forwarded-proto when present', () =>
      agent.get('/protocol')
        .set('x-forwarded-proto', 'https')
        .expect(200, { protocol: 'https' })
    )
  })

  describe('response body', () => {
    it('accepts a buffer', () =>
      agent.get('/buffer').expect(200).then(assertBody('buffer'))
    )

    it('accepts a string', () =>
      agent.get('/string').expect(200).then(assertBody('string'))
    )

    it('accepts a stream', () =>
      agent.get('/stream').expect(200).then(assertBody('stream'))
    )

    it('accepts undefined to denote a no-content body', () =>
      agent.get('/none').expect(200, undefined)
    )

    it('drops body if method is HEAD', () =>
      agent.head('/buffer')
        .expect(200, undefined)
        .expect('content-length', '6')
    )
  })

  describe('response headers', () => {
    it('accepts an object of headers', () =>
      agent.get('/json').expect('content-type', 'application/json')
    )

    it('defaults the content-type to "application/octet-stream"', () =>
      agent.get('/string').expect('content-type', 'application/octet-stream')
    )

    it('sets the content-length header for buffers', () =>
      agent.get('/buffer').expect('content-length', '6')
    )

    it('sets the content-length header for strings', () =>
      agent.get('/string').expect('content-length', '6')
    )

    it('sets the etag header for buffers', () =>
      agent.get('/buffer').expect('etag', '"6-5Twuof5L0reL9HI8fBVaV44CCiU"')
    )

    it('sets the etag header for strings', () =>
      agent.get('/string').expect('etag', '"6-7LJSBEteoPZ57njsGhKQRznikE0"')
    )
  })

  describe('errors', () => {
    it('defaults statusCode to 500', () =>
      agent.get('/error').expect(500).then(res => {
        expect(res.body.toString('utf-8')).to.equal('')
        expect(cry.calls.length).to.equal(1)
        expect(cry.calls[0][0]).to.be.instanceOf(Error)
          .that.has.property('message', 'error')
        // duck type koa context
        expect(cry.calls[0][1]).to.have.property('app', koa)
      })
    )

    it('defaults statusCode to 500, exposed', () =>
      agent.get('/error-expose').expect(500).then(res => {
        expect(res.body).to.deep.equal({
          message: 'error',
          name: 'Error'
        })
        expect(cry.calls.length).to.equal(1)
        expect(cry.calls[0][0]).to.be.instanceOf(Error)
          .that.has.property('message', 'error')
        // duck type koa context
        expect(cry.calls[0][1]).to.have.property('app', koa)
      })
    )

    it('defaults statusCode to 500, hidden', () =>
      agent.get('/error-hidden').expect(500).then(res => {
        expect(res.body.toString('utf-8')).to.equal('')
        expect(cry.calls.length).to.equal(1)
        expect(cry.calls[0][0]).to.be.instanceOf(Error)
          .that.has.property('message', 'error')
        // duck type koa context
        expect(cry.calls[0][1]).to.have.property('app', koa)
      })
    )

    it('catches and formats axios errors', () => {
      nock('http://127.0.0.1')
        .get('/dummy-url')
        .reply(403, { realm: 'protected area', error: 'error message' })

      return agent.get('/axios')
        .expect(403)
        .then((res) => {
          expect(res.body).to.deep.equal({
            statusCode: 403,
            message: 'Request failed with status code 403',
            data: { realm: 'protected area', error: 'error message' }
          })
          expect(cry.calls.length).to.equal(0)
        })
    })

    it('catches and formats boom errors', () =>
      agent.get('/boom')
        .expect(401)
        .expect('www-authenticate', /Basic/)
        .expect('www-authenticate', /realm="protected area"/)
        .expect('www-authenticate', /error="error message"/)
        .then(res => {
          expect(JSON.parse(res.body.toString('utf-8'))).to.deep.equal({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'error message',
            attributes: { realm: 'protected area', error: 'error message' }
          })
          expect(cry.calls.length).to.equal(0)
        })
    )

    it('catches and formats boom errors, exposed', () =>
      agent.get('/boom-expose')
        .expect(401)
        .expect('www-authenticate', /Basic/)
        .expect('www-authenticate', /realm="protected area"/)
        .expect('www-authenticate', /error="error message"/)
        .then(res => {
          expect(JSON.parse(res.body.toString('utf-8'))).to.deep.equal({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'error message',
            attributes: { realm: 'protected area', error: 'error message' }
          })
          expect(cry.calls.length).to.equal(0)
        })
    )

    it('catches and formats boom errors, hidden', () =>
      agent.get('/boom-hidden')
        .expect(401)
        .expect('www-authenticate', /Basic/)
        .expect('www-authenticate', /realm="protected area"/)
        .expect('www-authenticate', /error="error message"/)
        .then(res => {
          expect(res.body.toString('utf-8')).to.equal('')
          expect(cry.calls.length).to.equal(0)
        })
    )

    it('catches and formats http-errors', () =>
      agent.get('/http').expect(404).then(res => {
        expect(res.body).to.deep.equal({
          message: 'Not Found',
          name: 'NotFoundError'
        })
        expect(cry.calls.length).to.equal(0)
      })
    )

    it('catches and formats http-errors, exposed', () =>
      agent.get('/http-expose').expect(404).then(res => {
        expect(res.body).to.deep.equal({
          message: 'Not Found',
          name: 'NotFoundError'
        })
        expect(cry.calls.length).to.equal(0)
      })
    )

    it('catches and formats http-errors, hidden', () =>
      agent.get('/http-hidden').expect(404).then(res => {
        expect(res.body).to.equal('')
        expect(cry.calls.length).to.equal(0)
      })
    )

    it('catches and formats joi errors', () =>
      agent.get('/joi').expect(400).then(res => {
        expect(res.body).to.deep.equal({
          message: '"value" must be a string',
          name: 'ValidationError',
          details: [
            {
              message: '"value" must be a string',
              path: [],
              type: 'string.base',
              context: {
                label: 'value',
                value: 123
              }
            }
          ]
        })
        expect(cry.calls.length).to.equal(0)
      })
    )

    it('catches and formats joi errors, exposed', () =>
      agent.get('/joi-expose').expect(400).then(res => {
        expect(res.body).to.deep.equal({
          message: '"value" must be a string',
          name: 'ValidationError',
          details: [
            {
              message: '"value" must be a string',
              path: [],
              type: 'string.base',
              context: {
                label: 'value',
                value: 123
              }
            }
          ]
        })
        expect(cry.calls.length).to.equal(0)
      })
    )

    it('catches and formats joi errors, exposed', () =>
      agent.get('/joi-hidden').expect(400).then(res => {
        expect(res.body).to.equal('')
        expect(cry.calls.length).to.equal(0)
      })
    )

    it('emits error when cry = true', () =>
      agent.get('/cry').expect(400).then(res => {
        expect(JSON.parse(res.body.toString('utf-8'))).to.deep.equal({
          error: 'Bad Request',
          message: 'Bad Request',
          statusCode: 400
        })
        expect(cry.calls.length).to.equal(1)
        expect(cry.calls[0][0]).to.be.instanceOf(Error)
          .that.has.property('message', 'Bad Request')
        // duck type koa context
        expect(cry.calls[0][1]).to.have.property('app', koa)
      })
    )

    it('accepts rejected non-errors', () =>
      agent.get('/reject').expect(200).then(assertBody('rejected'))
    )
  })
})
