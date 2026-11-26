from __future__ import annotations

from .llm import LLMProvider
from .loader import Document
from .models import Finding, Requirement, SetCheck
from .prompts import SET_SCHEMA, completeness_prompt, consistency_prompt


SET_CRITERIA = (
    "complete", "consistent", "feasible", "comprehensible", "able_to_be_validated",
    "ranked_importance_stability", "modifiable", "traceable",
)


def check_set(document: Document, requirements: list[Requirement], provider: LLMProvider) -> SetCheck:
    responses = []
    for operation, prompt in (
        ("set_consistency", consistency_prompt), ("set_completeness", completeness_prompt)
    ):
        system, user = prompt(document, requirements)
        responses.append(
            provider.generate_json(system, user, schema=SET_SCHEMA, operation=operation)
        )
    verdicts = {}
    for criterion in SET_CRITERIA:
        values = [response.get("verdicts", {}).get(criterion, "n.a.") for response in responses]
        verdicts[criterion] = "violation" if "violation" in values else ("ok" if "ok" in values else "n.a.")
    findings = [
        Finding.from_dict(item)
        for response in responses
        for item in response.get("findings", [])
        if isinstance(item, dict)
    ]
    missing_sections = list(dict.fromkeys(
        str(item) for response in responses for item in response.get("missing_sections", [])
    ))
    traceability = " ".join(
        str(response.get("traceability", "")).strip() for response in responses
        if str(response.get("traceability", "")).strip()
    )
    return SetCheck(
        verdicts=verdicts,
        findings=findings,
        missing_sections=missing_sections,
        traceability=traceability,
    )
