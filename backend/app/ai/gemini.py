from google import genai
from ..config import get_settings

def get_gemini_client():
    """Analytical Intelligence Client — GEMINI_API_KEY (Key 2) with fallback to Key 1."""
    settings = get_settings()
    key = settings.gemini_api_key or settings.gemini_api_key1
    if not key:
        return None
    return genai.Client(api_key=key, http_options={"timeout": 15000})

def get_model_name():
    return get_settings().gemini_model

def get_model_cascade():
    """Ordered cascade of models from preferred to lower variants for seamless failover."""
    settings = get_settings()
    models = [
        settings.gemini_model,
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-flash-latest",
    ]
    return [m for m in dict.fromkeys(models) if m]

def get_chat_client():
    """Interactive Chat & Multimodal OCR Client — GEMINI_API_KEY1 (Key 1) with fallback to Key 2."""
    settings = get_settings()
    key = settings.gemini_api_key1 or settings.gemini_api_key
    if not key:
        return None
    return genai.Client(api_key=key, http_options={"timeout": 15000})

def get_chat_model_name():
    return get_settings().gemini_model1
