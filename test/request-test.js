import http from "node:http";
import https from "node:https";

import sinon from "sinon";
import { test } from "uvu";
import * as assert from "uvu/assert";

import httpInterceptor from "../index.js";

test.before.each(() => {
  httpInterceptor.start();
});
test.after.each(() => {
  httpInterceptor.removeAllListeners();
  sinon.restore();
});

function mustRequest(context, request) {
  test(`${context}: must return http.ClientRequest`, () => {
    assert.instance(request({ host: "foo" }), http.ClientRequest);
  });

  test(`${context}: must emit connect on httpInterceptor`, () => {
    const onConnect = sinon.spy();
    httpInterceptor.on("connect", onConnect);
    request({ host: "foo" });
    assert.equal(onConnect.callCount, 1);
  });

  test(`${context}: must emit connect on httpInterceptor after multiple connections`, () => {
    const onConnect = sinon.spy();
    httpInterceptor.on("connect", onConnect);
    request({ host: "foo" });
    request({ host: "foo" });
    request({ host: "foo" });
    assert.equal(onConnect.callCount, 3);
  });

  test(`${context}: must emit request on httpInterceptor`, () => {
    return new Promise((resolve) => {
      const client = request({ host: "foo" });
      client.end();

      httpInterceptor.on("request", (request, response) => {
        assert.instance(request, http.IncomingMessage);
        assert.not.equal(request, client);
        assert.instance(response, http.ServerResponse);
        resolve();
      });
    });
  });

  test(`${context}: must emit request when stopped`, () => {
    return new Promise((resolve) => {
      httpInterceptor.stop();
      const client = request({ host: "foo" });
      client.end();
      client.on("error", resolve);

      httpInterceptor.on("request", () => reject("should not emit 'request'"));
    });
  });

  test(`${context}: must emit request on httpInterceptor after multiple requests`, () => {
    return new Promise((resolve) => {
      let counter = 0;
      request({ host: "foo" }).end();
      request({ host: "foo" }).end();
      request({ host: "foo" }).end();
      httpInterceptor.on("request", () => {
        counter++;
        if (counter === 3) {
          resolve();
        }
      });
    });
  });

  test(`${context}: must emit socket on request in next ticks`, () => {
    return new Promise((resolve) => {
      const client = request({ host: "foo" });
      client.on("socket", resolve);
    });
  });

  // https://github.com/moll/node-httpInterceptor/pull/25
  test(`${context}: must emit connect after socket event`, () => {
    return new Promise((resolve) => {
      const client = request({ host: "foo" });

      client.on("socket", (socket) => socket.on("connect", resolve));
    });
  });

  test(`${context} when bypassed must not intercept`, () => {
    return new Promise((resolve) => {
      httpInterceptor.on("connect", (client, options, bypass) => bypass());
      request({ host: "127.0.0.1" }).on("error", (error) => {
        assert.instance(error, Error);
        assert.match(error.message, /ECONNREFUSED/);
        resolve();
      });
    });
  });

  test(`${context} when bypassed must not emit request`, () => {
    return new Promise((resolve) => {
      httpInterceptor.on("connect", (client, options, bypass) => bypass());
      const onRequest = sinon.spy();
      httpInterceptor.on("request", onRequest);
      request({ host: "127.0.0.1" }).on("error", () => {
        assert.equal(onRequest.callCount, 0);
        resolve();
      });
    });
  });
}

mustRequest("Http.request", http.request);
mustRequest("Https.request", https.request);

// https://github.com/moll/node-httpInterceptor/pull/25
test("Https.request must emit secureConnect after socket event", () => {
  return new Promise((resolve) => {
    const client = https.request({ host: "foo" });

    client.on("socket", (socket) => socket.on("secureConnect", resolve));
  });
});

mustRequest("Using Http.Agent", (options) => {
  return http.request({ agent: new http.Agent(), ...options });
});

