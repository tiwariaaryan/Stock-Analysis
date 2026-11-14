from google import genai
from ..config import get_settings

def get_gemini_client():
    """Default client — GEMINI_API_KEY1 / GEMINI_API_KEY + GEMINI_MODEL (for general tasks)."""
    settings = get_settings()
    key = settings.gemini_api_key1 or settings.gemini_api_key
    if not key:
        return None
    return genai.Client(api_key=key, http_options={"timeout": 15000})

def get_model_name():
    return get_settings().gemini_model

def get_chat_client():
    """Chat client — GEMINI_API_KEY1 + GEMINI_MODEL1 (dedicated for chatbot)."""
    settings = get_settings()
    key = settings.gemini_api_key1 or settings.gemini_api_key
    if not key:
        return None
    return genai.Client(api_key=key, http_options={"timeout": 15000})

def get_chat_model_name():
    return get_settings().gemini_model1
