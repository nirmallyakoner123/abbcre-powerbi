"use client";

/**
 * ArcGIS Map Component — supports two auth modes (app owns data vs user sign-in).
 *
 * Preferred: API Key (no sign-in for viewers)
 *   Set NEXT_PUBLIC_ARCGIS_API_KEY. The app loads the Web Map with that key;
 *   viewers do NOT need ArcGIS accounts or to sign in. Same idea as Power BI "app owns data".
 *
 * Fallback: OAuth 2.0 (each viewer must sign in)
 *   Set NEXT_PUBLIC_ARCGIS_CLIENT_ID (and optionally remove API key). Each user
 *   is prompted to sign in to ArcGIS; requires ArcGIS account.
 *
 * Required: NEXT_PUBLIC_ARCGIS_WEBMAP_ID — your Web Map item ID from ArcGIS Online.
 *
 * References:
 *   - API keys: https://developers.arcgis.com/documentation/security-and-authentication/api-keys/
 *   - OAuth:   https://developers.arcgis.com/documentation/security-and-authentication/
 */

import { useEffect, useRef, useState } from "react";

// Import ArcGIS CSS
import "@arcgis/core/assets/esri/themes/light/main.css";

// ArcGIS modules
import esriConfig from "@arcgis/core/config";
import OAuthInfo from "@arcgis/core/identity/OAuthInfo";
import IdentityManager from "@arcgis/core/identity/IdentityManager";
import WebMap from "@arcgis/core/WebMap";
import MapView from "@arcgis/core/views/MapView";
import Portal from "@arcgis/core/portal/Portal";

type ArcGISMapProps = {
    /** Override the Web Map ID (defaults to NEXT_PUBLIC_ARCGIS_WEBMAP_ID) */
    webMapId?: string;
    /** Override the OAuth Client ID (defaults to NEXT_PUBLIC_ARCGIS_CLIENT_ID) */
    clientId?: string;
    /** Override the API key (defaults to NEXT_PUBLIC_ARCGIS_API_KEY) */
    apiKey?: string;
    /** CSS class name for the container */
    className?: string;
    /** Height of the map container (default: 500px) */
    height?: string;
};

