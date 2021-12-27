// @ts-check

import http from "node:http";
import { EventEmitter } from "node:events";

import netInterceptor, { kRemote } from "@gr2m/net-interceptor";

import NODE_INTERNALS from "./node-internals.js";
import HttpInterceptorServer from "./server.js";

let isIntercepting = false;
let didPatchConnect = false;

export default class NetInterceptor extends EventEmitter {
  constructor() {
    super();

    netInterceptor.addListener("connect", this.emit.bind(this, "connect"));
    this.server = new HttpInterceptorServer(this);
  }

  /**y
   * @returns {NetInterceptor}
   */
  start() {
    netInterceptor.start();

    if (isIntercepting) return;
    isIntercepting = true;

    if (didPatchConnect) return;
    didPatchConnect = true;

    // ClientRequest.prototype.onSocket is called synchronously from ClientRequest's constructor
    // and is a convenient place to hook into new ClientRequest instances.
    // hook into `http.Server.prototype.onSocket` in order to intercept the
    // `http.ClientRequest` instance of every http(s) request
    const origOnSocket = http.ClientRequest.prototype.onSocket;
    const interceptor = this;
    http.ClientRequest.prototype.onSocket = function httpRecorderOnSocket(
      socket
    ) {
      // run the original `http.Server.prototype.onSocket` method
      origOnSocket.call(this, socket);

      if (!isIntercepting) return;

      // only set if intercepted by `@gr2m/net-interceptor`
      // @ts-expect-error - kRemote cannot index socket
      const responseSocket = socket[kRemote];
      if (!responseSocket) return;

      NODE_INTERNALS.httpConnectionListener.call(
        interceptor.server,
        responseSocket
      );
    };

    return this;
  }

  /**
   * @returns {NetInterceptor}
   */
  stop() {
    netInterceptor.stop();

    isIntercepting = false;
    return this;
  }
}
