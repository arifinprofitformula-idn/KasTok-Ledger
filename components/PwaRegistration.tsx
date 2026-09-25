"use client";

import { useEffect } from "react";

export default function PwaRegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Check for worker updates
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener("statechange", () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  // New update available, activate promptly
                  installing.postMessage({ type: "SKIP_WAITING" });
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn("ServiceWorker registration failed:", err);
        });
    }
  }, []);

  return null;
}
