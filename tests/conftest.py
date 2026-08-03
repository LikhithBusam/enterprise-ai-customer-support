from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

import chromadb
import pytest

from src.memory.client_store import ClientStore

TEST_CLIENT_ID = "test_client"


@pytest.fixture
def tmp_chroma_dir(tmp_path: Path) -> Generator[Path, None, None]:
    chroma_path = tmp_path / "chroma"
    chroma_path.mkdir()
    cache_dir = tmp_path / "cache"
    cache_dir.mkdir()
    previous = os.environ.get("XDG_CACHE_HOME")
    os.environ["XDG_CACHE_HOME"] = str(cache_dir)
    yield chroma_path
    if previous is None:
        os.environ.pop("XDG_CACHE_HOME", None)
    else:
        os.environ["XDG_CACHE_HOME"] = previous


@pytest.fixture
def chroma_client(tmp_chroma_dir: Path) -> chromadb.Client:
    return chromadb.PersistentClient(path=str(tmp_chroma_dir))


@pytest.fixture
def client_store(chroma_client: chromadb.Client) -> ClientStore:
    return ClientStore(chroma_client, TEST_CLIENT_ID)


@pytest.fixture
def client_id() -> str:
    return TEST_CLIENT_ID
