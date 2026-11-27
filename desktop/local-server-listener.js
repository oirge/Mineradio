'use strict';

function bindLoopback(server, port) {
  return new Promise((resolve, reject) => {
    function onError(error) {
      server.off('listening', onListening);
      reject(error);
    }
    function onListening() {
      server.off('error', onError);
      resolve(server.address().port);
    }
    server.once('error', onError);
    server.once('listening', onListening);
    try {
      server.listen(port, '127.0.0.1');
    } catch (error) {
      server.off('error', onError);
      server.off('listening', onListening);
      reject(error);
    }
  });
}

async function listenOnLoopback(server, preferredPort) {
  if (!Number.isInteger(preferredPort) || preferredPort < 0 || preferredPort > 65535) {
    throw new RangeError('INVALID_LOCAL_SERVER_PORT');
  }
  if (server.listening) return server.address().port;
  for (let port = preferredPort; ; port++) {
    try {
      return await bindLoopback(server, port);
    } catch (error) {
      if (port === 65535 || (error.code !== 'EADDRINUSE' && error.code !== 'EACCES')) throw error;
    }
  }
}

module.exports = { listenOnLoopback };
