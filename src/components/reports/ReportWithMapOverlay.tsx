"use client";

/**
 * Wrapper component that overlays the ArcGIS map on top of the Power BI report
 * at the exact position where the unsupported map visual appears.
 *
 * Position is specified as percentages of the Power BI report container,
 * so it scales correctly across screen sizes.
 *
 * Enable `enableCalibration` to drag/resize the overlay and find the exact
 * position values, then copy them into your props.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ReportEmbed, ReportEmbedProps } from "./ReportEmbed";
import { ArcGISMapWrapper } from "@/components/maps/ArcGISMapWrapper";

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max);

type ReportWithMapOverlayProps = ReportEmbedProps & {
  showMapOverlay?: boolean;
  /** Top position as % of the report container (0–100) */
  mapTopPct?: number;
  /** Left position as % of the report container (0–100) */
  mapLeftPct?: number;
  /** Width as % of the report container (0–100) */
  mapWidthPct?: number;
  /** Height as % of the report container (0–100) */
  mapHeightPct?: number;
  /** Z-index for the map (default: 10) */
  mapZIndex?: number;
  /** Enable calibration mode to drag/resize and find exact position */
  enableCalibration?: boolean;
};

type Position = {
  topPct: number;
  leftPct: number;
  widthPct: number;
  heightPct: number;
};

type DragState = {
  type: "move" | "resize-se" | "resize-sw" | "resize-ne" | "resize-nw";
  startX: number;
  startY: number;
  startPos: Position;
};

