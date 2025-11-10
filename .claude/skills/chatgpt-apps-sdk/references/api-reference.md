# window.openai API Reference

Complete API reference for ChatGPT Apps SDK component bridge.

## API Overview

`window.openai` is the bridge between React components and ChatGPT. It provides:
- State management (tool data, widget state)
- Actions (tool calls, navigation, messaging)
- Layout control (display modes, themes)
- Client information (user agent, locale, location)

## Type Definitions

### OpenAiGlobals

```typescript
interface OpenAiGlobals<
  ToolInput = UnknownObject,
  ToolOutput = UnknownObject,
  ToolResponseMetadata = UnknownObject,
  WidgetState = UnknownObject
> {
  // Appearance
  theme: Theme;
  
  // Client info
  userAgent: UserAgent;
  locale: string;
  
  // Layout
  maxHeight: number;
  displayMode: DisplayMode;
  safeArea: SafeArea;
  
  // Data
  toolInput: ToolInput;
  toolOutput: ToolOutput | null;
  toolResponseMetadata: ToolResponseMetadata | null;
  widgetState: WidgetState | null;
}
```

### API Methods

```typescript
interface API<WidgetState = UnknownObject> {
  callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<CallToolResponse>;
  
  sendFollowUpMessage(args: {
    prompt: string;
  }): Promise<void>;
  
  openExternal(payload: {
    href: string;
  }): void;
  
  requestDisplayMode(args: {
    mode: DisplayMode;
  }): Promise<{
    mode: DisplayMode;
  }>;
  
  setWidgetState(state: WidgetState): Promise<void>;
}
```

## Globals

### theme

```typescript
theme: "light" | "dark"
```

Current theme. Update component styling when this changes.

**Example:**
```typescript
const theme = useOpenAiGlobal("theme");

return (
  <div className={theme === "dark" ? "dark-mode" : "light-mode"}>
    {/* content */}
  </div>
);
```

### userAgent

```typescript
interface UserAgent {
  device: {
    type: "mobile" | "tablet" | "desktop" | "unknown";
  };
  capabilities: {
    hover: boolean;
    touch: boolean;
  };
}
```

Device type and capabilities.

**Example:**
```typescript
const userAgent = useOpenAiGlobal("userAgent");

if (userAgent.device.type === "mobile") {
  // Render mobile-optimized UI
}

if (userAgent.capabilities.touch) {
  // Add touch-friendly interactions
}
```

### locale

```typescript
locale: string // BCP 47 tag
```

User's preferred locale (e.g., "en-US", "fr-FR", "es-419").

**Example:**
```typescript
const locale = useOpenAiGlobal("locale");

const dateFormatter = new Intl.DateTimeFormat(locale);
const formattedDate = dateFormatter.format(new Date());
```

### maxHeight

```typescript
maxHeight: number // pixels
```

Maximum height available for component in current display mode.

**Example:**
```typescript
const maxHeight = useOpenAiGlobal("maxHeight");

return (
  <div style={{ maxHeight: `${maxHeight}px`, overflow: "auto" }}>
    {/* scrollable content */}
  </div>
);
```

### displayMode

```typescript
displayMode: "inline" | "pip" | "fullscreen"
```

Current display mode:
- `inline`: Embedded in conversation
- `pip`: Picture-in-picture (desktop only)
- `fullscreen`: Full screen view

**Example:**
```typescript
const displayMode = useOpenAiGlobal("displayMode");

if (displayMode === "fullscreen") {
  // Show detailed view
} else {
  // Show compact view
}
```

### safeArea

```typescript
interface SafeArea {
  insets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}
```

Safe area insets (important for mobile devices with notches).

**Example:**
```typescript
const safeArea = useOpenAiGlobal("safeArea");

return (
  <div style={{
    paddingTop: safeArea.insets.top,
    paddingBottom: safeArea.insets.bottom
  }}>
    {/* content */}
  </div>
);
```

