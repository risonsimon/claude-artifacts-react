import React, { useEffect, useRef, useState } from "react";
import _ from "lodash";
import * as d3 from "d3";
import * as math from "mathjs";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import * as THREE from "three";
import * as Plotly from "plotly";
import * as Chart from "chart.js";
import * as Tone from "tone";
import * as mammoth from "mammoth";
import * as tf from "@tensorflow/tfjs";
import { Camera, Heart } from "lucide-react";

export default function Libraries() {
  const plotRef = useRef(null);
  const chartRef = useRef(null);
  const [results, setResults] = useState({});

  useEffect(() => {
    const out = {};
    out.lodash = _.sum([1, 2, 3]);
    out.d3 = d3.scaleLinear().domain([0, 10]).range([0, 100])(5);
    out.mathjs = math.evaluate("sqrt(16) + 2");
    out.papaparse = Papa.parse("a,b\n1,2", { header: true }).data[0].b;
    const sheet = XLSX.utils.aoa_to_sheet([["x"], [42]]);
    out.xlsx = XLSX.utils.sheet_to_json(sheet)[0].x;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    out.three = `${THREE.REVISION}:${mesh.geometry.type}`;
    Plotly.newPlot(plotRef.current, [{ x: [1, 2], y: [3, 4], type: "scatter" }]).then(() => {
      setResults((prev) => ({ ...prev, plotly: plotRef.current.querySelectorAll(".main-svg").length > 0 }));
    });
    Chart.Chart.register(...Chart.registerables);
    const chart = new Chart.Chart(chartRef.current, {
      type: "bar",
      data: { labels: ["a"], datasets: [{ data: [1] }] },
      options: { animation: false },
    });
    out.chartjs = chart.data.labels.length;
    out.tone = typeof Tone.Synth === "function";
    out.mammoth = typeof mammoth.convertToHtml === "function";
    out.tensorflow = tf.tensor([1, 2, 3]).sum().dataSync()[0];
    setResults((prev) => ({ ...prev, ...out }));
    return () => chart.destroy();
  }, []);

  return (
    <div className="p-4">
      <Camera aria-label="camera icon" />
      <Heart aria-label="heart icon" />
      <pre data-testid="results">{JSON.stringify(results)}</pre>
      <div ref={plotRef} style={{ width: 300, height: 200 }} />
      <canvas ref={chartRef} width="300" height="150" />
    </div>
  );
}
