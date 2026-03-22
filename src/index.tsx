import { Theme } from "@radix-ui/themes";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

import "@radix-ui/themes/styles.css";
import styles from "./index.module.css";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <React.StrictMode>
    <Theme className={styles.fullSize}>
      <App />
    </Theme>
  </React.StrictMode>,
);
