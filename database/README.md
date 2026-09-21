# VERIX database setup

Run `verix_supabase.sql` in the Supabase SQL Editor.

It creates:

- `profiles`
- `documents`
- `document_chunks` with `vector(1024)` for Amazon Titan Text Embeddings V2
- `transformations`
- `outputs`
- `audit_logs`
- `match_document_chunks()` RPC
- Row Level Security policies
- a trigger that creates a profile when a Supabase Auth user signs up

The FastAPI application uses the Supabase service-role key server-side, while the browser only receives the normal Supabase auth session tokens.
