const {
  assoc, cond, evolve, flip, merge, pick, pipe, prop, T
} = require('ramda')

const { json } = require('./json')

const boomError = ({ output: { payload, statusCode, headers } }) =>
  merge(json(payload), { statusCode, headers })

exports.error = err =>
  pipe(
    cond([
      [prop('isBoom'), boomError],
      [prop('isJoi'), joiError],
      [prop('isAxiosError'), axiosError],
      [T, systemError]
    ]),
    evolve({ headers: flip(merge)(err.headers) })
  )(err)

const axiosError = ({ message, response: { status: statusCode, headers, data } }) => json({ message, statusCode, data }, statusCode)

const joiError = pipe(
  pick(['details', 'message', 'name']),
  json,
  assoc('statusCode', 400)
)

const systemError = ({ message, name, statusCode = 500 }) =>
  merge(json({ message, name }), { statusCode })
