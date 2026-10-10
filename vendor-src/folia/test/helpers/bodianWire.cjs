const { EventEmitter } = require('node:events');

// test/helpers/bodianWire.cjs — offline requestFactory; exercises the real HTTP encoder/decoder.

function createWire(respond) {
  const calls = [];
  const requests = [];
  const factory = (options, onResponse) => {
    const request = new EventEmitter();
    const headers = {};
    request.setHeader = (name, value) => { headers[name] = value; };
    request.abort = request.destroy = () => { request.stopped = true; };
    request.end = body => {
      const call = { url: new URL(options.url), method: options.method, headers, body };
      calls.push(call);
      Promise.resolve().then(() => respond(call)).then(data => {
        if (request.stopped) return;
        const response = new EventEmitter();
        response.statusCode = data?.httpStatus ?? 200;
        response.headers = data?.responseHeaders ?? {};
        onResponse(response);
        response.emit('data', data?.bytes ?? Buffer.from(JSON.stringify(data)));
        response.emit('end');
      }).catch(error => request.emit('error', error));
    };
    requests.push(request);
    return request;
  };
  return { factory, calls, requests };
}

module.exports = { createWire };
