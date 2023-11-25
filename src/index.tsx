import { Theme } from "@radix-ui/themes";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

import "@radix-ui/themes/styles.css";
import "./index.css";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <React.StrictMode>
    <Theme className="full-height">
      <App />
    </Theme>
  </React.StrictMode>,
);
