import React, { useState, useEffect } from "react";
import Carousel from "./components/Carousel";
import FullscreenViewer from "./components/FullscreenViewer";
import { useOpenAiGlobal, useDisplayMode } from "./hooks/useOpenAi";
import "./styles.css";

const App: React.FC = () => {
  const toolOutput = useOpenAiGlobal("toolOutput");
  const toolResponseMetadata = useOpenAiGlobal("toolResponseMetadata");
  const displayMode = useDisplayMode();
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

  console.log("=== APP.TSX RENDER ===");
  console.log("toolOutput:", toolOutput);
  console.log("toolResponseMetadata:", toolResponseMetadata);

  const profiles = toolResponseMetadata?.allProfiles || [];
  const searchMetadata = toolResponseMetadata?.searchMetadata;
  const hasError = toolOutput?.structuredContent?.error;

  console.log("profiles:", profiles);
  console.log("profiles length:", profiles.length);
  console.log("searchMetadata:", searchMetadata);
  console.log("displayMode:", displayMode);
  console.log("fullscreenIndex:", fullscreenIndex);

  // Handle card click - request fullscreen mode
  const handleCardClick = async (index: number) => {
    console.log('=== CARD CLICKED ===');
    console.log('Setting fullscreen index to:', index);
    setFullscreenIndex(index);

    // Request fullscreen mode (UI will show immediately)
    try {
      const result = await window.openai?.requestDisplayMode({ mode: 'fullscreen' });
      console.log('Fullscreen request result:', result);
    } catch (error) {
      console.error('Failed to request fullscreen mode:', error);
    }
  };

  // Handle close - return to inline mode
  const handleClose = async () => {
    console.log('=== CLOSING FULLSCREEN ===');
    setFullscreenIndex(null);

    try {
      const result = await window.openai?.requestDisplayMode({ mode: 'inline' });
      console.log('Inline mode request result:', result);
    } catch (error) {
      console.error('Failed to request inline mode:', error);
    }
  };

  // Handle error state
  if (hasError) {
    return (
      <div className="influencer-search-widget">
        <div className="error-message">
          <p>No search results found. Please try a different query.</p>
        </div>
      </div>
    );
  }

  // Detect loading state: toolOutput exists and has loading flag, or profiles is missing
  const isLoading =
    toolOutput?.loading === true ||
    (toolOutput && !toolResponseMetadata) ||
    (toolOutput &&
      toolResponseMetadata &&
      (!profiles || profiles.length === 0) &&
      !hasError);

  console.log("isLoading:", isLoading);

  // Handle case when data is not available
  if (!profiles || profiles.length === 0) {
    return (
      <div className="influencer-search-widget">
        <div className="empty-state">
          {isLoading && <span className="loading-spinner"></span>}
          <p>
            {isLoading
              ? "Searching for influencers. Please wait a moment."
              : "Searching for influencers. Please wait a moment."}
          </p>
        </div>
      </div>
    );
  }

  // Show fullscreen viewer if an index is selected
  console.log('Checking fullscreen condition:', {
    displayMode,
    fullscreenIndex,
    shouldShowFullscreen: fullscreenIndex !== null
  });

  if (fullscreenIndex !== null) {
    console.log('=== RENDERING FULLSCREEN VIEWER ===');
    return (
      <FullscreenViewer
        profiles={profiles}
        initialIndex={fullscreenIndex}
        onClose={handleClose}
      />
    );
  }

  return (
    <div className="influencer-search-widget">
      {searchMetadata && (
        <div className="search-header">
          <h3>Search results for "{searchMetadata.query}"</h3>
          <p>
            Showing {profiles.length} of {searchMetadata.totalCount} results
          </p>
        </div>
      )}

      <Carousel profiles={profiles} onCardClick={handleCardClick} />

      <div className="footer-actions">
        <button
          className="whotag-cta-btn"
          onClick={() => window.openai?.openExternal({ href: "https://whotag.ai" })}
        >
          Find your perfect Beauty creator on WHOTAG.ai
        </button>
      </div>
    </div>
  );
};

export default App;
