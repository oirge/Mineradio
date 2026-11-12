'use strict';

/** Only the trusted desktop frame receives this per-run token through IPC. */
function authorizeApiMutation(req, token, port) {
  if (req.method !== 'POST') return { status: 405, error: 'METHOD_NOT_ALLOWED' };
  const headers = req.headers || {};
  const explicitHost = '127.0.0.1:' + port;
  const expectedHost = Number(port) === 80 ? '127.0.0.1' : explicitHost;
  const matchingOrigin = !headers.origin || headers.origin === 'http://' + expectedHost
    || (Number(port) === 80 && headers.origin === 'http://' + explicitHost);
  if ((headers.host !== expectedHost && headers.host !== explicitHost) || !matchingOrigin
      || headers['sec-fetch-site'] === 'cross-site') {
    return { status: 403, error: 'API_ORIGIN_FORBIDDEN' };
  }
  if (!token || typeof headers['x-mineradio-session'] !== 'string' || headers['x-mineradio-session'] !== token) {
    return { status: 403, error: 'API_SESSION_REQUIRED' };
  }
  return null;
}

module.exports = { authorizeApiMutation };
