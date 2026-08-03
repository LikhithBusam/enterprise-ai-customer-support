from __future__ import annotations

from src.core.config import Settings


def test_settings_from_env_defaults(monkeypatch) -> None:
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("PLANNER_MODEL", raising=False)
    monkeypatch.delenv("CRITIC_MODEL", raising=False)

    settings = Settings.from_env()

    assert settings.llm_provider == "nim"
    assert settings.planner_model == "meta/llama-3.1-8b-instruct"
    assert settings.critic_model == "meta/llama-3.1-8b-instruct"
    assert settings.ollama_model == "qwen2.5:3b-instruct"
    assert settings.nim_rpm == 35


def test_settings_from_env_overrides(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("PLANNER_MODEL", "custom-planner-model")
    monkeypatch.setenv("NIM_RPM", "10")

    settings = Settings.from_env()

    assert settings.llm_provider == "gemini"
    assert settings.planner_model == "custom-planner-model"
    assert settings.nim_rpm == 10
