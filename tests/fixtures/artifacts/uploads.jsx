import React, { useEffect, useState } from "react";
import Papa from "papaparse";

export default function FilesFixture() {
  const [rows, setRows] = useState("loading");
  const [missing, setMissing] = useState("");

  useEffect(() => {
    window.fs
      .readFile("sample.csv", { encoding: "utf8" })
      .then((text) => setRows(String(Papa.parse(text.trim(), { header: true }).data.length)))
      .catch((error) => setRows(`error: ${error.message}`));
    window.fs.readFile("nope.csv").catch((error) => setMissing(error.message));
  }, []);

  return (
    <div>
      <p data-testid="rows">{rows}</p>
      <p data-testid="missing">{missing}</p>
    </div>
  );
}
