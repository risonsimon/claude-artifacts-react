import React, { useState } from "react";
import { Button } from "@/components/ui/button";

const App = () => {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(count + 1);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-6">Claude Artifacts React</h1>
        <Button
          onClick={handleClick}
          className="mb-4"
        >
          Say Hi
        </Button>
        <p className="text-lg">Said Hi {count} times</p>
      </div>
    </div>
  );
};

export default App;
