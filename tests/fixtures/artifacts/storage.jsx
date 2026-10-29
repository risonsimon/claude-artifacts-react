import React, { useEffect, useState } from "react";

export default function StorageFixture() {
  const [state, setState] = useState("loading");

  useEffect(() => {
    (async () => {
      let visits = 0;
      try {
        const result = await window.storage.get("visits");
        visits = result.value;
      } catch {
        visits = 0;
      }
      await window.storage.set("visits", visits + 1);
      await window.storage.set("board", JSON.stringify({ score: 7 }), true);
      const listed = await window.storage.list("vis");
      let missing = "no error";
      try {
        await window.storage.get("does-not-exist");
      } catch {
        missing = "threw";
      }
      setState(JSON.stringify({ visits: visits + 1, keys: listed.keys, missing }));
    })();
  }, []);

  return <pre data-testid="storage">{state}</pre>;
}
