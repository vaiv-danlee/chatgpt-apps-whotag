# BigQuery Setup and Authentication

Guide for setting up BigQuery authentication and configuration.

## Authentication Methods

### 1. Application Default Credentials (Recommended for Development)

Set up application default credentials:

```bash
gcloud auth application-default login
```

This creates credentials at:
- Linux/Mac: `~/.config/gcloud/application_default_credentials.json`
- Windows: `%APPDATA%\gcloud\application_default_credentials.json`

### 2. Service Account (Recommended for Production)

Create and download a service account key:

1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Create a service account or select existing one
3. Add role: `BigQuery User` or `BigQuery Admin`
4. Create and download JSON key
5. Set environment variable:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### 3. Using gcloud CLI

Authenticate with gcloud:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

## Python Client Setup

### Installation

```bash
pip install google-cloud-bigquery --break-system-packages
```

### Basic Usage

```python
from google.cloud import bigquery

# Using default credentials
client = bigquery.Client()

# Using specific project
client = bigquery.Client(project='your-project-id')

# Using service account
from google.oauth2 import service_account

credentials = service_account.Credentials.from_service_account_file(
    '/path/to/service-account-key.json'
)
client = bigquery.Client(credentials=credentials, project='your-project-id')
```

## Environment Variables

Common environment variables:

```bash
# Service account credentials
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"

# Default project
export GOOGLE_CLOUD_PROJECT="your-project-id"

# BigQuery location (optional)
export BIGQUERY_LOCATION="US"
```

## Required IAM Roles

Minimum roles needed:

- **Query execution**: `roles/bigquery.user`
- **Read data**: `roles/bigquery.dataViewer`
- **Write data**: `roles/bigquery.dataEditor`
- **Manage tables**: `roles/bigquery.admin`

## Common Issues

### Authentication Error

```
Error: Could not automatically determine credentials
```

**Solution**: Set up one of the authentication methods above.

### Permission Denied

```
Error: Access Denied: Project [PROJECT_ID]: User does not have permission
```

**Solution**: Ensure your account/service account has the required BigQuery roles.

### Project Not Set

```
Error: Project ID must be provided
```

**Solution**: Set project explicitly in code or via:
```bash
gcloud config set project YOUR_PROJECT_ID
```

## Testing Connection

Test your setup:

```python
from google.cloud import bigquery

client = bigquery.Client()
query = "SELECT 1 as test"
result = client.query(query).result()

for row in result:
    print(f"Connection successful! Test value: {row.test}")
```

Or via command line:

```bash
bq query --use_legacy_sql=false 'SELECT 1 as test'
```
