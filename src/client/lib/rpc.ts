/**
 * postMessage RPC client. Devvit wraps server->webview messages in
 *   { type: 'devvit-message', data: { message: <inner> } }
 * Webview->server is direct: window.parent.postMessage(<inner>, '*').
 */

interface RpcMessage<T = unknown> {
  type: string;
  requestId: string;
  payload?: T;
}

interface DevvitWrappedMessage {
  type: 'devvit-message';
  data: { message: RpcMessage };
}

type Resolver = (msg: RpcMessage) => void;
const pending = new Map<string, Resolver>();

function isWrapped(value: unknown): value is DevvitWrappedMessage {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { type?: unknown }).type === 'devvit-message' &&
    !!(value as { data?: { message?: unknown } }).data &&
    typeof (value as { data: { message?: unknown } }).data.message === 'object'
  );
}

function isRpcReply(value: unknown): value is RpcMessage {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as RpcMessage).type === 'string' &&
    typeof (value as RpcMessage).requestId === 'string'
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e: MessageEvent) => {
    const inner: unknown = isWrapped(e.data) ? e.data.data.message : e.data;
    if (!isRpcReply(inner)) return;
    if (inner.type.endsWith(':reply')) {
      const resolver = pending.get(inner.requestId);
      if (resolver) {
        resolver(inner);
        pending.delete(inner.requestId);
      }
    }
  });
}

export function rpc<Req, Res>(type: string, payload?: Req): Promise<Res> {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise<Res>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`rpc ${type} timed out`));
    }, 15_000);
    pending.set(requestId, (msg) => {
      clearTimeout(timeout);
      const replyPayload = msg.payload as ({ error?: string } & Res) | undefined;
      if (
        replyPayload &&
        typeof replyPayload === 'object' &&
        'error' in replyPayload &&
        replyPayload.error
      ) {
        reject(new Error(String(replyPayload.error)));
      } else {
        resolve(replyPayload as Res);
      }
    });
    const wirePayload = (payload === undefined ? null : payload) as unknown;
    window.parent.postMessage({ type, requestId, payload: wirePayload }, '*');
  });
}
