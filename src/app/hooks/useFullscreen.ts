"use client";

import { useRef, useState, useEffect, useCallback } from "react";

export function useFullscreen<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      ref.current?.requestFullscreen().catch(() => {});
    }
  }, []);

  return { ref, isFullscreen, toggle };
}
