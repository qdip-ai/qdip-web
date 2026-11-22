"""Lightweight remote QDIP worker SDK: does not depend on the server package."""

from qdip_remote_sdk.worker import AdditionalCapability, Worker, WorkerConfig

__all__ = ["Worker", "WorkerConfig", "AdditionalCapability"]
