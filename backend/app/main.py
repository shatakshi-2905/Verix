import io
import ipaddress
import re
import socket
import time
from typing import Any

import httpx
from bs4 import BeautifulSoup
from docx import Document as DocxDocument
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from pypdf import PdfReader

from .audit import audit
from .auth import require_user, supabase_public
from .config import get_settings
from .db import db
from .formats import validate_payload
from .graph import run_generation, render_content
from .ai import analyze, embed
from .pii import detect, protect
from .storage import upload_bytes

settings = get_settings()
app = FastAPI(title="VERIX API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Credentials(BaseModel):
    email: str
    password: str


class Signup(Credentials):
    full_name: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TextDocument(BaseModel):
    title: str
    kind: str = "text"
    text: str
    is_demo: bool = False


class AnalyzeRequest(BaseModel):
    document_id: str


class ProtectRequest(BaseModel):
    document_id: str
    findings: list[dict[str, Any]] | None = None


class UrlRequest(BaseModel):
    url: HttpUrl


class GenerateRequest(BaseModel):
    document_id: str
    outputType: str
    audience: str
    tone: str
    complexity: str
    length: str
    language: str
    sections: list[str] = []


class TransformationRequest(BaseModel):
    document_id: str
    config: dict[str, Any]
    sensitive_count: int = 0
    outputs: list[dict[str, Any]]


class ReviewRequest(BaseModel):
    status: str
    content: str | None = None


@app.get("/health")
def health():
    return {"ok": True, "service": "verix-api", "version": "2.0.0"}


# --------------------------------------------------------------------------
# A minimal in-process fixed-window limiter. It only protects a single
# worker process — put a real rate limiter (e.g. Redis-backed) in front of
# this in production, especially once the API runs with more than one
# worker or instance.
# --------------------------------------------------------------------------
_login_attempts: dict[str, list[float]] = {}
_LOGIN_WINDOW_SECONDS = 60
_LOGIN_MAX_ATTEMPTS = 10


def _check_login_rate_limit(key: str) -> None:
    now = time.time()
    attempts = [t for t in _login_attempts.get(key, []) if now - t < _LOGIN_WINDOW_SECONDS]
    if len(attempts) >= _LOGIN_MAX_ATTEMPTS:
        raise HTTPException(429, "Too many login attempts. Please wait a minute and try again.")
    attempts.append(now)
    _login_attempts[key] = attempts


@app.post("/api/auth/signup")
def signup(payload: Signup):
    try:
        result = supabase_public().auth.sign_up({"email": payload.email, "password": payload.password, "options": {"data": {"full_name": payload.full_name}}})
        if not result.session:
            return {"ok": True, "requiresEmailConfirmation": True}
        audit(str(result.user.id), "SIGNUP", "user", str(result.user.id), metadata={})
        return {"ok": True, "session": {"access_token": result.session.access_token, "refresh_token": result.session.refresh_token}, "user": {"id": result.user.id, "email": result.user.email, "full_name": payload.full_name}}
    except Exception as exc:
        # Supabase auth errors are safe to relay (e.g. "Password should be at
        # least 6 characters", "User already registered"); anything else
        # falls back to a generic message rather than a raw exception string.
        message = getattr(exc, "message", None) or (str(exc) if "already registered" in str(exc).lower() or "password" in str(exc).lower() else None)
        raise HTTPException(400, message or "We couldn't create that account. Please check your details and try again.") from exc


@app.post("/api/auth/login")
def login(payload: Credentials):
    _check_login_rate_limit(payload.email.strip().lower())
    try:
        result = supabase_public().auth.sign_in_with_password({"email": payload.email, "password": payload.password})
        audit(str(result.user.id), "LOGIN", "user", str(result.user.id), metadata={})
        return {"ok": True, "session": {"access_token": result.session.access_token, "refresh_token": result.session.refresh_token}, "user": {"id": result.user.id, "email": result.user.email, "full_name": (result.user.user_metadata or {}).get("full_name") or result.user.email.split('@')[0]}}
    except Exception as exc:
        raise HTTPException(401, "Invalid email or password") from exc


@app.post("/api/auth/refresh")
def refresh(payload: RefreshRequest):
    try:
        result = supabase_public().auth.refresh_session(payload.refresh_token)
        return {"ok": True, "session": {"access_token": result.session.access_token, "refresh_token": result.session.refresh_token}}
    except Exception as exc:
        raise HTTPException(401, "Invalid refresh token") from exc


@app.get("/api/me")
def me(user=Depends(require_user)):
    return {"id": str(user.id), "email": user.email, "full_name": (user.user_metadata or {}).get("full_name") or user.email.split('@')[0]}


def extract_file(filename: str, content: bytes) -> str:
    lower = filename.lower()
    if lower.endswith('.pdf'):
        reader = PdfReader(io.BytesIO(content))
        return "\n\n".join((p.extract_text() or '') for p in reader.pages)
    if lower.endswith('.docx'):
        doc = DocxDocument(io.BytesIO(content))
        return "\n\n".join(p.text for p in doc.paragraphs)
    if lower.endswith(('.txt', '.md')):
        return content.decode('utf-8', errors='replace')
    raise HTTPException(400, "Supported files: PDF, DOCX, TXT, Markdown")


def index_document(document_id: str, user_id: str, text: str):
    """Embeds and stores chunks of `text`. Callers must only ever pass the
    PROTECTED working copy here — never the raw source — since these chunks
    are later retrieved as generation context and sent to Bedrock."""
    chunks = [text[i:i + 1400] for i in range(0, len(text), 1400)][:200]
    rows = []
    for idx, chunk in enumerate(chunks):
        vector = embed(chunk)
        rows.append({"document_id": document_id, "user_id": user_id, "chunk_index": idx, "content": chunk, "embedding": vector})
    db().table('document_chunks').delete().eq('document_id', document_id).execute()
    if rows:
        db().table('document_chunks').insert(rows).execute()


@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...), user=Depends(require_user)):
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(413, "File exceeds the 8 MB limit")
    text = extract_file(file.filename or 'document.txt', content).strip()
    if len(text) < 50:
        raise HTTPException(400, "Document contains too little readable text")
    key = upload_bytes(str(user.id), file.filename or 'document', content, file.content_type)
    result = db().table('documents').insert({"user_id": str(user.id), "title": file.filename or 'Document', "kind": 'file', "s3_key": key, "source_text": text, "word_count": len(text.split())}).execute()
    doc = result.data[0]
    # Indexing happens in /api/protect, once a protected working copy exists
    # — never here, which would embed and store the raw source.
    audit(str(user.id), "DOCUMENT_UPLOADED", "document", doc['id'], metadata={"kind": "file", "word_count": doc['word_count']})
    return doc


