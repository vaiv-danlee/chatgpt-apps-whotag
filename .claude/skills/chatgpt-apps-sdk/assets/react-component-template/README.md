# React Component Template

Boilerplate React component for ChatGPT Apps SDK.

## Features

- ✅ TypeScript support
- ✅ React hooks for `window.openai` API
- ✅ Theme support (light/dark)
- ✅ Widget state management
- ✅ React Router integration
- ✅ Responsive design
- ✅ Accessibility features

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build component:**
   ```bash
   npm run build:all
   ```

3. **Output files:**
   - `dist/component.js` - Bundled JavaScript
   - `dist/component.css` - Stylesheet

## Development

### Build Commands

```bash
# Build JavaScript bundle
npm run build

# Copy CSS
npm run build:css

# Build everything
npm run build:all

# Watch mode (auto-rebuild on changes)
npm run watch
```

### Component Structure

```
src/
├── component.tsx   # Main component
└── styles.css      # Stylesheet
```

## Usage

### Basic Component

```typescript
function App() {
  const toolOutput = useToolOutput();
  const theme = useTheme();
  
  return (
    <div className={theme}>
      <h1>My App</h1>
      {toolOutput?.items?.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

### Hooks Available

```typescript
// Data hooks
useToolInput()              // Tool arguments
useToolOutput()             // Structured content
useToolResponseMetadata()   // Tool _meta field

// UI hooks
useTheme()                  // "light" | "dark"
useDisplayMode()            // "inline" | "pip" | "fullscreen"
useUserAgent()              // Device info

// State hook
useWidgetState(defaultState) // Persistent state
```

### Calling Tools

```typescript
async function handleRefresh() {
  await window.openai.callTool("refresh_data", {
    filter: "recent"
  });
}
```

### Navigation

```typescript
import { useNavigate } from "react-router-dom";

function Component() {
  const navigate = useNavigate();
  
  return (
    <button onClick={() => navigate("/details/123")}>
      View Details
    </button>
  );
}
```

### Widget State

```typescript
const [widgetState, setWidgetState] = useWidgetState({
  favorites: []
});

// Update state (persists across sessions)
setWidgetState({
  favorites: [...widgetState.favorites, newId]
});
```

## Customization

### Styling

Edit `src/styles.css` to customize appearance. The template includes:
- Theme variables (light/dark)
- Responsive breakpoints
- Accessibility features
- Smooth transitions

### Adding Routes

```typescript
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/details/:id" element={<Details />} />
  </Routes>
</BrowserRouter>
```

### Adding Dependencies

```bash
npm install <package-name>
```

Then import in your component:

```typescript
import Something from "package-name";
```

## Best Practices

### Performance

- Minimize bundle size (only import what you need)
- Use React.memo for expensive components
- Debounce `setWidgetState` calls
- Lazy load heavy components

### Accessibility

- Use semantic HTML
- Add ARIA labels
- Support keyboard navigation
- Test with screen readers

### Error Handling

```typescript
try {
  await window.openai.callTool("my_tool", args);
} catch (error) {
  console.error("Tool call failed:", error);
  // Show error to user
}
```

## Troubleshooting

### Build Errors

- Ensure all dependencies are installed: `npm install`
- Check TypeScript errors: `npx tsc --noEmit`
- Clear node_modules and reinstall if needed

### Runtime Errors

- Check browser console for errors
- Verify `window.openai` is available
- Ensure tool is marked as `widgetAccessible`

### Styling Issues

- Verify CSS is included in HTML
- Check theme class is applied
- Test in both light and dark modes
