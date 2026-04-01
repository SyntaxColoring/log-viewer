import React from "react";

import { HomePage } from "./components/HomePage";
import { ImportErrorOverlay } from "./components/ImportErrorOverlay";
import { ImportProgressOverlay } from "./components/ImportProgressOverlay";
import { LogViewPage } from "./components/LogViewPage";
import { type LogSearcher, buildLogSearcher } from "./logAccess";

type PendingImportState =
  | { status: "importing"; fileName: string; progress: number }
  | { status: "error"; fileName: string; message: string };

export default function App() {
  const [currentSuccessfulImport, setCurrentSuccessfulImport] = React.useState<{
    importId: number;
    fileName: string;
    searcher: LogSearcher;
  } | null>(null);
  const [pendingImport, setPendingImport] =
    React.useState<PendingImportState | null>(null);
  const latestImportId = React.useRef(0);

  const startImport = React.useCallback((nextFile: File | null) => {
    if (!nextFile) return;

    const importId = ++latestImportId.current;
    setPendingImport({
      status: "importing",
      fileName: nextFile.name,
      progress: 0,
    });

    const handleProgress = debounceProgress((progress: number) => {
      if (latestImportId.current === importId) {
        setPendingImport((current) =>
          current?.status === "importing" ? { ...current, progress } : current,
        );
      }
    });

    buildLogSearcher(nextFile, handleProgress).then(
      (searcher) => {
        if (latestImportId.current !== importId) return;
        setCurrentSuccessfulImport({
          importId,
          fileName: nextFile.name,
          searcher,
        });
        setPendingImport(null);
      },
      (exception) => {
        if (latestImportId.current !== importId) return;
        setPendingImport({
          status: "error",
          fileName: nextFile.name,
          message:
            exception instanceof Error
              ? exception.message
              : "Unknown error while importing file.",
        });
      },
    );
  }, []);

  const returnToHome = React.useCallback(() => {
    latestImportId.current += 1;
    setCurrentSuccessfulImport(null);
    setPendingImport(null);
  }, []);

  const pageContent =
    currentSuccessfulImport === null ? (
      <HomePage onFileSelect={startImport} />
    ) : (
      <LogViewPage
        key={currentSuccessfulImport.importId}
        searcher={currentSuccessfulImport.searcher}
        onReturnHome={returnToHome}
        onFileSelect={startImport}
      />
    );

  return (
    <>
      {pageContent}
      {pendingImport?.status === "importing" && (
        <ImportProgressOverlay
          fileName={pendingImport.fileName}
          progress={pendingImport.progress}
        />
      )}
      {pendingImport?.status === "error" && (
        <ImportErrorOverlay
          fileName={pendingImport.fileName}
          message={pendingImport.message}
          onDismiss={() => setPendingImport(null)}
        />
      )}
    </>
  );
}

function debounceProgress(
  onProgress: (progress: number) => void,
): (progress: number) => void {
  let lastCheckpoint = 0;
  return (progress: number) => {
    if (progress - lastCheckpoint > 0.01) {
      onProgress(progress);
      lastCheckpoint = progress;
    }
  };
}
