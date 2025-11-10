#!/usr/bin/env python3
"""
Initialize a new MCP server project for ChatGPT Apps SDK.

Usage:
    python init_mcp_server.py <project-name> [--language=python|typescript]
"""

import os
import sys
import argparse
from pathlib import Path

PYTHON_SERVER_TEMPLATE = '''from mcp.server.fastmcp import FastMCP
from mcp.server.auth.settings import AuthSettings
from mcp.server.auth.provider import TokenVerifier, AccessToken
import json

# Create MCP server
mcp = FastMCP(
    name="{project_name}",
    version="1.0.0",
    stateless_http=True
)

# Register UI resource
@mcp.resource("ui://widget/component.html")
async def get_component():
    """Serve the React component."""
    with open("web/dist/component.js", "r") as f:
        component_js = f.read()
    
    try:
        with open("web/dist/component.css", "r") as f:
            component_css = f.read()
    except FileNotFoundError:
        component_css = ""
    
    html = f"""
<div id="root"></div>
{f'<style>{component_css}</style>' if component_css else ''}
<script type="module">{component_js}</script>
    """.strip()
    
    return {{
        "contents": [{{
            "uri": "ui://widget/component.html",
            "mimeType": "text/html+skybridge",
            "text": html,
            "_meta": {{
                "openai/widgetPrefersBorder": True,
                "openai/widgetDomain": "https://chatgpt.com",
                "openai/widgetCSP": {{
                    "connect_domains": [],
                    "resource_domains": ["https://*.oaistatic.com"]
                }}
            }}
        }}]
    }}

# Register a sample tool
@mcp.tool()
async def get_data(query: str) -> dict:
    """
    Fetch data based on user query.
    
    Args:
        query: Search query
    
    Returns:
        Structured data and component metadata
    """
    # TODO: Implement your data fetching logic
    results = [
        {{"id": "1", "title": "Sample Item 1"}},
        {{"id": "2", "title": "Sample Item 2"}}
    ]
    
    return {{
        "content": [{{
            "type": "text",
            "text": f"Found {{len(results)}} results for '{{query}}'"
        }}],
        "structuredContent": {{
            "results": results
        }},
        "_meta": {{
            "timestamp": "2025-01-01T00:00:00Z"
        }}
    }}

# Configure tool metadata
mcp.tool_metadata["get_data"] = {{
    "title": "Get Data",
    "description": "Fetch data based on user query",
    "_meta": {{
        "openai/outputTemplate": "ui://widget/component.html",
        "openai/toolInvocation/invoking": "Fetching data...",
        "openai/toolInvocation/invoked": "Data loaded"
    }}
}}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(mcp.app, host="0.0.0.0", port=3000)
'''

TYPESCRIPT_SERVER_TEMPLATE = '''import {{ McpServer }} from "@modelcontextprotocol/sdk/server/mcp.js";
import {{ readFileSync }} from "node:fs";
import {{ z }} from "zod";

const server = new McpServer({{
  name: "{project_name}",
  version: "1.0.0"
}});

// Load component assets
const COMPONENT_JS = readFileSync("web/dist/component.js", "utf8");
let COMPONENT_CSS = "";
try {{
  COMPONENT_CSS = readFileSync("web/dist/component.css", "utf8");
}} catch {{
  // CSS is optional
}}

// Register UI resource
server.registerResource(
  "widget",
  "ui://widget/component.html",
  {{}},
  async () => ({{
    contents: [{{
      uri: "ui://widget/component.html",
      mimeType: "text/html+skybridge",
      text: `
<div id="root"></div>
${{COMPONENT_CSS ? `<style>${{COMPONENT_CSS}}</style>` : ""}}
<script type="module">${{COMPONENT_JS}}</script>
      `.trim(),
      _meta: {{
        "openai/widgetPrefersBorder": true,
        "openai/widgetDomain": "https://chatgpt.com",
        "openai/widgetCSP": {{
          connect_domains: [],
          resource_domains: ["https://*.oaistatic.com"]
        }}
      }}
    }}]
  }})
);

// Register sample tool
server.registerTool(
  "get_data",
  {{
    title: "Get Data",
    description: "Fetch data based on user query",
    inputSchema: {{
      type: "object",
      properties: {{
        query: {{ type: "string" }}
      }},
      required: ["query"]
    }},
    _meta: {{
      "openai/outputTemplate": "ui://widget/component.html",
      "openai/toolInvocation/invoking": "Fetching data...",
      "openai/toolInvocation/invoked": "Data loaded"
    }}
  }},
  async ({{ query }}) => {{
    // TODO: Implement your data fetching logic
    const results = [
      {{ id: "1", title: "Sample Item 1" }},
      {{ id: "2", title: "Sample Item 2" }}
    ];
    
    return {{
      content: [{{
        type: "text",
        text: `Found ${{results.length}} results for '${{query}}'`
      }}],
      structuredContent: {{
        results
      }},
      _meta: {{
        timestamp: new Date().toISOString()
      }}
    }};
  }}
);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT);
console.log(`MCP server running on http://localhost:${{PORT}}/mcp`);
'''