export function ArcGISMap({
    webMapId,
    clientId,
    apiKey: apiKeyProp,
    className = "",
    height = "500px",
}: ArcGISMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MapView | null>(null);
    const [status, setStatus] = useState<
        "loading" | "authenticating" | "ready" | "error"
    >("loading");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [authMode, setAuthMode] = useState<"apiKey" | "oauth">("apiKey");

    const resolvedApiKey =
        apiKeyProp || process.env.NEXT_PUBLIC_ARCGIS_API_KEY || "";
    const resolvedClientId =
        clientId || process.env.NEXT_PUBLIC_ARCGIS_CLIENT_ID || "";
    const resolvedWebMapId =
        webMapId || process.env.NEXT_PUBLIC_ARCGIS_WEBMAP_ID || "";

    useEffect(() => {
        if (!mapRef.current) return;

        if (!resolvedWebMapId || resolvedWebMapId === "YOUR_WEBMAP_ID_HERE") {
            setStatus("error");
            setErrorMessage(
                "ArcGIS Web Map ID not configured. Set NEXT_PUBLIC_ARCGIS_WEBMAP_ID in your .env file."
            );
            return;
        }

        const useApiKey =
            !!resolvedApiKey && resolvedApiKey !== "YOUR_API_KEY_HERE";

        if (!useApiKey) {
            if (
                !resolvedClientId ||
                resolvedClientId === "YOUR_CLIENT_ID_HERE"
            ) {
                setStatus("error");
                setErrorMessage(
                    "Configure ArcGIS: set NEXT_PUBLIC_ARCGIS_API_KEY (recommended, no sign-in) or NEXT_PUBLIC_ARCGIS_CLIENT_ID (OAuth sign-in) in your .env file."
                );
                return;
            }
        }

        if (useApiKey) {
            esriConfig.apiKey = resolvedApiKey;
            setAuthMode("apiKey");
        } else {
            setAuthMode("oauth");
        }

        let cancelled = false;

        async function loadMapWithApiKey(): Promise<void> {
            const webmap = new WebMap({
                portalItem: { id: resolvedWebMapId },
            });
            const view = new MapView({
                container: mapRef.current!,
                map: webmap,
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
            });
            viewRef.current = view;
            await view.when();
            if (cancelled) {
                view.destroy();
                return;
            }
            setStatus("ready");
            console.log("[ArcGIS] Map loaded with API key (no sign-in required)");
        }

        async function loadMapWithOAuth(): Promise<void> {
            const oAuthInfo = new OAuthInfo({
                appId: resolvedClientId,
                popup: true,
                popupCallbackUrl: `${window.location.origin}/oauth-callback.html`,
            });
            IdentityManager.registerOAuthInfos([oAuthInfo]);

            let _credential;
            try {
                _credential = await IdentityManager.checkSignInStatus(
                    oAuthInfo.portalUrl + "/sharing"
                );
            } catch {
                _credential = await IdentityManager.getCredential(
                    oAuthInfo.portalUrl + "/sharing"
                );
            }

            if (cancelled) return;

            const portal = new Portal();
            portal.authMode = "immediate";
            await portal.load();
            if (portal.user) {
                setUserName(portal.user.fullName || portal.user.username);
            }
            if (cancelled) return;

            const webmap = new WebMap({
                portalItem: { id: resolvedWebMapId },
            });
            const view = new MapView({
                container: mapRef.current!,
                map: webmap,
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
            });
            viewRef.current = view;
            await view.when();
            if (cancelled) {
                view.destroy();
                return;
            }
            setStatus("ready");
            console.log("[ArcGIS] Map loaded with OAuth");
        }

        async function initMap() {
            try {
                if (!useApiKey) setStatus("authenticating");

                if (useApiKey) {
                    await loadMapWithApiKey();
                } else {
                    await loadMapWithOAuth();
                }
            } catch (err: unknown) {
                if (cancelled) return;

                console.error("[ArcGIS] Error initializing map:", err);
                setStatus("error");

                const message =
                    err instanceof Error ? err.message : String(err);

                if (
                    message.includes("user-aborted") ||
                    message.includes("ABORTED")
                ) {
                    setErrorMessage(
                        "Sign-in was cancelled. Click Retry to sign in again, or ask your admin to use an ArcGIS API key so viewers don’t need to sign in."
                    );
                } else if (message.includes("User denied")) {
                    setErrorMessage(
                        "ArcGIS sign-in was cancelled. Please refresh and sign in to view the map."
                    );
                } else if (message.includes("Invalid client_id")) {
                    setErrorMessage(
                        "Invalid ArcGIS Client ID. Please check NEXT_PUBLIC_ARCGIS_CLIENT_ID in your .env file."
                    );
                } else if (message.includes("Item does not exist")) {
                    setErrorMessage(
                        "Web Map not found. Please check NEXT_PUBLIC_ARCGIS_WEBMAP_ID in your .env file."
                    );
                } else if (
                    message.includes("Invalid API key") ||
                    message.includes("API key")
                ) {
                    setErrorMessage(
                        "Invalid ArcGIS API key. Check NEXT_PUBLIC_ARCGIS_API_KEY or use OAuth (NEXT_PUBLIC_ARCGIS_CLIENT_ID) instead."
                    );
                } else {
                    setErrorMessage(
                        message ||
                            "Failed to load ArcGIS map. Check the console for details."
                    );
                }
            }
        }

        initMap();

        return () => {
            cancelled = true;
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
        };
    }, [resolvedApiKey, resolvedClientId, resolvedWebMapId]);

    return (
        <div className={`arcgis-map-container ${className}`}>
            {/* Status Bar: only show "sign in" / "signed in" when using OAuth */}
            {status === "authenticating" && authMode === "oauth" && (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-t-lg text-blue-700 text-sm">
                    <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                    Connecting to ArcGIS… Please sign in if prompted.
                </div>
            )}

            {status === "ready" && authMode === "oauth" && userName && (
                <div className="flex items-center justify-between px-4 py-2 bg-green-50 border border-green-200 rounded-t-lg text-green-700 text-sm">
                    <span>
                        ✅ Connected to ArcGIS as <strong>{userName}</strong>
                    </span>
                    <button
                        onClick={() => {
                            IdentityManager.destroyCredentials();
                            window.location.reload();
                        }}
                        className="text-green-600 hover:text-green-800 underline text-xs"
                    >
                        Sign out
                    </button>
                </div>
            )}

            {/* Error State */}
            {status === "error" && (
                <div className="px-4 py-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
                    <p className="font-medium mb-1">⚠️ Map Error</p>
                    <p className="text-sm">{errorMessage}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-3 px-4 py-1.5 bg-red-100 hover:bg-red-200 rounded text-red-800 text-sm transition"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Map Container */}
            {status !== "error" && (
                <div
                    ref={mapRef}
                    style={{ width: "100%", height }}
                    className={`rounded-b-lg overflow-hidden border border-gray-200 ${status === "loading" ? "bg-gray-100 animate-pulse" : ""
                        }`}
                />
            )}
        </div>
    );
}

export default ArcGISMap;
