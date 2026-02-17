"use client";

/**
 * Wrapper component that overlays the ArcGIS map on top of the Power BI report
 * at the exact position where the unsupported map visual appears.
 * 
 * Usage:
 * 1. Adjust the position values (top, left, width, height) to match where the map appears in your Power BI report
 * 2. You can use percentage values or pixel values
 * 3. The overlay is positioned absolutely within the Power BI iframe container
 */

import { ReportEmbed, ReportEmbedProps } from "./ReportEmbed";
import { ArcGISMapWrapper } from "@/components/maps/ArcGISMapWrapper";

type ReportWithMapOverlayProps = ReportEmbedProps & {
  /** Show the ArcGIS map overlay */
  showMapOverlay?: boolean;
  /** Position from top of Power BI report (e.g., "200px" or "30%") */
  mapTop?: string;
  /** Position from left of Power BI report (e.g., "50px" or "10%") */
  mapLeft?: string;
  /** Width of the map overlay (e.g., "400px" or "40%") */
  mapWidth?: string;
  /** Height of the map overlay (e.g., "300px" or "50%") */
  mapHeight?: string;
  /** Z-index for the map (default: 10) */
  mapZIndex?: number;
};

export function ReportWithMapOverlay({
  showMapOverlay = true,
  mapTop = "200px",
  mapLeft = "50%",
  mapWidth = "45%",
  mapHeight = "400px",
  mapZIndex = 10,
  ...reportProps
}: ReportWithMapOverlayProps) {
  return (
    <div className="relative w-full">
      {/* Power BI Report */}
      <ReportEmbed {...reportProps} />

      {/* ArcGIS Map Overlay */}
      {showMapOverlay && (
        <div
          className="absolute pointer-events-auto"
          style={{
            top: mapTop,
            left: mapLeft,
            width: mapWidth,
            height: mapHeight,
            zIndex: mapZIndex,
          }}
        >
          <div className="w-full h-full rounded-lg overflow-hidden shadow-lg border-2 border-white">
            <ArcGISMapWrapper height="100%" />
          </div>
        </div>
      )}
    </div>
  );
}