test("Using Http.Agent must support keep-alive", () => {
  return new Promise((resolve, reject) => {
    const client = http.request({
      host: "foo",
      agent: new http.Agent({ keepAlive: true }),
    });

    client.on("error", reject);

    client.end();

    httpInterceptor.on("request", (_request, response) => {
      response.setHeader("Connection", "keep-alive");
      response.end();
    });

    // Just waiting for response is too early to trigger:
    // TypeError: socket._handle.getAsyncId is not a function in _http_client.
    client.on("response", (response) => {
      response.on("data", noop);
      response.on("end", resolve);
    });
  });
});

mustRequest("Using Https.Agent", (options) => {
  return https.request({ agent: new https.Agent(), ...options });
});

test("http.IncomingMessage must have URL", () => {
  return new Promise((resolve) => {
    http.request({ host: "foo", path: "/foo" }).end();

    httpInterceptor.on("request", (request) => {
      assert.equal(request.url, "/foo");
      resolve();
    });
  });
});

test("http.IncomingMessage must have headers", () => {
  return new Promise((resolve) => {
    const request = http.request({ host: "foo" });
    request.setHeader("Content-Type", "application/json");
    request.end();

    httpInterceptor.on("request", (request) => {
      assert.equal(request.headers["content-type"], "application/json");
      resolve();
    });
  });
});

test("http.IncomingMessage must have body", () => {
  return new Promise((resolve) => {
    const client = http.request({ host: "foo", method: "POST" });
    client.write("Hello");

    httpInterceptor.on("request", (request, _response) => {
      request.setEncoding("utf8");
      request.on("data", (data) => {
        assert.equal(data, "Hello");
        resolve();
      });
    });
  });
});

test("http.IncomingMessage must have a reference to the http.ServerResponse", () => {
  return new Promise((resolve) => {
    http.request({ host: "foo", method: "POST" }).end();
    httpInterceptor.on("request", (request, response) => {
      assert.equal(request.res, response);
    });
    httpInterceptor.on("request", resolve);
  });
});

test("http.ServerResponse must respond with status, headers and body", () => {
  return new Promise((resolve) => {
    httpInterceptor.on("request", (_request, response) => {
      response.statusCode = 442;
      response.setHeader("Content-Type", "application/json");
      response.end("Hi!");
    });

    http
      .request({ host: "foo" })
      .on("response", (response) => {
        assert.equal(response.statusCode, 442);
        assert.equal(response.headers["content-type"], "application/json");
        response.setEncoding("utf8");
        response.once("data", (data) => {
          assert.equal(data, "Hi!");
          resolve();
        });
      })
      .end();
  });
});

test("http.ServerResponse must have a reference to the http.IncomingMessage", () => {
  return new Promise((resolve) => {
    http.request({ host: "foo", method: "POST" }).end();
    httpInterceptor.on("request", (request, response) => {
      assert.equal(response.req, request);
    });
    httpInterceptor.on("request", resolve);
  });
});

test("http.ServerResponse.prototype.write must make clientRequest emit response", () => {
  return new Promise((resolve) => {
    const request = http.request({ host: "foo" });
    request.end();
    httpInterceptor.on("request", (_request, response) => {
      response.write("Test");
    });
    request.on("response", resolve);
  });
});

// Under Node v0.10 it's the writeQueueSize that's checked to see if
// the callback can be called.
test("http.ServerResponse.prototype.write must call given callback", () => {
  return new Promise((resolve) => {
    http.request({ host: "foo" }).end();
    httpInterceptor.on("request", (_request, response) => {
      response.write("Test", resolve);
    });
  });
});

test("http.ServerResponse.prototype.end must make http.ClientRequest emit response", () => {
  return new Promise((resolve) => {
    const client = http.request({ host: "foo" });
    client.end();
    httpInterceptor.on("request", (_request, response) => {
      response.end();
    });
    client.on("response", resolve);
  });
});

// In an app of mine Node v0.11.7 did not emit the end event, but
// v0.11.11 did. I'll investigate properly if this becomes a problem in
// later Node versions.
test("http.ServerResponse.prototype.end must make http.IncomingMessage emit end", () => {
  return new Promise((resolve) => {
    const client = http.request({ host: "foo" });
    client.end();
    httpInterceptor.on("request", (_request, response) => {
      response.end();
    });

    client.on("response", (response) => {
      response.on("data", noop);
      response.on("end", resolve);
    });
  });
});

test.run();

function noop() {}