@app.post("/api/documents")
def create_document(payload: TextDocument, user=Depends(require_user)):
    if len(payload.text) < 50:
        raise HTTPException(400, "Document text is too short")
    result = db().table('documents').insert({"user_id": str(user.id), "title": payload.title, "kind": payload.kind, "source_text": payload.text, "word_count": len(payload.text.split()), "is_demo": payload.is_demo}).execute()
    doc = result.data[0]
    audit(str(user.id), "DOCUMENT_CREATED", "document", doc['id'], metadata={"kind": payload.kind, "word_count": doc['word_count']})
    return doc


@app.get("/api/documents")
def documents(user=Depends(require_user)):
    return db().table('documents').select('id,title,kind,word_count,is_demo,created_at').eq('user_id', str(user.id)).order('created_at', desc=True).execute().data


@app.get("/api/documents/{document_id}")
def document(document_id: str, user=Depends(require_user)):
    rows = db().table('documents').select('*').eq('id', document_id).eq('user_id', str(user.id)).limit(1).execute().data
    if not rows:
        raise HTTPException(404, "Document not found")
    return rows[0]


def _fetch_document_or_404(document_id: str, user_id: str) -> dict[str, Any]:
    rows = db().table('documents').select('*').eq('id', document_id).eq('user_id', user_id).limit(1).execute().data
    if not rows:
        raise HTTPException(404, "Document not found")
    return rows[0]