### toolInput

```typescript
toolInput: ToolInput
```

Arguments passed when the tool was called. Always available.

**Example:**
```typescript
const toolInput = useOpenAiGlobal("toolInput");

console.log("User requested:", toolInput.query);
```

### toolOutput

```typescript
toolOutput: ToolOutput | null
```

Structured content from the tool result (`structuredContent` field).

**Example:**
```typescript
const toolOutput = useOpenAiGlobal("toolOutput");

if (!toolOutput) return <div>Loading...</div>;

return (
  <div>
    {toolOutput.items.map(item => (
      <div key={item.id}>{item.name}</div>
    ))}
  </div>
);
```

### toolResponseMetadata

```typescript
toolResponseMetadata: ToolResponseMetadata | null
```

Metadata from tool result (`_meta` field). Only visible to component.

**Example:**
```typescript
const toolMeta = useOpenAiGlobal("toolResponseMetadata");

console.log("Last synced:", toolMeta?.timestamp);
```

### widgetState

```typescript
widgetState: WidgetState | null
```

Persisted widget state. Shared with model and across sessions.

**Example:**
```typescript
const widgetState = useOpenAiGlobal("widgetState");

console.log("User favorites:", widgetState?.favorites);
```

## Methods

### callTool

```typescript
callTool(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResponse>
```

Call an MCP tool from the component. Tool must have `openai/widgetAccessible: true`.

**Parameters:**
- `name`: Tool name to call
- `args`: Tool arguments matching `inputSchema`

**Returns:**
- Promise resolving to full tool response

**Example:**
```typescript
async function handleRefresh() {
  try {
    const response = await window.openai.callTool("refresh_data", {
      filter: "recent"
    });
    
    console.log("Refreshed:", response.structuredContent);
  } catch (error) {
    console.error("Refresh failed:", error);
  }
}
```

**Response Structure:**
```typescript
interface CallToolResponse {
  content?: Content[];
  structuredContent?: Record<string, any>;
  _meta?: Record<string, any>;
  isError?: boolean;
}
```

### sendFollowUpMessage

```typescript
sendFollowUpMessage(args: {
  prompt: string;
}): Promise<void>
```

Insert a message into the conversation as if the user typed it.

**Parameters:**
- `prompt`: Message text to send

**Example:**
```typescript
async function handleCreateSummary() {
  await window.openai.sendFollowUpMessage({
    prompt: "Create a summary of my favorite items"
  });
}
```

**Use Cases:**
- Generate reports based on selections
- Ask follow-up questions
- Trigger multi-step workflows

### openExternal

```typescript
openExternal(payload: {
  href: string;
}): void
```

Open an external link. Opens in new tab on web, navigates app on mobile.

**Parameters:**
- `href`: URL to open (must match CSP `connect_domains` or `widgetDomain`)

