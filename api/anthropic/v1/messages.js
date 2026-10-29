// Vercel Function: /api/anthropic/v1/messages
import { handleAnthropicProxy } from "../../../server/anthropic-proxy.js";

// Vercel sets x-real-ip to the visitor's address and overwrites any value the client sends.
const handle = (request) =>
  handleAnthropicProxy(request, process.env, { clientIp: request.headers.get("x-real-ip") });

export { handle as GET, handle as OPTIONS, handle as POST };
