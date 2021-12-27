# `@gr2m/http-interceptor`

[![Test](https://github.com/gr2m/node-http-interceptor/actions/workflows/test.yml/badge.svg)](https://github.com/gr2m/node-http-interceptor/actions/workflows/test.yml)

> Intercept and mock outgoing http/https requests

## Install

```
npm install @gr2m/http-interceptor
```

## Usage

```js
import httpInterceptor from "@gr2m/http-interceptor";

httpInterceptor.start();
httpInterceptor.on("connect", (socket, options, bypass) => {
  // call bypass() to continue the unintercepted request
  if (options.host === "db.example.com") return bypass();
});

httpInterceptor.on("request", (request, response) => {
  response.end("Hello World!");
});
```

## API

`httpInterceptor` is a singleton API.

### `httpInterceptor.start()`

Hooks into the request life cycle and emits `connect` events for each request that connects to a server as well as `request` events for all intercepted requests.

### `httpInterceptor.stop()`

Stops intercepting. No `connect` or `request` events will be emitted.

### `httpInterceptor.addListener(event, listener)`

#### `connect` event

The `listener` callback is called with 3 arguments

- `socket`: the intercepted net or TLS socket
- `options`: socket options: `{port, /* host, localAddress, localPort, family, allowHalfOpen */}`
- `bypass`: a function to call to continue the unintercepted connection

#### `request` event

The `listener` callback is called with 2 arguments

- `request`: `Http.IncomingMessage`
- `response`: `Http.ServerResponse`

It's the same arguments as e.g. `http.createServer(listener)` receives.

### `httpInterceptor.removeListener(event, listener)`

Remove an event listener.

### `httpInterceptor.removeAllListeners(event)`

Removes all event listeners for the given event. Or when called without the `event` argument, remove all listeners for all events.

## How it works

`@gr2m/http-interceptor` is using [`@gr2m/net-interceptor`](https://github.com/gr2m/node-net-interceptor/#readme) to intercept TCP/TLS connections, and to permit to bypass the interception.

`@gr2m/http-interceptor` also hooks into `http.ClientRequest.prototype.onSocket` which is called in the `http.ClientRequest` constructor. Each time `http.ClientRequest` is instantiated with a socket, we check if the socket is intercepted and if so, emit the `request` event with a `request`/`response` pair for mocking.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Credits

`@gr2m/http-interceptor` is built upon code and concepts from [moll/node-mitm](https://github.com/moll/node-mitm) by [Andri Möll](http://themoll.com). [Monday Calendar](https://mondayapp.com) supported that engineering work.

**[Gregor Martynus](https://github.com/gr2m)** removed all `http(s)`-related code and made its focus on intercepting connections that use the lower-level `net` and `tls` modules.

## License

[LGPL](LICENSE.md)
