from enum import Enum
from typing import Optional

import httpx
from openai import OpenAI

from backend.config import settings


class LLMModel(str, Enum):
    DEEPSEEK = "deepseek-chat"
    OPENAI = "gpt-4o"


class LLMClient:
    def __init__(self, model: LLMModel = LLMModel.DEEPSEEK):
        self.model = model
        self._client: Optional[OpenAI] = None

    @property
    def client(self) -> OpenAI:
        if self._client is None:
            if self.model == LLMModel.DEEPSEEK:
                self._client = OpenAI(
                    api_key=settings.DEEPSEEK_API_KEY,
                    base_url=settings.DEEPSEEK_BASE_URL,
                    http_client=httpx.Client(verify=False, timeout=120.0),
                )
            else:
                self._client = OpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    base_url=settings.OPENAI_BASE_URL,
                    http_client=httpx.Client(verify=False, timeout=120.0),
                )
        return self._client

    def chat(self, system_prompt: str, user_message: str, temperature: float = 0.3) -> str:
        response = self.client.chat.completions.create(
            model=self.model.value,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=temperature,
        )
        return response.choices[0].message.content or ""


llm_client = LLMClient(model=LLMModel.DEEPSEEK)
