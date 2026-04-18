export default async function guessFileType(
  file: File,
): Promise<"export" | "json"> {
  if (file.size == 0) {
    // Doesn't matter--both downstream parsers should be able to handle empty files.
    return "export";
  } else {
    const firstByte = new Uint8Array(await file.slice(0, 1).arrayBuffer()).at(
      0,
    );
    return firstByte === "{".charCodeAt(0) ? "json" : "export";
  }
}
