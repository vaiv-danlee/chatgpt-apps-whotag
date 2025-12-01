#!/usr/bin/env python3
"""
BigQuery schema inspection script.
Retrieves and displays table schema information.
"""

import sys
import json
import argparse
from google.cloud import bigquery
from google.oauth2 import service_account


def get_table_schema(
    dataset_id: str,
    table_id: str,
    project_id: str = None,
    credentials_path: str = None,
    output_format: str = "json"
):
    """
    Retrieve schema information for a BigQuery table.
    
    Args:
        dataset_id: Dataset ID
        table_id: Table ID
        project_id: GCP project ID
        credentials_path: Path to service account JSON
        output_format: Output format - 'json' or 'markdown'
        
    Returns:
        Table schema in the specified format
    """
    try:
        # Initialize client
        if credentials_path:
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path
            )
            client = bigquery.Client(credentials=credentials, project=project_id)
        else:
            client = bigquery.Client(project=project_id)
        
        # Get table reference
        table_ref = f"{project_id}.{dataset_id}.{table_id}"
        table = client.get_table(table_ref)
        
        # Extract schema information
        schema_info = {
            "table": table_ref,
            "description": table.description or "",
            "num_rows": table.num_rows,
            "num_bytes": table.num_bytes,
            "created": str(table.created),
            "modified": str(table.modified),
            "fields": []
        }
        
        for field in table.schema:
            field_info = {
                "name": field.name,
                "type": field.field_type,
                "mode": field.mode,
                "description": field.description or ""
            }
            schema_info["fields"].append(field_info)
        
        # Format output
        if output_format == "json":
            output = json.dumps(schema_info, indent=2)
        elif output_format == "markdown":
            output = f"# Table: {table_ref}\n\n"
            if schema_info["description"]:
                output += f"{schema_info['description']}\n\n"
            output += f"**Rows:** {schema_info['num_rows']:,} | "
            output += f"**Size:** {schema_info['num_bytes']:,} bytes\n\n"
            output += "## Fields\n\n"
            output += "| Name | Type | Mode | Description |\n"
            output += "|------|------|------|-------------|\n"
            for field in schema_info["fields"]:
                output += f"| {field['name']} | {field['type']} | {field['mode']} | {field['description']} |\n"
        else:
            output = json.dumps(schema_info, indent=2)
        
        return output
        
    except Exception as e:
        print(f"Error retrieving schema: {str(e)}", file=sys.stderr)
        sys.exit(1)


def list_tables(
    dataset_id: str,
    project_id: str = None,
    credentials_path: str = None
):
    """
    List all tables in a dataset.
    
    Args:
        dataset_id: Dataset ID
        project_id: GCP project ID
        credentials_path: Path to service account JSON
        
    Returns:
        List of table IDs
    """
    try:
        # Initialize client
        if credentials_path:
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path
            )
            client = bigquery.Client(credentials=credentials, project=project_id)
        else:
            client = bigquery.Client(project=project_id)
        
        # List tables
        dataset_ref = f"{project_id}.{dataset_id}"
        tables = client.list_tables(dataset_ref)
        
        table_list = []
        for table in tables:
            table_list.append({
                "table_id": table.table_id,
                "full_table_id": f"{table.project}.{table.dataset_id}.{table.table_id}",
                "table_type": table.table_type
            })
        
        return json.dumps(table_list, indent=2)
        
    except Exception as e:
        print(f"Error listing tables: {str(e)}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Inspect BigQuery table schemas")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Schema command
    schema_parser = subparsers.add_parser("schema", help="Get table schema")
    schema_parser.add_argument("dataset", help="Dataset ID")
    schema_parser.add_argument("table", help="Table ID")
    schema_parser.add_argument("--project-id", help="GCP project ID")
    schema_parser.add_argument("--credentials", help="Path to service account JSON")
    schema_parser.add_argument(
        "--format",
        choices=["json", "markdown"],
        default="json",
        help="Output format"
    )
    
    # List command
    list_parser = subparsers.add_parser("list", help="List tables in dataset")
    list_parser.add_argument("dataset", help="Dataset ID")
    list_parser.add_argument("--project-id", help="GCP project ID")
    list_parser.add_argument("--credentials", help="Path to service account JSON")
    
    args = parser.parse_args()
    
    if args.command == "schema":
        result = get_table_schema(
            dataset_id=args.dataset,
            table_id=args.table,
            project_id=args.project_id,
            credentials_path=args.credentials,
            output_format=args.format
        )
    elif args.command == "list":
        result = list_tables(
            dataset_id=args.dataset,
            project_id=args.project_id,
            credentials_path=args.credentials
        )
    else:
        parser.print_help()
        sys.exit(1)
    
    print(result)


if __name__ == "__main__":
    main()
