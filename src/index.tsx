import React from "react";
import ReactDOM from "react-dom/client";

import { TooltipProvider } from "@/shadcn/components/ui/tooltip";
import App from "./App";

import "./index.css";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <React.StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </React.StrictMode>,
);
