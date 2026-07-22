"""Queue a Soul ID graph on the local ComfyUI server and wait for the image.

Usage (from arganta-character-studio/):
  python workflows/run.py 00 "photo of a man in a navy suit" --seed 42 --out tests/baseline-results/wf00.png

The MCP will import soul_graphs directly; this runner is for smoke tests and
evaluation batches.
"""
import argparse, json, sys, time, urllib.request, urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import soul_graphs as sg

BASE = "http://127.0.0.1:8188"


def queue_and_fetch(graph, timeout=600):
    req = urllib.request.Request(f"{BASE}/prompt", json.dumps({"prompt": graph}).encode(),
                                 {"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        pid = json.load(r)["prompt_id"]
    deadline = time.time() + timeout
    while time.time() < deadline:
        time.sleep(1.5)
        with urllib.request.urlopen(f"{BASE}/history/{pid}") as r:
            hist = json.load(r)
        entry = hist.get(pid)
        if not entry:
            continue
        status = entry.get("status", {})
        if status.get("status_str") == "error":
            msgs = [m for m in status.get("messages", []) if m[0] == "execution_error"]
            raise RuntimeError(f"workflow error: {json.dumps(msgs)[:800]}")
        images = [i for o in entry.get("outputs", {}).values() for i in o.get("images", [])]
        if images:
            img = images[0]
            q = urllib.parse.urlencode({"filename": img["filename"],
                                        "subfolder": img.get("subfolder", ""),
                                        "type": img.get("type", "output")})
            with urllib.request.urlopen(f"{BASE}/view?{q}") as r:
                return r.read()
    raise TimeoutError(f"no result after {timeout}s")


BUILDERS = {
    "00": lambda a: sg.wf00_base(a.prompt, a.seed, a.res),
    "01": lambda a: sg.wf01_lora(a.prompt, a.seed, a.lora, res=a.res),
    "02": lambda a: sg.wf02_ipadapter(a.prompt, a.seed, a.ref, weight=a.weight, res=a.res),
    "03": lambda a: sg.wf03_lora_ipadapter(a.prompt, a.seed, a.lora, a.ref, res=a.res),
    "05": lambda a: sg.wf05_face_refine(a.ref, a.prompt, a.seed),
}

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("workflow", choices=BUILDERS)
    p.add_argument("prompt")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--res", default="portrait")
    p.add_argument("--lora", default=None)
    p.add_argument("--ref", default=None, help="image name inside ComfyUI input dir")
    p.add_argument("--weight", type=float, default=0.85)
    p.add_argument("--out", default="out.png")
    a = p.parse_args()
    t0 = time.time()
    png = queue_and_fetch(BUILDERS[a.workflow](a))
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_bytes(png)
    print(f"OK wf{a.workflow} {len(png)} bytes in {time.time()-t0:.1f}s -> {a.out}")
