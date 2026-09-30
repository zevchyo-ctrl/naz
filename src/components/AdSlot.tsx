"use client";

import React, { useEffect, useRef } from "react";
import type { AdConfig, AdSlot as AdSlotData } from "@/db/schema";

/**
 * Executes a raw third-party ad tag inside a container.
 *
 * `dangerouslySetInnerHTML` does NOT run <script> elements, so each script node is
 * re-created and appended, which is what actually makes ad tags fire. Everything is
 * wrapped in try/catch and the container is isolated, so a broken or slow third-party
 * tag can never take the page down with it.
 */
function runAdCode(container: HTMLElement, code: string) {
  const cleanups: (() => void)[] = [];
  try {
    const template = document.createElement("template");
    template.innerHTML = code;

    const inject = (node: Node) => {
      if (node.nodeName === "SCRIPT") {
        const original = node as HTMLScriptElement;
        const script = document.createElement("script");
        for (const attr of Array.from(original.attributes)) {
          try {
            script.setAttribute(attr.name, attr.value);
          } catch {
            /* skip malformed attribute */
          }
        }
        script.text = original.textContent || "";
        // Failures inside third-party scripts stay contained
        script.onerror = () => console.warn("[ads] third-party script failed to load");
        container.appendChild(script);
        cleanups.push(() => script.remove());
      } else {
        const clone = node.cloneNode(true);
        container.appendChild(clone);
        cleanups.push(() => {
          if (clone.parentNode === container) container.removeChild(clone);
        });
      }
    };

    Array.from(template.content.childNodes).forEach((n) => {
      try {
        inject(n);
      } catch (err) {
        console.warn("[ads] failed to inject a node:", err);
      }
    });
  } catch (err) {
    console.warn("[ads] invalid ad code, skipped:", err);
  }
  return () => {
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
    container.innerHTML = "";
  };
}

/** Renders one banner slot. Renders nothing at all when disabled or empty. */
export function BannerAd({
  slot,
  enabled,
  className = "",
  testId,
}: {
  slot?: AdSlotData;
  enabled: boolean;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const active = enabled && Boolean(slot?.enabled) && Boolean(slot?.code?.trim());
  const code = active ? slot!.code : "";

  useEffect(() => {
    if (!ref.current || !code) return;
    return runAdCode(ref.current, code);
  }, [code]);

  if (!active) return null;
  return (
    <div
      className={`naz-ad-slot w-full overflow-hidden flex justify-center ${className}`}
      data-testid={testId}
      ref={ref}
    />
  );
}

/**
 * Head/tracking scripts + pop-under.
 * Head scripts load once on mount; the pop-under tag is only injected after the
 * visitor's first real interaction, which is what these networks require.
 */
export function GlobalAds({
  adConfig,
  enabled,
}: {
  adConfig?: AdConfig;
  enabled: boolean;
}) {
  const headRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const popFired = useRef(false);

  const head = adConfig?.headerScripts;
  const popup = adConfig?.popup;
  const headCode = enabled && head?.enabled && head.code.trim() ? head.code : "";
  const popCode = enabled && popup?.enabled && popup.code.trim() ? popup.code : "";

  // Tracking / header scripts
  useEffect(() => {
    if (!headRef.current || !headCode) return;
    return runAdCode(headRef.current, headCode);
  }, [headCode]);

  // Pop-up / popunder — armed until the first interaction, then fired once
  useEffect(() => {
    popFired.current = false;
    if (!popCode) return;

    let cleanup: (() => void) | undefined;
    const fire = () => {
      if (popFired.current || !popRef.current) return;
      popFired.current = true;
      cleanup = runAdCode(popRef.current, popCode);
      detach();
    };
    const detach = () => {
      document.removeEventListener("click", fire);
      document.removeEventListener("touchstart", fire);
      document.removeEventListener("keydown", fire);
    };
    document.addEventListener("click", fire, { once: false });
    document.addEventListener("touchstart", fire, { once: false, passive: true });
    document.addEventListener("keydown", fire);

    return () => {
      detach();
      cleanup?.();
    };
  }, [popCode]);

  return (
    <>
      <div ref={headRef} data-testid="ad-head-scripts" style={{ display: "none" }} />
      <div ref={popRef} data-testid="ad-popup-host" style={{ display: "none" }} />
    </>
  );
}
