# VERIX setup checklist

- [ ] Create Supabase project.
- [ ] Run `database/verix_supabase.sql` in Supabase SQL Editor.
- [ ] Create S3 bucket.
- [ ] Attach `infra/aws/verix-iam-policy.json` to the AWS identity used by FastAPI, replacing `YOUR_VERIX_BUCKET`.
- [ ] Enable the four Bedrock models in the chosen AWS region.
- [ ] Fill `backend/.env` with Supabase, AWS, S3 and Bedrock values.
- [ ] Create Python venv and install `backend/requirements.txt`.
- [ ] Install spaCy English model with `python -m spacy download en_core_web_sm`.
- [ ] Start FastAPI on port 8000.
- [ ] Fill root `.env` with `VITE_API_URL=http://localhost:8000`.
- [ ] Install frontend dependencies with npm.
- [ ] Start Vite on port 5173.
- [ ] Create a test Supabase account.
- [ ] Upload the demo/source document and confirm PII → protection → generation → verification → audit flow.
- [ ] Confirm audit events appear under Security & Privacy.
