import { useEffect, useState } from "react";

interface UseWindowFileDropOptions {
  onDrop: (file: File) => void;
  enableDrops: boolean;
}

interface UseWindowFileDropResult {
  /** Whether the user is currently dragging a droppable file. */
  isDragActive: boolean;
}

/** Listens for file drag-and-drop events on the entire window. */
export function useWindowFileDrop(
  options: UseWindowFileDropOptions,
): UseWindowFileDropResult {
  const { onDrop, enableDrops } = options;

  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  const isDragActive = isDraggingFile && enableDrops;

  useEffect(() => {
    const handleDragOver = (event: DragEvent) => {
      const fileItem = getFileItem(event);
      if (fileItem !== null) {
        event.preventDefault(); // Signal that there's a valid drop here.
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = enableDrops ? "copy" : "none";
        }
        setIsDraggingFile(true);
      }
    };

    const handleDragLeave = (event: DragEvent) => {
      // dragleave fires not only when leaving the window,
      // but also when the hover moves from child to child,
      // so we gotta filter those out.
      const draggingTo = event.relatedTarget;
      const isLeavingWindow = draggingTo === null;
      if (isLeavingWindow) {
        setIsDraggingFile(false);
      }
    };

    const handleDrop = (event: DragEvent) => {
      setIsDraggingFile(false);
      const file = getFileItem(event)?.getAsFile() ?? null;
      if (file !== null) {
        event.preventDefault();
        if (enableDrops) {
          onDrop(file);
        }
      }
    };

    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [enableDrops, onDrop]);

  return { isDragActive };
}

function getFileItem(event: DragEvent): DataTransferItem | null {
  if (event.dataTransfer === null) return null;
  return (
    [...event.dataTransfer.items].find((item) => item.kind === "file") ?? null
  );
}