@app.post("/api/analyze")
def analyze_document(payload: AnalyzeRequest, user=Depends(require_user)):
    doc = _fetch_document_or_404(payload.document_id, str(user.id))
    source = doc["source_text"]
    try:
        # Detect and protect BEFORE calling the model — analysis runs on the
        # protected working copy, never the raw source, so raw PII never
        # reaches Bedrock even at this first step.
        findings = detect(source)
        protected_text = protect(source, findings)
        db().table('documents').update({
            "sensitive_items": [{k: v for k, v in x.items() if k not in {"start", "end"}} for x in findings],
            "protected_text": protected_text,
        }).eq("id", payload.document_id).eq("user_id", str(user.id)).execute()
        data = analyze(protected_text)
        audit(str(user.id), "DOCUMENT_ANALYZED", "document", payload.document_id, metadata={"word_count": len(source.split())})
        return {"ok": True, "analysis": data, "findings": findings, "protected_text": protected_text}
    except HTTPException:
        raise
    except Exception as exc:
        audit(str(user.id), "DOCUMENT_ANALYSIS_FAILED", "document", payload.document_id, metadata={}, status="error")
        raise HTTPException(502, "AI analysis failed") from exc


@app.post("/api/protect")
def protect_document(payload: ProtectRequest, user=Depends(require_user)):
    doc = _fetch_document_or_404(payload.document_id, str(user.id))
    source = doc["source_text"]
    findings = payload.findings or detect(source)
    protected_text = protect(source, findings)
    db().table('documents').update({"sensitive_items": [{k: v for k, v in x.items() if k not in {"start", "end"}} for x in findings], "protected_text": protected_text}).eq("id", payload.document_id).eq("user_id", str(user.id)).execute()
    # This is the point at which the user's final Keep/Mask/Remove choices
    # are known, so this is the only place the document is (re)indexed for
    # retrieval — always from the protected copy, never the raw source.
    index_document(payload.document_id, str(user.id), protected_text)
    audit(str(user.id), "DOCUMENT_PROTECTED", "document", payload.document_id, metadata={"count": len(findings)})
    return {"ok": True, "findings": findings, "protected_text": protected_text}


