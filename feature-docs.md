# New Feature Documentation

This document outlines the usage of newly added features: S3 file uploads for RAG, Agentforce integration for key people identification, stakeholder mapping, and Slack user search.

## 1. S3 File Upload for RAG

Uploads one or more PDF files to the configured S3 bucket (`dealwhisperer`) for Retrieval-Augmented Generation (RAG) context.

- **Endpoint**: `/files/upload-rag`
- **Method**: `POST`
- **Request Type**: `multipart/form-data`
- **Form Field**: `files` (can contain multiple files)
- **Response Format**: JSON

### Example Usage (`curl`)

```bash
curl -X POST http://localhost:3000/files/upload-rag \
  -F "files=@/path/to/your/document1.pdf" \
  -F "files=@/path/to/another/document2.pdf"
```

### Example Success Response (200 OK)

```json
{
  "message": "Successfully uploaded 2 PDF file(s) for RAG.",
  "uploadedFiles": [
    {
      "key": "uuid-abc-document1.pdf",
      "url": "https://dealwhisperer.s3.us-east-1.amazonaws.com/uuid-abc-document1.pdf"
    },
    {
      "key": "uuid-def-document2.pdf",
      "url": "https://dealwhisperer.s3.us-east-1.amazonaws.com/uuid-def-document2.pdf"
    }
  ]
}
```

### Example Error Response (400 Bad Request - No Files)

```json
{
  "statusCode": 400,
  "message": "No files uploaded."
}
```

### Notes
- Only files with the MIME type `application/pdf` will be processed. Other file types will be skipped.
- Uploaded file keys are generated with a UUID prefix to ensure uniqueness.

## 2. Get Key People via Agentforce

Invokes the configured `GetKeyPeople` Agentforce agent to identify key individuals based on provided context (e.g., deal ID, S3 keys of uploaded documents).

- **Endpoint**: `/agent/get-key-people`
- **Method**: `POST`
- **Request Body Format**: JSON
- **Response Format**: JSON containing the raw string result from the agent.

### Example Request Body

```json
{
  "dealId": "DEAL12345",
  "s3Keys": [
    "uuid-abc-document1.pdf",
    "uuid-def-document2.pdf"
  ],
  "otherInfo": "Initial discovery call notes mentioned the CTO."
}
```

### Example Success Response (200 OK)

```json
{
  "result": "Based on the provided documents and notes, the key people identified are: John Doe (CEO), Jane Smith (CTO), Robert Johnson (Account Manager)."
}
```

### Example Error Response (500 Internal Server Error)

```json
{
  "statusCode": 500,
  "message": "Failed to retrieve key people from agent: <Specific error message from Agentforce or service>"
}
```

### Notes
- The `GET_KEY_PEOPLE_AGENT_ID` environment variable must be set correctly.
- The context provided in the request body is used to construct the prompt for the agent.

## 3. Assign Stakeholder Mappings

Adds or updates stakeholder role-to-Slack ID mappings in the database. This replaces the previously hardcoded mapping.

- **Endpoint**: `/deals/stakeholders/assign`
- **Method**: `POST`
- **Request Body Format**: JSON (Array of mappings)
- **Response Format**: JSON

### Example Request Body

```json
{
  "mappings": [
    {
      "role": "PM",
      "slack_user_id": "U123NEWPM",
      "full_name": "Alice Wonderland"
    },
    {
      "role": "SalesRep1",
      "slack_user_id": "U456SR1ID"
    },
    {
      "role": "Legal",
      "slack_user_id": "U987LEGAL",
      "full_name": "Bob The Builder"
    }
  ]
}
```

### Example Success Response (200 OK)

```json
{
  "message": "Stakeholder mappings updated successfully."
}
```

### Example Error Response (400 Bad Request - Invalid Input)

```json
{
  "statusCode": 400,
  "message": [
    "mappings.0.role should not be empty",
    "mappings.1.slack_user_id should not be empty"
  ],
  "error": "Bad Request"
}
```

### Notes
- This uses an `upsert` operation based on the `role` field (Primary Key). If a role exists, its `slack_user_id` and `full_name` will be updated. If it doesn't exist, a new mapping will be created.
- The `GET /deals/stakeholders` endpoint now dynamically reads from this `stakeholder_mapping` table.

## 4. Search Slack Users by Name

Searches for active Slack users in the workspace whose real name or display name contains the provided query string.

- **Endpoint**: `/slack/search-user`
- **Method**: `GET`
- **Query Parameter**: `name` (string)
- **Response Format**: JSON

### Example Usage (`curl`)

```bash
curl "http://localhost:3000/slack/search-user?name=Alice"
```

### Example Success Response (200 OK)

```json
{
  "users": [
    {
      "id": "U123NEWPM",
      "name": "Alice Wonderland"
    },
    {
      "id": "UABCDEFGH",
      "name": "Alice B. Toklas"
    }
  ]
}
```

### Example Error Response (400 Bad Request - Missing Query Param)

```json
{
  "statusCode": 400,
  "message": "Missing required query parameter: name"
}
```

### Notes
- The search is case-insensitive.
- **Performance Warning**: This endpoint currently fetches the *entire* user list from Slack and filters it locally. This can be slow and potentially hit rate limits on very large workspaces. Consider this limitation during usage.
- Bots and deleted users are excluded from the results. 