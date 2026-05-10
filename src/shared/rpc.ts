import type { JSONValue } from '@devvit/public-api';

export interface RpcRequest {
  type: string;
  requestId: string;
  payload: JSONValue;
  [key: string]: JSONValue;
}

export interface RpcReply {
  type: string;
  requestId: string;
  payload: JSONValue;
  [key: string]: JSONValue;
}

export interface RpcErrorPayload {
  error: string;
}