_PRIVATE_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # covers the 169.254.169.254 cloud metadata endpoint
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def _assert_public_host(host: str) -> None:
    """Raises if `host` resolves to a loopback/private/link-local address —
    blocks /api/ingest-url from being used to reach internal services or the
    cloud metadata endpoint (SSRF)."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise HTTPException(400, "Couldn't resolve that address") from exc
    for family, _, _, _, sockaddr in infos:
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise HTTPException(400, "That address isn't reachable")
        if any(ip in net for net in _PRIVATE_NETWORKS):
            raise HTTPException(400, "That address isn't reachable")


@app.post("/api/ingest-url")
def ingest_url(payload: UrlRequest, user=Depends(require_user)):
    url = str(payload.url)
    if payload.url.scheme not in ("http", "https"):
        raise HTTPException(400, "Only http and https addresses are supported")

    current = url
    try:
        with httpx.Client(follow_redirects=False, timeout=20, headers={"User-Agent": "VERIX/2.0"}) as client:
            for _ in range(5):
                parsed = httpx.URL(current)
                if parsed.scheme not in ("http", "https"):
                    raise HTTPException(400, "Only http and https addresses are supported")
                _assert_public_host(parsed.host)
                r = client.get(current)
                if r.is_redirect:
                    current = str(r.next_request.url) if r.next_request else current
                    continue
                r.raise_for_status()
                body = b""
                for chunk in r.iter_bytes():
                    body += chunk
                    if len(body) > settings.max_url_fetch_bytes:
                        raise HTTPException(413, "That page is too large to import")
                html = body.decode(r.encoding or "utf-8", errors="replace")
                soup = BeautifulSoup(html, 'html.parser')
                for tag in soup(['script', 'style', 'noscript']):
                    tag.decompose()
                title = soup.title.get_text(strip=True) if soup.title else current
                text = re.sub(r'\n{3,}', '\n\n', soup.get_text('\n', strip=True))
                audit(str(user.id), "URL_INGESTED", "url", metadata={"domain": parsed.host})
                return {"ok": True, "title": title[:200], "text": text[:settings.max_source_chars]}
        raise HTTPException(400, "Too many redirects")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, "Couldn't fetch that URL") from exc


@app.post("/api/generate")
def generate_content(payload: GenerateRequest, user=Depends(require_user)):
    doc = _fetch_document_or_404(payload.document_id, str(user.id))
    # The protected working copy — reflecting the user's own Keep/Mask/Remove
    # choices — is the only source of truth for generation. A client-supplied
    # `source` field is intentionally not accepted here: honoring it would
    # let the browser override those choices and reintroduce raw PII into
    # the prompt sent to Bedrock.
    protected_source = doc.get("protected_text") or doc["source_text"]
    try:
        state = run_generation(
            str(user.id),
            payload.document_id,
            protected_source,
            payload.outputType,
            payload.model_dump(exclude={'outputType', 'document_id'}),
        )
        data = state["generated"]
        checks = validate_payload(data)
        return {
            "ok": True,
            "run_id": state["run_id"],
            "format": data.get('format', 'summary'),
            "data": data,
            "content": state["content"],
            "checks": checks,
            "verification": state.get("verification", []),
        }
    except Exception as exc:
        audit(str(user.id), "GENERATION_FAILED", "document", payload.document_id, metadata={"output_type": payload.outputType}, status="error")
        raise HTTPException(502, "AI generation failed") from exc


@app.post("/api/transformations")
def create_transformation(payload: TransformationRequest, user=Depends(require_user)):
    uid = str(user.id)
    doc_rows = db().table('documents').select('id').eq('id', payload.document_id).eq('user_id', uid).limit(1).execute().data
    if not doc_rows:
        raise HTTPException(404, 'Document not found')
    tr = db().table('transformations').insert({"user_id": uid, "document_id": payload.document_id, "config": payload.config, "sensitive_count": payload.sensitive_count}).execute().data[0]
    output_rows = []
    for o in payload.outputs:
        output_rows.append({"transformation_id": tr['id'], "user_id": uid, "run_id": o.get('runId'), "output_type": o.get('type', 'Summary'), "format": o.get('format', 'summary'), "data": o.get('data'), "content": o.get('content', ''), "format_checks": o.get('formatChecks', []), "status": o.get('status', 'Draft'), "verification": o.get('verification', []), "versions": o.get('versions', []), "active_version": o.get('activeVersion', 1)})
    inserted = db().table('outputs').insert(output_rows).execute().data if output_rows else []
    audit(uid, "TRANSFORMATION_SAVED", "transformation", tr['id'], metadata={"outputs": len(output_rows)})
    tr['outputs'] = inserted
    return tr


@app.get("/api/transformations")
def transformations(user=Depends(require_user)):
    uid = str(user.id)
    trs = db().table('transformations').select('*,documents(title)').eq('user_id', uid).order('created_at', desc=True).execute().data
    for tr in trs:
        tr['outputs'] = db().table('outputs').select('*').eq('transformation_id', tr['id']).order('created_at').execute().data
    return trs


@app.patch("/api/outputs/{output_id}")
def update_output(output_id: str, payload: ReviewRequest, user=Depends(require_user)):
    rows = db().table('outputs').select('id,transformation_id').eq('id', output_id).eq('user_id', str(user.id)).limit(1).execute().data
    if not rows:
        raise HTTPException(404, "Output not found")
    patch = {"status": payload.status}
    if payload.content is not None:
        patch["content"] = payload.content
    db().table('outputs').update(patch).eq('id', output_id).eq('user_id', str(user.id)).execute()
    action = "OUTPUT_APPROVED" if payload.status == "Approved" else "OUTPUT_REVIEW_UPDATED"
    audit(str(user.id), action, "output", output_id, metadata={"status": payload.status})
    return {"ok": True}


@app.get("/api/audit-logs")
def audit_logs(user=Depends(require_user)):
    return db().table("audit_logs").select("id,action,resource_type,resource_id,run_id,status,metadata,created_at").eq("user_id", str(user.id)).order("created_at", desc=True).limit(200).execute().data
