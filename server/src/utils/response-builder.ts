/**
 * Response Builder for MCP 2025-06-18+ structuredContent standard
 *
 * Provides standardized response building for all MCP tools.
 */

// Tool categories for classification
export type ToolCategory =
  | "influencer_search"
  | "trend_analysis"
  | "brand_analysis"
  | "market_insights"
  | "content_analysis"
  | "multiplatform"
  | "utility";

// Operation types
export type OperationType = "search" | "analysis" | "comparison";

/**
 * Standardized structuredContent schema for all tools
 */
export interface StandardizedStructuredContent {
  meta: {
    toolName: string;
    toolCategory: ToolCategory;
    operationType: OperationType;
    timestamp: string;
  };
  summary: {
    description: string;
    totalResults: number;
    criteria?: string;
  };
  data: Record<string, unknown>[] | Record<string, unknown>;
  downloadUrl?: string;
  pagination?: {
    returnedCount: number;
    totalAvailable: number;
    hasMore: boolean;
  };
  // Index signature for Record<string, unknown> compatibility
  [key: string]: unknown;
}

/**
 * ChatGPT-specific metadata for widget rendering
 */
export interface ChatGptMeta {
  outputTemplate?: string;
  widgetAccessible?: boolean;
  widgetData?: Record<string, unknown>;
}

/**
 * MCP CallToolResult compatible interface
 * Using a generic type to match the SDK's expected structure
 */
export interface ToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Options for building a tool response
 */
export interface BuildToolResponseOptions {
  toolName: string;
  toolCategory: ToolCategory;
  operationType: OperationType;

  // Summary info
  description: string;
  totalResults: number;
  criteria?: string;

  // Data payload
  data: Record<string, unknown>[] | Record<string, unknown>;
  downloadUrl?: string;

  // ChatGPT-specific options (for widget-enabled tools)
  chatGptMeta?: ChatGptMeta;
}

/**
 * Build a standardized tool response with structuredContent
 *
 * All MCP hosts receive the same structuredContent.
 * ChatGPT-specific _meta is added when chatGptMeta is provided.
 */
export function buildToolResponse(options: BuildToolResponseOptions): ToolResponse {
  const dataArray = Array.isArray(options.data) ? options.data : [options.data];

  const structuredContent: StandardizedStructuredContent = {
    meta: {
      toolName: options.toolName,
      toolCategory: options.toolCategory,
      operationType: options.operationType,
      timestamp: new Date().toISOString(),
    },
    summary: {
      description: options.description,
      totalResults: options.totalResults,
      ...(options.criteria && { criteria: options.criteria }),
    },
    data: options.data,
    ...(options.downloadUrl && { downloadUrl: options.downloadUrl }),
    pagination: {
      returnedCount: dataArray.length,
      totalAvailable: options.totalResults,
      hasMore: dataArray.length < options.totalResults,
    },
  };

  // Build base response - ALL hosts get structuredContent
  // content contains JSON.stringify for backward compatibility (MCP spec recommendation)
  const response: ToolResponse = {
    structuredContent,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(structuredContent),
      },
    ],
  };

  // Add ChatGPT-specific _meta if widget is used
  if (options.chatGptMeta) {
    response._meta = {
      ...(options.chatGptMeta.outputTemplate && {
        "openai/outputTemplate": options.chatGptMeta.outputTemplate,
        "openai/widgetAccessible": options.chatGptMeta.widgetAccessible ?? true,
      }),
      ...options.chatGptMeta.widgetData,
    };
  }

  return response;
}

/**
 * Build an error response
 */
export function buildErrorResponse(
  toolName: string,
  errorMessage: string,
  toolCategory: ToolCategory = "utility"
): ToolResponse {
  const structuredContent = {
    meta: {
      toolName,
      toolCategory,
      operationType: "search" as OperationType,
      timestamp: new Date().toISOString(),
    },
    error: {
      message: errorMessage,
      code: "TOOL_ERROR",
    },
  };

  return {
    structuredContent,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(structuredContent),
      },
    ],
    isError: true,
  };
}
