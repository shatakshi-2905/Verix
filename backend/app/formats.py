"""Server-side validation for the structured output the model returns.

Mirrors src/lib/verix/formats/contracts.ts on the frontend. The backend is
the only place that can enforce this before the payload is stored, so a
model that drops a required field or blows the X character limit is caught
here rather than relying on the browser alone.
"""

from typing import Any

X_CHAR_LIMIT = 280


def _nonempty(v: Any) -> bool:
    return isinstance(v, str) and v.strip() != ""


def _list(v: Any) -> list:
    return v if isinstance(v, list) else []


def _check(label: str, ok: bool, detail: str | None = None) -> dict[str, Any]:
    row: dict[str, Any] = {"label": label, "ok": bool(ok)}
    if detail:
        row["detail"] = detail
    return row


def _linkedin_checks(d: dict) -> list[dict]:
    hook, body, cta, hashtags = d.get("hook"), _list(d.get("body")), d.get("cta"), _list(d.get("hashtags"))
    return [
        _check("Hook present", _nonempty(hook)),
        _check("Body paragraphs exist", len(body) > 0),
        _check("CTA present", _nonempty(cta)),
        _check("Hashtags well formed", len(hashtags) > 0 and all(isinstance(h, str) and h.startswith("#") for h in hashtags)),
    ]


def _x_checks(d: dict) -> list[dict]:
    tweets = [t for t in _list(d.get("tweets")) if isinstance(t, str)]
    hashtags = _list(d.get("hashtags"))
    n = len(tweets)
    checks = [
        _check("Every tweet has content", n > 0 and all(_nonempty(t) for t in tweets)),
        _check("6 tweets or fewer", n <= 6),
    ]
    for i, t in enumerate(tweets):
        text = t
        if i == n - 1 and hashtags:
            text = f"{text} {' '.join(hashtags)}"
        if n > 1:
            text = f"{text} {i + 1}/{n}"
        label = f"Tweet {i + 1}/{n} within {X_CHAR_LIMIT} characters" if n > 1 else f"Within {X_CHAR_LIMIT} characters"
        checks.append(_check(label, len(text) <= X_CHAR_LIMIT, f"{len(text)} / {X_CHAR_LIMIT} characters"))
    return checks


def _executive_summary_checks(d: dict) -> list[dict]:
    return [
        _check("Title present", _nonempty(d.get("title"))),
        _check("Overview present", _nonempty(d.get("overview"))),
        _check("Key findings listed", len(_list(d.get("key_findings"))) >= 2),
        _check("Recommendations present", len(_list(d.get("recommendations"))) >= 2),
    ]


def _advisory_checks(d: dict) -> list[dict]:
    return [
        _check("Title present", _nonempty(d.get("title"))),
        _check("Severity set", _nonempty(d.get("severity"))),
        _check("Summary / issue / impact present", all(_nonempty(d.get(k)) for k in ("summary", "issue", "impact"))),
        _check("Recommended actions present", len(_list(d.get("recommended_actions"))) >= 2),
    ]


def _ppt_script_checks(d: dict) -> list[dict]:
    slides = _list(d.get("slides"))
    return [
        _check("Deck title present", _nonempty(d.get("title"))),
        _check("At least 3 slides", len(slides) >= 3),
        _check("Every slide has talking points", all(len(_list(s.get("talking_points"))) >= 1 for s in slides if isinstance(s, dict))),
    ]


def _email_checks(d: dict) -> list[dict]:
    return [
        _check("Subject present", _nonempty(d.get("subject"))),
        _check("Greeting present", _nonempty(d.get("greeting"))),
        _check("Body paragraphs exist", len(_list(d.get("body"))) > 0),
        _check("Closing present", _nonempty(d.get("closing"))),
    ]


def _newsletter_checks(d: dict) -> list[dict]:
    return [
        _check("Title present", _nonempty(d.get("title"))),
        _check("Intro present", _nonempty(d.get("intro"))),
        _check("At least two sections", len(_list(d.get("items"))) >= 2),
    ]


def _summary_checks(d: dict) -> list[dict]:
    return [
        _check("Title present", _nonempty(d.get("title"))),
        _check("Overview present", _nonempty(d.get("overview"))),
        _check("Key points listed", len(_list(d.get("key_points"))) >= 2),
    ]


_CHECKERS = {
    "linkedin": _linkedin_checks,
    "x": _x_checks,
    "executive_summary": _executive_summary_checks,
    "advisory": _advisory_checks,
    "ppt_script": _ppt_script_checks,
    "email": _email_checks,
    "newsletter": _newsletter_checks,
    "summary": _summary_checks,
}


def validate_payload(data: dict[str, Any]) -> list[dict[str, Any]]:
    fmt = data.get("format") if isinstance(data, dict) else None
    checker = _CHECKERS.get(fmt)
    if not checker:
        return [_check("Recognized format", False, f"Unknown format: {fmt!r}")]
    try:
        return checker(data)
    except Exception:
        return [_check("Structured output well-formed", False, "The model response didn't match the expected shape.")]
