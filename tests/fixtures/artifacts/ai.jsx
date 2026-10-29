import React, { useState } from "react";

export default function AiFixture() {
  const [reply, setReply] = useState("");
  const [completion, setCompletion] = useState("");

  async function ask() {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: "hello from fetch" }],
      }),
    });
    const data = await response.json();
    setReply(data.content.filter((block) => block.type === "text").map((block) => block.text).join(""));
    setCompletion(await window.claude.complete("hello from complete"));
  }

  return (
    <div className="p-4">
      <button onClick={ask}>Ask</button>
      <p data-testid="reply">{reply}</p>
      <p data-testid="completion">{completion}</p>
    </div>
  );
}
