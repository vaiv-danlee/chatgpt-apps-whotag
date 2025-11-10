#!/usr/bin/env python3
"""
Validate MCP tool definitions for ChatGPT Apps SDK.

Usage:
    python validate_tool.py <tool-definition.json>
    
Tool definition format:
{
    "name": "tool_name",
    "title": "Tool Title",
    "description": "Tool description",
    "inputSchema": { ... },
    "_meta": { ... }
}
"""

import json
import sys
import re
from pathlib import Path
from typing import Dict, List, Any, Optional

class ToolValidator:
    """Validator for MCP tool definitions."""
    
    REQUIRED_FIELDS = ["name", "title", "description", "inputSchema"]
    RECOMMENDED_META_FIELDS = [
        "openai/outputTemplate",
        "openai/toolInvocation/invoking",
        "openai/toolInvocation/invoked"
    ]
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
    
    def validate(self, tool_def: Dict[str, Any]) -> bool:
        """Validate tool definition. Returns True if valid."""
        self.errors = []
        self.warnings = []
        
        self._validate_required_fields(tool_def)
        self._validate_name(tool_def.get("name"))
        self._validate_title(tool_def.get("title"))
        self._validate_description(tool_def.get("description"))
        self._validate_input_schema(tool_def.get("inputSchema"))
        self._validate_meta(tool_def.get("_meta", {}))
        self._validate_security_schemes(tool_def.get("securitySchemes"))
        
        return len(self.errors) == 0
    
    def _validate_required_fields(self, tool_def: Dict[str, Any]):
        """Check all required fields are present."""
        for field in self.REQUIRED_FIELDS:
            if field not in tool_def:
                self.errors.append(f"Missing required field: {field}")
    
    def _validate_name(self, name: Optional[str]):
        """Validate tool name."""
        if not name:
            return
        
        # Check format (snake_case, alphanumeric + underscore)
        if not re.match(r'^[a-z][a-z0-9_]*$', name):
            self.errors.append(
                f"Tool name '{name}' must be snake_case (lowercase, alphanumeric, underscores)"
            )
        
        # Check length
        if len(name) > 64:
            self.errors.append(f"Tool name '{name}' is too long (max 64 characters)")
        
        # Check descriptiveness
        if len(name) < 3:
            self.warnings.append(f"Tool name '{name}' is very short, consider being more descriptive")
    
    def _validate_title(self, title: Optional[str]):
        """Validate tool title."""
        if not title:
            return
        
        # Check length
        if len(title) > 100:
            self.warnings.append(f"Tool title is long ({len(title)} chars), consider keeping under 100")
        
        if len(title) < 5:
            self.warnings.append("Tool title is very short, consider being more descriptive")
    
    def _validate_description(self, description: Optional[str]):
        """Validate tool description."""
        if not description:
            return
        
        # Check if action-oriented
        action_words = ["get", "fetch", "create", "update", "delete", "search", "find", 
                       "list", "show", "display", "calculate", "analyze", "generate"]
        
        first_word = description.lower().split()[0] if description else ""
        if first_word not in action_words:
            self.warnings.append(
                "Description should be action-oriented (start with verbs like 'Get', 'Create', etc.)"
            )
        
        # Check length
        if len(description) > 500:
            self.warnings.append(
                f"Description is long ({len(description)} chars), consider keeping under 500"
            )
        
        if len(description) < 20:
            self.warnings.append(
                "Description is short, consider adding more detail about when to use this tool"
            )
    
    def _validate_input_schema(self, schema: Optional[Dict[str, Any]]):
        """Validate JSON Schema."""
        if not schema:
            return
        
        if not isinstance(schema, dict):
            self.errors.append("inputSchema must be an object")
            return
        
        # Check it's a valid JSON Schema structure
        if schema.get("type") != "object":
            self.warnings.append("inputSchema should have type: 'object'")
        
        # Check properties are documented
        properties = schema.get("properties", {})
        for prop_name, prop_schema in properties.items():
            if "description" not in prop_schema:
                self.warnings.append(
                    f"Parameter '{prop_name}' is missing a description"
                )
        
        # Check required fields exist
        required = schema.get("required", [])
        for req_field in required:
            if req_field not in properties:
                self.errors.append(
                    f"Required field '{req_field}' not defined in properties"
                )
    
    def _validate_meta(self, meta: Dict[str, Any]):
        """Validate _meta field."""
        if not meta:
            self.warnings.append(
                "No _meta field found. Consider adding metadata for better UX"
            )
            return
        
        # Check for recommended fields
        for field in self.RECOMMENDED_META_FIELDS:
            if field not in meta:
                self.warnings.append(f"Recommended _meta field missing: {field}")
        
        # Validate outputTemplate
        template = meta.get("openai/outputTemplate")
        if template:
            if not template.startswith("ui://"):
                self.errors.append(
                    f"outputTemplate '{template}' must start with 'ui://'"
                )
        
        # Validate status strings
        invoking = meta.get("openai/toolInvocation/invoking")
        if invoking and len(invoking) > 64:
            self.warnings.append(
                f"invoking status is long ({len(invoking)} chars), keep under 64"
            )
        
        invoked = meta.get("openai/toolInvocation/invoked")
        if invoked and len(invoked) > 64:
            self.warnings.append(
                f"invoked status is long ({len(invoked)} chars), keep under 64"
            )
        
        # Check widgetAccessible
        if "openai/widgetAccessible" in meta:
            if not isinstance(meta["openai/widgetAccessible"], bool):
                self.errors.append("openai/widgetAccessible must be boolean")
    
    def _validate_security_schemes(self, schemes: Optional[List[Dict[str, Any]]]):
        """Validate security schemes."""
        if not schemes:
            self.warnings.append(
                "No securitySchemes defined. Consider specifying auth requirements"
            )
            return
        
        if not isinstance(schemes, list):
            self.errors.append("securitySchemes must be an array")
            return
        
        for scheme in schemes:
            if "type" not in scheme:
                self.errors.append("Security scheme missing 'type' field")
                continue
            
            scheme_type = scheme["type"]
            if scheme_type not in ["noauth", "oauth2"]:
                self.errors.append(
                    f"Invalid security scheme type: {scheme_type} (must be 'noauth' or 'oauth2')"
                )
            
            if scheme_type == "oauth2":
                if "scopes" in scheme and not isinstance(scheme["scopes"], list):
                    self.errors.append("OAuth2 scopes must be an array")
    
    def print_results(self):
        """Print validation results."""
        if self.errors:
            print("❌ ERRORS:")
            for error in self.errors:
                print(f"  - {error}")
            print()
        
        if self.warnings:
            print("⚠️  WARNINGS:")
            for warning in self.warnings:
                print(f"  - {warning}")
            print()
        
        if not self.errors and not self.warnings:
            print("✅ Tool definition is valid!")
        elif not self.errors:
            print("✅ Tool definition is valid (with warnings)")
        else:
            print("❌ Tool definition has errors")

def load_tool_definition(filepath: str) -> Optional[Dict[str, Any]]:
    """Load tool definition from JSON file."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found: {filepath}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON: {e}")
        return None

def main():
    if len(sys.argv) != 2:
        print("Usage: python validate_tool.py <tool-definition.json>")
        sys.exit(1)
    
    filepath = sys.argv[1]
    
    # Load tool definition
    tool_def = load_tool_definition(filepath)
    if tool_def is None:
        sys.exit(1)
    
    # Validate
    validator = ToolValidator()
    is_valid = validator.validate(tool_def)
    
    # Print results
    print(f"Validating: {filepath}")
    print()
    validator.print_results()
    
    # Exit with appropriate code
    sys.exit(0 if is_valid else 1)

if __name__ == "__main__":
    main()
