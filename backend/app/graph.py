from typing import Any, TypedDict
from uuid import uuid4

from langgraph.graph import StateGraph, END

from .ai import generate, retrieve_context, verify_output
from .audit import audit


class VerixState(TypedDict, total=False):
    run_id: str
    user_id: str
    document_id: str
    # Already-protected working copy of the source (PII masked/removed per
    # the user's Keep/Mask/Remove choices). Nothing upstream of this state
    # ever sees the raw source — see main.py's generate_content, which loads
    # `protected_text` from the database rather than trusting client input.
    source: str
    config: dict[str, Any]
    output_type: str
    context: list[str]
    generated: dict[str, Any]
    content: str
    verification: list[dict[str, Any]]


def retrieval_node(state: VerixState) -> VerixState:
    context = retrieve_context(state["document_id"], state["source"], state["user_id"])
    audit(state["user_id"], "VECTOR_RETRIEVAL", "document", state["document_id"], state["run_id"],
          {"chunks": len(context)})
    return {"context": context}


def generation_node(state: VerixState) -> VerixState:
    generated = generate(
        state["source"],
        state["output_type"],
        state["config"],
        context=state.get("context", []),
    )
    content = render_content(generated)
    audit(state["user_id"], "CONTENT_GENERATED", "output", None, state["run_id"],
          {"output_type": state["output_type"], "model": "amazon.nova-pro-v1:0"})
    return {"generated": generated, "content": content}


def verification_node(state: VerixState) -> VerixState:
    # Compared against the protected working copy, not the raw source — the
    # generated content was itself produced from the protected copy, and
    # comparing against it keeps raw PII out of this Bedrock call too.
    verification = verify_output(state["content"], state["source"])
    audit(state["user_id"], "OUTPUT_VERIFIED", "output", None, state["run_id"],
          {"claims": len(verification), "needs_review": sum(1 for x in verification if x.get("status") == "Needs Review")})
    return {"verification": verification}


def build_graph():
    graph = StateGraph(VerixState)
    graph.add_node("retrieve", retrieval_node)
    graph.add_node("generate", generation_node)
    graph.add_node("verify", verification_node)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", "verify")
    graph.add_edge("verify", END)
    return graph.compile()


VERIX_GRAPH = build_graph()


def run_generation(user_id: str, document_id: str, protected_source: str, output_type: str, config: dict[str, Any]) -> VerixState:
    run_id = str(uuid4())
    audit(user_id, "TRANSFORMATION_STARTED", "document", document_id, run_id, {"output_type": output_type})
    result = VERIX_GRAPH.invoke({
        "run_id": run_id,
        "user_id": user_id,
        "document_id": document_id,
        "source": protected_source,
        "config": config,
        "output_type": output_type,
    })
    return result


def _numbered_tweets(data: dict[str, Any]) -> list[str]:
    """Mirrors src/lib/verix/formats/contracts.ts numberTweets(): the "n/N"
    suffix and hashtags are applied programmatically, never left to the
    model, so the stored `content` always matches what the frontend renders."""
    tweets = data.get("tweets") or []
    hashtags = data.get("hashtags") or []
    n = len(tweets)
    out = []
    for i, t in enumerate(tweets):
        text = t
        if i == n - 1 and hashtags:
            text = f"{text} {' '.join(hashtags)}"
        if n > 1:
            text = f"{text} {i + 1}/{n}"
        out.append(text)
    return out


def render_content(data: dict[str, Any]) -> str:
    fmt = data.get("format")
    if fmt == "linkedin":
        return "\n\n".join([data.get("hook", ""), *data.get("body", []), "\n".join("→ " + x for x in data.get("key_points", [])), data.get("cta", ""), " ".join(data.get("hashtags", []))]).strip()
    if fmt == "x":
        return "\n\n".join(_numbered_tweets(data)).strip()
    if fmt == "executive_summary":
        return "\n\n".join([data.get("title", ""), data.get("overview", ""), "\n".join("• " + x for x in data.get("key_findings", [])), "\n".join("• " + x for x in data.get("implications", [])), "\n".join("• " + x for x in data.get("recommendations", []))]).strip()
    if fmt == "advisory":
        return "\n\n".join([data.get("title", ""), data.get("severity", ""), data.get("affected", ""), data.get("summary", ""), data.get("issue", ""), data.get("impact", ""), "\n".join("• " + x for x in data.get("recommended_actions", [])), "\n".join(data.get("references", []))]).strip()
    if fmt == "ppt_script":
        return "\n\n".join(f"Slide {s.get('number')}: {s.get('title')}\n" + "\n".join("• " + x for x in s.get("talking_points", [])) + "\nSpeaker notes: " + s.get("speaker_notes", "") for s in data.get("slides", []))
    if fmt == "email":
        return "\n\n".join([data.get("subject", ""), data.get("greeting", ""), *data.get("body", []), "\n".join("• " + x for x in data.get("key_points", [])), data.get("closing", ""), data.get("signature", "")]).strip()
    if fmt == "newsletter":
        return "\n\n".join([data.get("title", ""), data.get("intro", ""), *[f"{i.get('heading')}\n{i.get('body')}" for i in data.get("items", [])], data.get("closing", "")]).strip()
    return "\n\n".join([data.get("title", ""), data.get("overview", ""), "\n".join("• " + x for x in data.get("key_points", [])), data.get("conclusion", "")]).strip()
