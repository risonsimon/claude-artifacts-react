export default function ArtifactIndex({ artifacts, href, missing }) {
  return (
    <div className="min-h-screen bg-gray-50 p-6 text-left text-gray-900">
      <div className="mx-auto max-w-2xl">
        {missing !== undefined && (
          <div role="alert" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            There is no artifact at <code>/{missing}</code>.
          </div>
        )}
        <h1 className="mb-4 text-2xl font-semibold">Artifacts</h1>
        {artifacts.length === 0 ? (
          <p className="text-gray-600">
            No artifacts yet. Paste Claude&apos;s code into <code>src/ArtifactCode.jsx</code>, or add files to{" "}
            <code>src/artifacts/</code>.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {artifacts.map((artifact) => (
              <li key={artifact.file}>
                <a className="flex items-center justify-between p-4 hover:bg-gray-50" href={href(artifact.name)}>
                  <span className="font-medium">/{artifact.name}</span>
                  <span className="text-sm text-gray-500">{artifact.file}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
