import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import { BrowserRouter } from "react-router-dom";

const bootAOS = async () => {
  const [{ default: AOS }] = await Promise.all([
    import("aos"),
    import("aos/dist/aos.css"),
  ]);

  AOS.init({ once: true, duration: 700 });
};

if (typeof window !== "undefined") {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(bootAOS, { timeout: 1200 });
  } else {
    window.setTimeout(bootAOS, 300);
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);