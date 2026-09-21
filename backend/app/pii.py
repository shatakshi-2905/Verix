from functools import lru_cache
from typing import Any

from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_analyzer.nlp_engine import NlpEngineProvider

from .config import get_settings

settings = get_settings()

# Curated entity list: the presidio defaults also flag DATE_TIME, generic
# NRP/URL etc., which over-masks harmless dates and weekday mentions. This
# keeps detection focused on what the product calls "sensitive".
DEFAULT_ENTITIES = [
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "PERSON",
    "CREDIT_CARD",
    "IBAN_CODE",
    "US_SSN",
    "IP_ADDRESS",
    "LOCATION",
    "EMPLOYEE_ID",
    "ACCOUNT_NUMBER",
    "INTERNAL_PROJECT",
]


def _custom_recognizers() -> list[PatternRecognizer]:
    return [
        PatternRecognizer(
            supported_entity="EMPLOYEE_ID",
            patterns=[Pattern(name="employee_id", regex=r"\b(?:employee|emp)[\s_-]*id[:\s#-]*[A-Z0-9-]{3,}\b", score=0.75)],
        ),
        PatternRecognizer(
            supported_entity="ACCOUNT_NUMBER",
            patterns=[Pattern(name="account_number", regex=r"\b(?:account|acct|a/c)[\s.:#-]*\d{6,}\b", score=0.8)],
        ),
        PatternRecognizer(
            supported_entity="INTERNAL_PROJECT",
            patterns=[Pattern(name="internal_project", regex=r"\b(?:internal\s+project|project)\s+[A-Z]{4,}\b", score=0.7)],
        ),
    ]


@lru_cache
def _nlp_engine():
    # README installs en_core_web_sm; the presidio default NlpEngineProvider
    # config points at en_core_web_lg, which isn't installed and would fail
    # (or silently download a large model) on first request.
    provider = NlpEngineProvider(
        nlp_configuration={
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
        }
    )
    return provider.create_engine()


@lru_cache
def analyzer() -> AnalyzerEngine:
    engine = AnalyzerEngine(nlp_engine=_nlp_engine(), supported_languages=["en"])
    for recognizer in _custom_recognizers():
        engine.registry.add_recognizer(recognizer)
    return engine


def detect(text: str) -> list[dict[str, Any]]:
    results = analyzer().analyze(text=text, language="en", entities=DEFAULT_ENTITIES)
    findings = []
    for idx, result in enumerate(results):
        preview = _preview(text[result.start:result.end], result.entity_type)
        findings.append({
            "id": f"pii-{idx}-{result.start}-{result.end}",
            "entity_type": result.entity_type,
            "category": result.entity_type.replace("_", " ").title(),
            "value": preview,
            "start": result.start,
            "end": result.end,
            "score": round(result.score, 4),
            # Only a masked preview reaches the browser/audit log.
            "preview": preview,
            "action": "mask",
            "occurrences": 1,
        })
    return findings


def protect(text: str, findings: list[dict[str, Any]]) -> str:
    """Apply server-side masking/removal while honoring per-item user actions.

    Findings can overlap (e.g. a PERSON span inside a longer LOCATION span).
    Slicing the original string at each span's start/end independently and
    stitching results back together in start-descending order corrupts the
    text once two spans overlap, because a later (leftward) splice uses
    offsets computed against the *original* string, which an earlier splice
    already shifted. Building the result in a single left-to-right pass and
    skipping any span that starts before the current cursor avoids that: it
    never re-slices already-written output, so offsets stay valid throughout.
    """
    spans = []
    for item in findings:
        action = item.get("action", "mask")
        if action == "keep":
            continue
        start, end = int(item["start"]), int(item["end"])
        if end <= start:
            continue
        spans.append((start, end, action, item.get("entity_type", "PII")))

    spans.sort(key=lambda s: (s[0], -s[1]))

    out: list[str] = []
    cursor = 0
    for start, end, action, entity in spans:
        if start < cursor:
            continue  # overlaps a span already applied — skip instead of corrupting offsets
        out.append(text[cursor:start])
        if action != "remove":
            out.append(f"[{entity}_REDACTED]")
        cursor = end
    out.append(text[cursor:])
    return "".join(out)


def _preview(value: str, entity: str) -> str:
    if "@" in value:
        user, domain = value.split("@", 1)
        return f"{user[:1]}{'*' * max(2, len(user)-1)}@{domain}"
    if len(value) <= 4:
        return "•" * len(value)
    return f"{value[:1]}{'•' * max(3, len(value)-2)}{value[-1:]}"
