import { Suspense } from "react";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

export default function ArtifactView({ artifact }) {
  const { Component } = artifact;

  return (
    <ErrorBoundary file={artifact.file}>
      <Suspense fallback={null}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
}
