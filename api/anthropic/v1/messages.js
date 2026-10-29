// Vercel Function: POST /api/anthropic/v1/messages
import { handleAnthropicProxy } from "../../../server/anthropic-proxy.js";

export function POST(request) {
  return handleAnthropicProxy(request, process.env);
}

export function GET(request) {
  return handleAnthropicProxy(request, process.env);
}
