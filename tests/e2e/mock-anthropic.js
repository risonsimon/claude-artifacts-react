// Stand-in for api.anthropic.com used by the end-to-end tests.
import http from "node:http";

const port = Number(process.env.MOCK_ANTHROPIC_PORT || 4319);

http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);

    if (req.method === "GET" && req.url === "/health") {
      res.end("ok");
      return;
    }
    if (req.method !== "POST" || req.url !== "/v1/messages") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "mock: not found" } }));
      return;
    }
    if (req.headers["x-api-key"] !== "test-key") {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "mock: bad key" } }));
      return;
    }

    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const last = body.messages.at(-1).content;
    res.writeHead(200, { "content-type": "application/json", "request-id": "req_mock" });
    res.end(
      JSON.stringify({
        id: "msg_mock",
        type: "message",
        role: "assistant",
        model: body.model,
        content: [{ type: "text", text: `echo: ${last} (${body.model})` }],
      }),
    );
  })
  .listen(port, "127.0.0.1");
