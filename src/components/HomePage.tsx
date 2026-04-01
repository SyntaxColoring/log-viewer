import { FileText, SquareDashedMousePointer } from "lucide-react";
import { type JSX } from "react";

import { A } from "./A";
import FileImportButton from "./FileImportButton";

const AUTHOR_LINK_HREF = "https://marrone.nyc";
const SOURCE_CODE_LINK_HREF = "https://github.com/SyntaxColoring/log-viewer";

export function HomePage({
  onFileSelect,
}: {
  onFileSelect: (file: File | null) => void;
}): JSX.Element {
  return (
    <div className="flex h-full flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl text-center">
          <BigFileIcon />

          <p className="mx-auto mt-3 max-w-md text-balance text-muted-foreground">
            This is an in-browser tool for inspecting logs from systemd
            machines.
          </p>

          <div className="mx-auto mt-6 w-full max-w-sm rounded-lg border bg-card px-6 pt-5 pb-4">
            <FileImportButton
              className="mx-auto"
              label="Import your logs"
              onFileSelect={onFileSelect}
            />
            <p className="mt-3 text-sm text-muted-foreground">
              or{" "}
              <SquareDashedMousePointer className="inline size-4 align-text-bottom" />{" "}
              drop a file anywhere on the page
            </p>
          </div>
        </div>
      </main>

      <footer className="px-4 pb-3 text-center text-muted-foreground">
        <small className="text-sm">
          By <A href={AUTHOR_LINK_HREF}>Max Marrone</A>. Source code on{" "}
          <A href={SOURCE_CODE_LINK_HREF}>GitHub</A>.
        </small>
      </footer>
    </div>
  );
}

function BigFileIcon(): JSX.Element {
  return (
    <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
      <FileText className="size-8" />
    </div>
  );
}