**Example:**
```typescript
function handleViewDetails(itemId: string) {
  window.openai.openExternal({
    href: `https://example.com/items/${itemId}`
  });
}
```

**Security:**
- URL must match configured domains
- Invalid URLs are blocked
- HTTPS required

### requestDisplayMode

```typescript
requestDisplayMode(args: {
  mode: DisplayMode;
}): Promise<{
  mode: DisplayMode;
}>
```

Request layout change. Host may deny or modify the request.

**Parameters:**
- `mode`: Desired display mode

**Returns:**
- Promise with granted mode (may differ from requested)

**Example:**
```typescript
async function handleExpandToFullscreen() {
  const result = await window.openai.requestDisplayMode({
    mode: "fullscreen"
  });
  
  if (result.mode === "fullscreen") {
    console.log("Granted fullscreen");
  } else {
    console.log("Fullscreen denied, mode:", result.mode);
  }
}
```

**Notes:**
- Mobile may coerce `pip` to `fullscreen`
- Request may be denied based on context
- Component should handle fallback gracefully

### setWidgetState

```typescript
setWidgetState(state: WidgetState): Promise<void>
```

Persist widget state. Visible to model and restored in future sessions.

**Parameters:**
- `state`: State object to persist (keep under 4KB)

**Example:**
```typescript
async function handleToggleFavorite(itemId: string) {
  const currentState = window.openai.widgetState || { favorites: [] };
  
  const favorites = currentState.favorites.includes(itemId)
    ? currentState.favorites.filter(id => id !== itemId)
    : [...currentState.favorites, itemId];
  
  await window.openai.setWidgetState({ favorites });
}
```

**Best Practices:**
- Keep payload small (< 4KB, ~1000 tokens)
- Only store data model needs to see
- Update incrementally, not on every render
- Use for user preferences, selections, filters

## Events

### openai:set_globals

```typescript
class SetGlobalsEvent extends CustomEvent<{
  globals: Partial<OpenAiGlobals>;
}> {
  readonly type = "openai:set_globals";
}
```

Fired when any global changes.

**Example:**
```typescript
window.addEventListener("openai:set_globals", (event) => {
  const { globals } = event.detail;
  
  if (globals.theme) {
    console.log("Theme changed:", globals.theme);
  }
  
  if (globals.toolOutput) {
    console.log("New tool output:", globals.toolOutput);
  }
});
```

**Use with React:**
```typescript
useEffect(() => {
  const handler = (event: SetGlobalsEvent) => {
    // Handle changes
  };
  
  window.addEventListener("openai:set_globals", handler);
  return () => window.removeEventListener("openai:set_globals", handler);
}, []);
```

## Navigation Integration

### React Router

ChatGPT mirrors iframe history in host UI. Use standard routing:

```typescript
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";

function App() {
  const navigate = useNavigate();
  
  const openDetails = (id: string) => {
    navigate(`/item/${id}`);
  };
  
  const goBack = () => {
    navigate(-1);
  };
  
  return (
    <Routes>
      <Route path="/" element={<ListView onItemClick={openDetails} />} />
      <Route path="/item/:id" element={<DetailView onBack={goBack} />} />
    </Routes>
  );
}

export default function Root() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
```

**Features:**
- Browser back/forward buttons work
- URL updates in address bar
- History persists across sessions
- Deep linking supported

### Navigation Stack

```typescript
// Push new route
navigate("/item/123", { replace: false });

// Replace current route
navigate("/item/123", { replace: true });

// Go back
navigate(-1);

// Go forward
navigate(1);

// Go to specific index
navigate(-2);
```

## Error Handling

### Tool Call Errors

```typescript
async function safeTool Call() {
  try {
    const result = await window.openai.callTool("get_data", {});
    return result;
  } catch (error) {
    if (error.code === "UNAUTHORIZED") {
      // Prompt user to authenticate
      console.error("Please sign in");
    } else if (error.code === "RATE_LIMITED") {
      // Show rate limit message
      console.error("Too many requests");
    } else {
      // Generic error handling
      console.error("Tool call failed:", error);
    }
  }
}
```

### Display Mode Errors

```typescript
async function safeRequestDisplayMode(mode: DisplayMode) {
  try {
    const result = await window.openai.requestDisplayMode({ mode });
    return result.mode;
  } catch (error) {
    console.error("Display mode change failed:", error);
    return window.openai.displayMode; // Fallback to current mode
  }
}
```

## Best Practices

### Performance

- Subscribe only to needed globals
- Debounce `setWidgetState` calls
- Lazy load heavy components
- Virtualize long lists

### Accessibility

- Respect `userAgent.capabilities.hover`
- Add touch-friendly hit areas on mobile
- Support keyboard navigation
- Provide ARIA labels

### Security

- Validate all external URLs
- Sanitize user input
- Never expose secrets in component
- Use HTTPS for all external requests

### UX

- Handle loading and error states
- Provide visual feedback for actions
- Test in all display modes
- Respect theme changes immediately
