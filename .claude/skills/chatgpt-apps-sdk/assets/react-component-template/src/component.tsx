import React, { useState, useEffect, useSyncExternalStore, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";

// ============================================================================
// Types
// ============================================================================

interface OpenAiGlobals {
  theme: "light" | "dark";
  toolInput: any;
  toolOutput: any | null;
  toolResponseMetadata: any | null;
  widgetState: any | null;
  displayMode: "inline" | "pip" | "fullscreen";
  maxHeight: number;
  locale: string;
  userAgent: {
    device: { type: "mobile" | "tablet" | "desktop" | "unknown" };
    capabilities: { hover: boolean; touch: boolean };
  };
  safeArea: {
    insets: { top: number; bottom: number; left: number; right: number };
  };
}

interface SetGlobalsEvent extends CustomEvent<{ globals: Partial<OpenAiGlobals> }> {}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Subscribe to window.openai global changes
 */
export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(
  key: K
): OpenAiGlobals[K] {
  return useSyncExternalStore(
    (onChange) => {
      const handleSetGlobal = (event: SetGlobalsEvent) => {
        if (event.detail.globals[key] !== undefined) {
          onChange();
        }
      };
      
      window.addEventListener("openai:set_globals", handleSetGlobal as any);
      
      return () => {
        window.removeEventListener("openai:set_globals", handleSetGlobal as any);
      };
    },
    () => (window as any).openai?.[key]
  );
}

/**
 * Manage widget state with persistence
 */
export function useWidgetState<T>(
  defaultState: T | (() => T)
): [T, (state: T | ((prev: T) => T)) => void] {
  const widgetStateFromWindow = useOpenAiGlobal("widgetState") as T;
  
  const [widgetState, _setWidgetState] = useState<T>(() => {
    if (widgetStateFromWindow != null) {
      return widgetStateFromWindow;
    }
    return typeof defaultState === "function"
      ? (defaultState as () => T)()
      : defaultState;
  });

  useEffect(() => {
    if (widgetStateFromWindow != null) {
      _setWidgetState(widgetStateFromWindow);
    }
  }, [widgetStateFromWindow]);

  const setWidgetState = useCallback(
    (state: T | ((prev: T) => T)) => {
      _setWidgetState((prevState) => {
        const newState = typeof state === "function"
          ? (state as (prev: T) => T)(prevState)
          : state;
        
        (window as any).openai?.setWidgetState(newState);
        return newState;
      });
    },
    []
  );

  return [widgetState, setWidgetState];
}

/**
 * Convenience hooks for common globals
 */
export const useToolInput = () => useOpenAiGlobal("toolInput");
export const useToolOutput = () => useOpenAiGlobal("toolOutput");
export const useToolResponseMetadata = () => useOpenAiGlobal("toolResponseMetadata");
export const useTheme = () => useOpenAiGlobal("theme");
export const useDisplayMode = () => useOpenAiGlobal("displayMode");
export const useUserAgent = () => useOpenAiGlobal("userAgent");

// ============================================================================
// Main Component
// ============================================================================

function App() {
  const toolInput = useToolInput();
  const toolOutput = useToolOutput();
  const toolMeta = useToolResponseMetadata();
  const theme = useTheme();
  const displayMode = useDisplayMode();
  const userAgent = useUserAgent();
  
  const [widgetState, setWidgetState] = useWidgetState<{
    favorites: string[];
  }>({ favorites: [] });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle refresh action
  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await (window as any).openai.callTool("refresh_data", {
        filter: "recent"
      });
    } catch (err) {
      setError("Failed to refresh data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle favorite
  const toggleFavorite = (itemId: string) => {
    setWidgetState((prev) => ({
      favorites: prev.favorites.includes(itemId)
        ? prev.favorites.filter((id) => id !== itemId)
        : [...prev.favorites, itemId]
    }));
  };

  // Request fullscreen
  const handleFullscreen = async () => {
    await (window as any).openai.requestDisplayMode({ mode: "fullscreen" });
  };

  // Send follow-up message
  const handleGenerateSummary = async () => {
    await (window as any).openai.sendFollowUpMessage({
      prompt: "Create a summary of my favorite items"
    });
  };

  // Render loading state
  if (loading || !toolOutput) {
    return (
      <div className={`app ${theme}`}>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`app ${theme}`}>
        <div className="error">{error}</div>
        <button onClick={handleRefresh}>Retry</button>
      </div>
    );
  }

  // Main render
  return (
    <div className={`app ${theme}`}>
      <header className="header">
        <h1>My App</h1>
        <div className="actions">
          <button onClick={handleRefresh} disabled={loading}>
            Refresh
          </button>
          {displayMode !== "fullscreen" && (
            <button onClick={handleFullscreen}>
              Fullscreen
            </button>
          )}
        </div>
      </header>

      <main className="content">
        {toolOutput.items?.map((item: any) => (
          <div key={item.id} className="item">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <button
              onClick={() => toggleFavorite(item.id)}
              className={widgetState.favorites.includes(item.id) ? "active" : ""}
            >
              {widgetState.favorites.includes(item.id) ? "★" : "☆"}
            </button>
          </div>
        ))}
      </main>

      {widgetState.favorites.length > 0 && (
        <footer className="footer">
          <p>{widgetState.favorites.length} favorites</p>
          <button onClick={handleGenerateSummary}>
            Generate Summary
          </button>
        </footer>
      )}
    </div>
  );
}

// ============================================================================
// Router Setup
// ============================================================================

function AppWithRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        {/* Add more routes as needed */}
      </Routes>
    </BrowserRouter>
  );
}

// ============================================================================
// Mount
// ============================================================================

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<AppWithRouter />);
}
