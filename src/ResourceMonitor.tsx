import * as React from "react";

const MEASUREMENT_INTERVAL = 2000;

// Inform TypeScript of the not-universally-supported performance.memory API.
// https://www.typescriptlang.org/docs/handbook/namespaces.html#working-with-other-javascript-libraries.
// Unclear why the linter is complaining about this.
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace performance {
  const memory: {
    usedJSHeapSize: number;
  };
}

export function ResourceMonitor(): JSX.Element {
  const [bytes, setBytes] = React.useState<number | null>(null);
  React.useEffect(() => {
    const interval = window.setInterval(() => {
      if (performance.memory) {
        setBytes(performance.memory.usedJSHeapSize);
      }
    }, MEASUREMENT_INTERVAL);
    return () => window.clearInterval(interval);
  });

  const mib = bytes == null ? "?" : (bytes / 1024 / 1024).toFixed(2);
  return <p>Memory used: {mib} MiB</p>;
}
