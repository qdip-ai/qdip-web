"""Build a redistributable remote SDK + two-demo wheel bundle.

From a QDIP checkout:
    python scripts/build_sdk_distributable.py

Output: dist/qdip-sdk02-bundle-0.1.3.zip, SHA-256 manifest.
This is a *developer handoff artifact*, not a signed public PyPI release.
Do not include server source, fixtures, keys or production credentials.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist" / "qdip-sdk02-bundle-0.1.3.zip"


def command(*args: str) -> None:
    subprocess.run(args, check=True, cwd=ROOT)


def build() -> Path:
    with tempfile.TemporaryDirectory(prefix="qdip-sdk02-release-") as folder:
        scratch = Path(folder)
        wheels = scratch / "wheels"
        wheels.mkdir()
        for package in ("packages/qdip_remote_sdk", "examples/sdk_remote_demos"):
            command(
                sys.executable, "-m", "pip", "wheel", "--no-deps",
                "-w", str(wheels), str(ROOT / package),
            )
        command(
            sys.executable, "-m", "pip", "download", "--dest", str(wheels),
            "websockets>=14,<17",
        )

        artifacts = sorted(wheels.glob("*.whl"))
        if len(artifacts) != 3:
            raise RuntimeError(f"Expected exactly three wheels, found {len(artifacts)}")
        sha = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in artifacts}
        if not any(n.startswith("qdip_remote_sdk-0.1.3-") for n in sha):
            raise RuntimeError("SDK v0.1.3 wheel missing")
        if not any(n.startswith("qdip_remote_independent_demos-0.1.0-") for n in sha):
            raise RuntimeError("Independent demos v0.1.0 wheel missing")
        if not any(n.startswith("websockets-") for n in sha):
            raise RuntimeError("Worker runtime dependency missing")
        readme = (
            "QDIP SDK-02 v0.1.3 — offline wheel handoff\n"
            "This ZIP has three wheels: SDK, two demo adapters and websockets.\n"
            "It contains NO QDIP Server/Kernel source or credentials.\n"
            "1. Extract ZIP to a directory on an independent Worker host.\n"
            "2. python -m venv .venv-qdip-worker\n"
            "3. Activate the virtual environment.\n"
            "4. python -m pip install --no-index --find-links wheels "
            "qdip-remote-sdk==0.1.3 qdip-remote-independent-demos==0.1.0\n"
            "5. Configure QDIP_REMOTE_URL=wss://SERVER/api/v1/remote-plugins/connect\n"
            "6. Configure QDIP_REMOTE_API_KEY with a Worker key (plugins:register) "
            "issued for your organization; do not copy keys into this ZIP.\n"
            "7. qdip-worker --handler repair_dispatch_plugin:make_spec "
            "--plugin-id PLUGIN_ID --capability-id repairs.plan\n"
            "PLUGIN_ID must equal the plugin_id bound to that Worker key "
            "(the local test fixture uses repair / staff).\n"
            "For Demo B, replace the handler with staffing_plugin:make_spec "
            "and the capability with staffing.plan.\n"
            "Local loopback fixture is strictly for tests; do not expose it.\n"
            "Bundle is NOT a public package-registry release or production approval.\n"
        )
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in artifacts:
                archive.write(path, "wheels/" + path.name)
            archive.writestr("SHA256.json", json.dumps(sha, indent=2) + "\n")
            archive.writestr("INSTALL.txt", readme)
        sha_zip = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
        print(f"BUNDLE={OUTPUT}")
        print(f"SHA256={sha_zip}")
        print(f"WHEELS={len(sha)}")
        return OUTPUT


if __name__ == "__main__":
    build()
