"""Resilient Gemini caller with automatic model cascade and dual API key failover.

Shared utility for all AI services that need to call Google Gemini with
robust error handling, quota management, and model downgrade logic.
"""
import json
import os
import re
import time


def call_gemini_resilient(prompt: str) -> str:
    """Call Gemini with automatic variant downgrade and retry logic.

    Model cascade hierarchy:
    1. Configured model (e.g. gemini-3.5-flash)
    2. gemini-3.5-flash-lite (high separate quota)
    3. gemini-2.5-flash (stable fallback)
    4. gemini-3.1-flash-lite (fast fallback)
    5. gemini-flash-latest (evergreen)

    Includes transient retry with backoff and automatic dual API key failover.
    """
    from ..config import get_settings
    from google import genai

    settings = get_settings()
    keys_to_try = [k for k in [settings.gemini_api_key, settings.gemini_api_key1] if k]
    keys_to_try = list(dict.fromkeys(keys_to_try))

    models_to_try = [
        settings.gemini_model,
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-flash-latest",
    ]
    models_to_try = [m for m in dict.fromkeys(models_to_try) if m]

    if not keys_to_try:
        print("[ai-gemini] No Gemini API key configured")
        return "{}"

    saved_proxy = {}
    for k in list(os.environ):
        if "proxy" in k.lower() and k not in ("NO_PROXY", "no_proxy"):
            saved_proxy[k] = os.environ.pop(k)

    try:
        for key_idx, key in enumerate(keys_to_try):
            client = genai.Client(api_key=key, http_options={"timeout": 30000})
            for model in models_to_try:
                for retry in range(2):
                    try:
                        response = client.models.generate_content(model=model, contents=prompt)
                        text = (response.text or "").strip()
                        if text:
                            return text
                    except Exception as e:
                        err = str(e)
                        is_quota_exhausted = "429" in err or "RESOURCE_EXHAUSTED" in err or "quota" in err.lower()
                        is_model_unavailable = "404" in err or "NOT_FOUND" in err or "no longer available" in err.lower()
                        is_transient = "503" in err or "UNAVAILABLE" in err or "timeout" in err.lower()

                        print(f"[ai-gemini] [Key {key_idx+1}] Model {model} attempt {retry+1} error: {err[:90]}")

                        if is_quota_exhausted:
                            print(f"[ai-gemini] Quota reached for {model} -> trying lower variant...")
                            break

                        if is_model_unavailable:
                            break

                        if is_transient and retry == 0:
                            time.sleep(1.0)
                            continue
                        break
        return "{}"
    finally:
        os.environ.update(saved_proxy)


def parse_gemini_json(text: str) -> dict | list:
    """Extract JSON from Gemini response, handling markdown code fences."""
    text = re.sub(r'^```json\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r'[\[{].*[\]}]', text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                pass
    return {}
