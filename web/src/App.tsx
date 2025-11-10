import React from "react";
import Carousel from "./components/Carousel";
import { useOpenAiGlobal } from "./hooks/useOpenAi";
import "./styles.css";

const App: React.FC = () => {
  const toolOutput = useOpenAiGlobal("toolOutput");
  const toolResponseMetadata = useOpenAiGlobal("toolResponseMetadata");

  console.log("=== APP.TSX RENDER ===");
  console.log("toolOutput:", toolOutput);
  console.log("toolResponseMetadata:", toolResponseMetadata);

  const profiles = toolResponseMetadata?.allProfiles || [];
  const searchMetadata = toolResponseMetadata?.searchMetadata;
  const hasError = toolOutput?.structuredContent?.error;

  console.log("profiles:", profiles);
  console.log("profiles length:", profiles.length);
  console.log("searchMetadata:", searchMetadata);

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

      <Carousel profiles={profiles} />

      <div className="footer-actions">
        <button
          className="whotag-cta-btn"
          onClick={() => window.open("https://whotag.ai", "_blank")}
        >
          Find your perfect Beauty creator on WHOTAG.ai
        </button>
      </div>
    </div>
  );
};

export default App;
