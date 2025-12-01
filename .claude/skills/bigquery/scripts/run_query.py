#!/usr/bin/env python3
"""
BigQuery query execution script.
Executes a SQL query and returns results in a specified format.
"""

import sys
import json
import argparse
from google.cloud import bigquery
from google.oauth2 import service_account


def run_query(
    query: str,
    project_id: str = None,
    credentials_path: str = None,
    output_format: str = "json",
    max_results: int = 1000
):
    """
    Execute a BigQuery SQL query and return results.
    
    Args:
        query: SQL query string
        project_id: GCP project ID (optional if set in credentials)
        credentials_path: Path to service account JSON (optional, uses default auth if not provided)
        output_format: Output format - 'json', 'csv', or 'table'
        max_results: Maximum number of results to return
        
    Returns:
        Query results in the specified format
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
        
        # Execute query
        query_job = client.query(query)
        results = query_job.result(max_results=max_results)
        
        # Convert to list of dictionaries
        rows = []
        for row in results:
            rows.append(dict(row))
        
        # Format output
        if output_format == "json":
            output = json.dumps(rows, indent=2, default=str)
        elif output_format == "csv":
            if rows:
                import csv
                import io
                output_buffer = io.StringIO()
                writer = csv.DictWriter(output_buffer, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
                output = output_buffer.getvalue()
            else:
                output = ""
        elif output_format == "table":
            if rows:
                # Simple table format
                headers = list(rows[0].keys())
                output = " | ".join(headers) + "\n"
                output += "-" * len(output) + "\n"
                for row in rows:
                    output += " | ".join(str(row[h]) for h in headers) + "\n"
            else:
                output = "No results"
        else:
            output = json.dumps(rows, indent=2, default=str)
        
        # Print metadata
        print(f"Query completed successfully.", file=sys.stderr)
        print(f"Total rows: {results.total_rows}", file=sys.stderr)
        print(f"Bytes processed: {query_job.total_bytes_processed:,}", file=sys.stderr)
        
        return output
        
    except Exception as e:
        print(f"Error executing query: {str(e)}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Execute BigQuery SQL query")
    parser.add_argument("query", help="SQL query string or path to .sql file")
    parser.add_argument("--project-id", help="GCP project ID")
    parser.add_argument("--credentials", help="Path to service account JSON file")
    parser.add_argument(
        "--format",
        choices=["json", "csv", "table"],
        default="json",
        help="Output format (default: json)"
    )
    parser.add_argument(
        "--max-results",
        type=int,
        default=1000,
        help="Maximum number of results (default: 1000)"
    )
    
    args = parser.parse_args()
    
    # Check if query is a file path
    query = args.query
    if query.endswith(".sql"):
        try:
            with open(query, "r") as f:
                query = f.read()
        except FileNotFoundError:
            print(f"Error: SQL file not found: {query}", file=sys.stderr)
            sys.exit(1)
    
    # Run query
    result = run_query(
        query=query,
        project_id=args.project_id,
        credentials_path=args.credentials,
        output_format=args.format,
        max_results=args.max_results
    )
    
    print(result)


if __name__ == "__main__":
    main()
