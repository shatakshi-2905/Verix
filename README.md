# VERIX — Full Stack

VERIX is a source-grounded content transformation platform: one source document can be analyzed, protected with PII detection, transformed into multiple audience-specific formats, verified against the source, reviewed by a human, audited, and exported.

## Architecture

```text
React + Vite + existing VERIX UI
                │
                ▼
             FastAPI
                │
          ┌─────┴─────┐
          ▼           ▼
      LangGraph     Supabase
          │        PostgreSQL
     ┌────┼────┐       │
     ▼    ▼    ▼       ▼
 Presidio Bedrock  PGVector
          │
      Nova Pro
      Nova Lite
      Nova Micro
      Titan Embeddings V2
                │
                ▼
              S3
```

### Stack

- **Frontend:** React + Vite + the existing VERIX component/UI system
- **Routing:** TanStack Router (client-side only; no TanStack Start)
- **Backend:** FastAPI
- **Auth:** Supabase Auth, with FastAPI validating Supabase access tokens
- **Database:** Supabase PostgreSQL
- **Vector DB:** Supabase `pgvector`
- **Object storage:** Amazon S3
- **Workflow orchestration:** LangGraph
- **PII detection/masking:** Microsoft Presidio
- **LLM:** AWS Bedrock
  - Nova Pro for primary content generation
  - Nova Lite for analysis/verification
  - Nova Micro available for inexpensive future tasks
  - Titan Text Embeddings V2 for vectors
- **Queues:** none — intentionally synchronous for the current version
- **Audit:** dedicated `audit_logs` table with per-user/run traceability

## Important security behavior

1. Source documents are uploaded to S3 from FastAPI, not directly with AWS credentials in the browser.
2. The service-role Supabase key is backend-only.
3. PII detection happens server-side with Presidio.
4. The protected working copy is what enters the generation workflow.
5. Raw PII values are not returned to the frontend or written to audit logs.
6. Audit records store actions, IDs, model/workflow metadata and counts — not source text or prompts.
7. Bedrock calls happen only from FastAPI.
8. Each transformation run receives a `run_id`, allowing the audit trail to connect PII detection, retrieval, generation and verification.

## 1. Supabase setup

Open **Supabase → SQL Editor** and run:

```text
database/verix_supabase.sql
```

The same SQL is also available at:

```text
backend/sql/schema.sql
```

Then copy the project URL, anon key and service-role key into `backend/.env`.

### Storage

Create an S3 bucket, for example:

```text
verix-documents
```

The backend stores uploaded files under:

```text
users/<supabase-user-id>/documents/<uuid>-<filename>
```

Give the AWS identity used by FastAPI permission to upload/read objects in that bucket.

## 2. AWS Bedrock

Enable access to the Bedrock models in the AWS region in `backend/.env`.

Defaults:

```text
BEDROCK_MAIN_MODEL=amazon.nova-pro-v1:0
BEDROCK_FAST_MODEL=amazon.nova-lite-v1:0
BEDROCK_MICRO_MODEL=amazon.nova-micro-v1:0
BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0
```

The AWS identity needs Bedrock runtime permissions for these models and S3 permissions for the configured bucket.

## 3. Presidio setup

Presidio is free/open-source for this use. The backend uses:

- `presidio-analyzer`
- `presidio-anonymizer`
- spaCy

After installing backend requirements, install the English spaCy model:

```bash
python -m spacy download en_core_web_sm
```

Presidio also has custom VERIX recognizers for patterns such as employee IDs, account numbers and internal project identifiers.

## 4. Backend local setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
cp .env.example .env
# fill in .env
uvicorn app.main:app --reload --port 8000
```

Health check:

```text
http://localhost:8000/health
```

## 5. Frontend local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Default frontend:

```text
http://localhost:5173
```

Default API:

```text
http://localhost:8000
```

## Environment variables

### Frontend `.env`

```env
VITE_API_URL=http://localhost:8000
```

### Backend `.env`

```env
APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8000
FRONTEND_ORIGIN=http://localhost:5173

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
S3_BUCKET=verix-documents

BEDROCK_MAIN_MODEL=amazon.nova-pro-v1:0
BEDROCK_FAST_MODEL=amazon.nova-lite-v1:0
BEDROCK_MICRO_MODEL=amazon.nova-micro-v1:0
BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0

MAX_SOURCE_CHARS=50000
MAX_OUTPUT_TOKENS=5000
```

Never commit either `.env` file.

## Workflow

The generation path is now a LangGraph workflow:

```text
TRANSFORMATION_STARTED
        ↓
Presidio PII detection + protection
        ↓
PGVector source retrieval
        ↓
Bedrock Nova Pro generation
        ↓
Bedrock Nova Lite source verification
        ↓
Human review / approval
        ↓
Audit trail
```

No Redis, Celery or other queue is required for this version.

## UI

The existing VERIX UI is intentionally preserved. The migration replaces the Lovable/TanStack Start runtime with a normal Vite client build without redesigning the visual system, components, colors, typography, navigation or workflow screens.

## Suggested free/fast deployment later

The project is intentionally local-first. When you're ready, the frontend and FastAPI service can be deployed separately on a free/low-cost web host, while Supabase, S3 and Bedrock remain managed services.
