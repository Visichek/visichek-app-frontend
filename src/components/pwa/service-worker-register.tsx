"use client";

import { useEffect, useRef } from "react";

const SW_URL = "/sw.js";
const SW_SCOPE = "/";

export function ServiceWorkerRegister() {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    registeredRef.current = true;

    const onLoad = () => {
      navigator.serviceWorker
        .register(SW_URL, { scope: SW_SCOPE })
        .then((registration) => {
          // Force any waiting SW to activate immediately so a fresh deploy
          // takes effect without user action.
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (installing.state === "installed" && registration.waiting) {
                registration.waiting.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch(() => {
          // Non-fatal — app works without the SW, just no offline/runtime caching.
        });

      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
    }
  }, []);

  return null;
}
