// Express 4 doesn't forward rejected promises from async handlers to the error
// middleware on its own. Wrapping every async route in this ensures a thrown/rejected
// error always reaches the centralized error handler instead of hanging the request.
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