PACKAGE_JSON_TEMPLATE = '''{
  "name": "{project_name}",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
'''

REQUIREMENTS_TXT = '''mcp>=0.1.0
fastapi>=0.104.0
uvicorn>=0.24.0
pyjwt>=2.8.0
'''

README_TEMPLATE = '''# {project_name}

ChatGPT Apps SDK MCP Server

## Setup

### Install Dependencies

{"Python:" if language == "python" else "Node.js:"}
```bash
{"pip install -r requirements.txt --break-system-packages" if language == "python" else "npm install"}
```

### Build Component

```bash
cd web
npm install
npm run build
cd ..
```

### Run Server

```bash
{"python server.py" if language == "python" else "npm start"}
```

Server will be available at `http://localhost:3000/mcp`

## Testing Locally

Use ngrok to expose local server:

```bash
ngrok http 3000
```

Then configure ChatGPT with the ngrok URL.

## Project Structure

```
{project_name}/
├── server.{"py" if language == "python" else "js"}        # MCP server
├── {"requirements.txt" if language == "python" else "package.json"}
└── web/               # React component
    ├── src/
    │   └── component.tsx
    ├── package.json
    └── dist/          # Build output
```
'''

def create_project(project_name: str, language: str = "typescript"):
    """Create a new MCP server project."""
    
    print(f"Creating {language} MCP server: {project_name}")
    
    # Create project directory
    project_dir = Path(project_name)
    project_dir.mkdir(exist_ok=True)
    
    # Create server file
    if language == "python":
        server_file = project_dir / "server.py"
        server_file.write_text(PYTHON_SERVER_TEMPLATE.format(project_name=project_name))
        
        # Create requirements.txt
        req_file = project_dir / "requirements.txt"
        req_file.write_text(REQUIREMENTS_TXT)
    else:
        server_file = project_dir / "server.js"
        server_file.write_text(TYPESCRIPT_SERVER_TEMPLATE.format(project_name=project_name))
        
        # Create package.json
        package_file = project_dir / "package.json"
        package_file.write_text(PACKAGE_JSON_TEMPLATE.format(project_name=project_name))
    
    # Create web directory structure
    web_dir = project_dir / "web"
    web_dir.mkdir(exist_ok=True)
    
    src_dir = web_dir / "src"
    src_dir.mkdir(exist_ok=True)
    
    dist_dir = web_dir / "dist"
    dist_dir.mkdir(exist_ok=True)
    
    # Create README
    readme = project_dir / "README.md"
    readme.write_text(README_TEMPLATE.format(
        project_name=project_name,
        language=language
    ))
    
    print(f"✅ Created {project_name}/")
    print(f"✅ Created server.{'py' if language == 'python' else 'js'}")
    print(f"✅ Created {'requirements.txt' if language == 'python' else 'package.json'}")
    print(f"✅ Created web/ directory")
    print(f"✅ Created README.md")
    print()
    print("Next steps:")
    print(f"1. cd {project_name}")
    print(f"2. {'pip install -r requirements.txt --break-system-packages' if language == 'python' else 'npm install'}")
    print("3. Create React component in web/src/component.tsx")
    print("4. Build component: cd web && npm run build")
    print(f"5. Run server: {'python server.py' if language == 'python' else 'npm start'}")

def main():
    parser = argparse.ArgumentParser(
        description="Initialize a new MCP server for ChatGPT Apps SDK"
    )
    parser.add_argument(
        "project_name",
        help="Name of the project"
    )
    parser.add_argument(
        "--language",
        choices=["python", "typescript"],
        default="typescript",
        help="Server language (default: typescript)"
    )
    
    args = parser.parse_args()
    
    create_project(args.project_name, args.language)

if __name__ == "__main__":
    main()
'''