export function ReportWithMapOverlay({
  showMapOverlay = true,
  mapTopPct = 25,
  mapLeftPct = 55,
  mapWidthPct = 43,
  mapHeightPct = 65,
  mapZIndex = 10,
  enableCalibration = false,
  ...reportProps
}: ReportWithMapOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [calibrating, setCalibrating] = useState(false);
  const [pos, setPos] = useState<Position>({
    topPct: mapTopPct,
    leftPct: mapLeftPct,
    widthPct: mapWidthPct,
    heightPct: mapHeightPct,
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPos({
      topPct: mapTopPct,
      leftPct: mapLeftPct,
      widthPct: mapWidthPct,
      heightPct: mapHeightPct,
    });
  }, [mapTopPct, mapLeftPct, mapWidthPct, mapHeightPct]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const drag = dragRef.current;
      const container = containerRef.current;
      if (!drag || !container) return;

      const rect = container.getBoundingClientRect();
      const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;

      setPos((prev) => {
        const s = drag.startPos;

        switch (drag.type) {
          case "move": {
            return {
              ...prev,
              topPct: clamp(s.topPct + dyPct, 0, 100 - s.heightPct),
              leftPct: clamp(s.leftPct + dxPct, 0, 100 - s.widthPct),
            };
          }
          case "resize-se": {
            return {
              ...prev,
              widthPct: clamp(s.widthPct + dxPct, 5, 100 - s.leftPct),
              heightPct: clamp(s.heightPct + dyPct, 5, 100 - s.topPct),
            };
          }
          case "resize-sw": {
            const newWidth = clamp(s.widthPct - dxPct, 5, s.leftPct + s.widthPct);
            const newLeft = s.leftPct + (s.widthPct - newWidth);
            return {
              ...prev,
              leftPct: newLeft,
              widthPct: newWidth,
              heightPct: clamp(s.heightPct + dyPct, 5, 100 - s.topPct),
            };
          }
          case "resize-ne": {
            const newHeight = clamp(s.heightPct - dyPct, 5, s.topPct + s.heightPct);
            const newTop = s.topPct + (s.heightPct - newHeight);
            return {
              ...prev,
              topPct: newTop,
              widthPct: clamp(s.widthPct + dxPct, 5, 100 - s.leftPct),
              heightPct: newHeight,
            };
          }
          case "resize-nw": {
            const newW = clamp(s.widthPct - dxPct, 5, s.leftPct + s.widthPct);
            const newL = s.leftPct + (s.widthPct - newW);
            const newH = clamp(s.heightPct - dyPct, 5, s.topPct + s.heightPct);
            const newT = s.topPct + (s.heightPct - newH);
            return {
              topPct: newT,
              leftPct: newL,
              widthPct: newW,
              heightPct: newH,
            };
          }
          default:
            return prev;
        }
      });
    },
    [],
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  useEffect(() => {
    if (!calibrating) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [calibrating, handleMouseMove, handleMouseUp]);

  const startDrag = (
    e: React.MouseEvent,
    type: DragState["type"],
  ) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.userSelect = "none";
    if (type !== "move") {
      const cursors: Record<string, string> = {
        "resize-se": "nwse-resize",
        "resize-sw": "nesw-resize",
        "resize-ne": "nesw-resize",
        "resize-nw": "nwse-resize",
      };
      document.body.style.cursor = cursors[type] ?? "";
    }
    dragRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...pos },
    };
  };

  const copyProps = () => {
    const text = [
      `mapTopPct={${pos.topPct.toFixed(1)}}`,
      `mapLeftPct={${pos.leftPct.toFixed(1)}}`,
      `mapWidthPct={${pos.widthPct.toFixed(1)}}`,
      `mapHeightPct={${pos.heightPct.toFixed(1)}}`,
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleSize = 10;

  const resizeHandle = (
    corner: "nw" | "ne" | "sw" | "se",
  ) => {
    const cursors: Record<string, string> = {
      se: "nwse-resize",
      sw: "nesw-resize",
      ne: "nesw-resize",
      nw: "nwse-resize",
    };
    const posStyle: React.CSSProperties = {
      position: "absolute",
      width: handleSize,
      height: handleSize,
      backgroundColor: "#0d4477",
      border: "1px solid white",
      borderRadius: 2,
      cursor: cursors[corner],
      zIndex: 20,
      ...(corner.includes("n") ? { top: -handleSize / 2 } : { bottom: -handleSize / 2 }),
      ...(corner.includes("w") ? { left: -handleSize / 2 } : { right: -handleSize / 2 }),
    };

    return (
      <div
        style={posStyle}
        onMouseDown={(e) =>
          startDrag(e, `resize-${corner}` as DragState["type"])
        }
      />
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Power BI Report */}
      <ReportEmbed {...reportProps} />

      {/* ArcGIS Map Overlay — positioned as % of the report container */}
      {showMapOverlay && (
        <div
          className="absolute inset-0"
          style={{ zIndex: mapZIndex, pointerEvents: "none" }}
        >
          <div
            className="absolute overflow-visible"
            style={{
              top: `${pos.topPct}%`,
              left: `${pos.leftPct}%`,
              width: `${pos.widthPct}%`,
              height: `${pos.heightPct}%`,
              pointerEvents: "auto",
            }}
          >
            {/* Calibration UI */}
            {calibrating && (
              <>
                {/* Dashed border */}
                <div
                  className="absolute inset-0 border-2 border-dashed border-blue-500 rounded-lg"
                  style={{ pointerEvents: "none", zIndex: 15 }}
                />

                {/* Drag handle (entire top bar) */}
                <div
                  className="absolute top-0 left-0 right-0 h-6 bg-blue-500/80 cursor-move flex items-center justify-center"
                  style={{ zIndex: 15, borderRadius: "8px 8px 0 0" }}
                  onMouseDown={(e) => startDrag(e, "move")}
                >
                  <span className="text-white text-[10px] font-medium select-none">
                    ⠿ Drag to move
                  </span>
                </div>

                {/* Resize handles */}
                {resizeHandle("nw")}
                {resizeHandle("ne")}
                {resizeHandle("sw")}
                {resizeHandle("se")}

                {/* Info panel */}
                <div
                  className="absolute left-0 flex items-center gap-2 bg-gray-900/90 text-white text-xs px-3 py-1.5 rounded-md shadow-lg select-none"
                  style={{
                    bottom: "calc(100% + 8px)",
                    zIndex: 20,
                    pointerEvents: "auto",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span className="font-mono">
                    T:{pos.topPct.toFixed(1)}% L:{pos.leftPct.toFixed(1)}% W:{pos.widthPct.toFixed(1)}% H:{pos.heightPct.toFixed(1)}%
                  </span>
                  <button
                    onClick={copyProps}
                    className="ml-1 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] transition"
                  >
                    {copied ? "✓ Copied!" : "Copy Props"}
                  </button>
                </div>
              </>
            )}

            {/* Map */}
            <div className="w-full h-full rounded-lg overflow-hidden shadow-lg border-2 border-white">
              <ArcGISMapWrapper height="100%" />
            </div>
          </div>
        </div>
      )}

      {/* Calibration toggle button */}
      {enableCalibration && (
        <button
          onClick={() => setCalibrating((v) => !v)}
          className="absolute top-2 right-2 px-3 py-1.5 text-xs font-medium rounded-md shadow-md transition-colors"
          style={{
            zIndex: mapZIndex + 5,
            backgroundColor: calibrating ? "#0d4477" : "rgba(255,255,255,0.9)",
            color: calibrating ? "white" : "#0d4477",
            border: "1px solid #0d4477",
          }}
        >
          {calibrating ? "🔒 Lock Position" : "📐 Calibrate Map"}
        </button>
      )}
    </div>
  );
}
