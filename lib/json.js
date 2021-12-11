exports.json = (body, statusCode) => ({
  body: JSON.stringify(body),
  headers: {
    'content-type': 'application/json'
  },
  statusCode
})
