import React, { useState } from "react";
import { Button } from "@/components/ui/button";

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Simple fixture</h1>
      <Button onClick={() => setCount(count + 1)}>Clicked {count} times</Button>
    </div>
  );
}
