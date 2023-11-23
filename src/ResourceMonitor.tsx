import * as React from "react";

const MEASUREMENT_INTERVAL = 2000;

export function ResourceMonitor(): JSX.Element {
  const [bytes, setBytes] = React.useState<number | null>(null);
  React.useEffect(() => {
    const interval = window.setInterval(() => {
      // @ts-expect-error performance.memory is Chrome-only.
      if (performance.memory) {
        // @ts-expect-error performance.memory is Chrome-only.
        setBytes(performance.memory.usedJSHeapSize);
      }
    }, MEASUREMENT_INTERVAL);
    return () => window.clearInterval(interval);
  });

  const mib = bytes == null ? "?" : (bytes / 1024 / 1024).toFixed(2);
  return <p>Memory used: {mib} MiB</p>;
}
