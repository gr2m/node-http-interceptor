import { _connectionListener as httpConnectionListener } from "node:http";
import { IncomingMessage } from "node:_http_incoming";
import { ServerResponse } from "node:_http_server";
import { kIncomingMessage as incomingMessageKey } from "node:_http_common";
import { kServerResponse as serverResponseKey } from "node:_http_server";

export default {
  httpConnectionListener,
  serverResponseKey,
  ServerResponse,
  incomingMessageKey,
  IncomingMessage,
};
