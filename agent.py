#!/usr/bin/env python3
"""COMMAND AI local companion. Python standard library only."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, unquote
from pathlib import Path
import json, os, subprocess, urllib.request, urllib.error, platform, shutil, time

ROOT = Path(__file__).resolve().parent
OLLAMA = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
PORT = int(os.environ.get("COMMAND_AI_PORT", "8765"))
HOME = Path.home().resolve()
MAX_BODY = 12 * 1024 * 1024

SYSTEM = """You are COMMAND AI, a local modular assistant. Be accurate, concise, and honest.
You may request a tool by replying with ONLY one JSON object:
{"tool":"tool_name","arguments":{...}}
Available tools: system_info{}, list_models{}, list_files{"path":"."}, read_file{"path":"relative/path"}, run_safe_command{"command":"uname -a"}.
Use tools only when needed. File tools are restricted to the user's home directory and read-only.
The safe command tool has a strict allowlist; never attempt to bypass it. If a tool result arrives,
use it to answer the user. Never claim an action succeeded unless the tool result confirms it.
If you don't need a tool, answer normally. For image questions, analyze the attached image if supplied.
The user must manually run or approve anything outside the available tools.
"""

def json_bytes(obj):
    return json.dumps(obj, ensure_ascii=False).encode("utf-8")

def home_path(raw):
    p = (HOME / str(raw or ".")).expanduser().resolve()
    if p != HOME and HOME not in p.parents:
        raise ValueError("Path is outside your home directory.")
    return p

def run_tool(name, args):
    args = args if isinstance(args, dict) else {}
    if name == "system_info":
        return {"os": platform.platform(), "python": platform.python_version(),
                "cpu": platform.processor() or platform.machine(),
                "home": str(HOME), "disk": shutil.disk_usage(HOME)._asdict() if hasattr(shutil.disk_usage(HOME), "_asdict") else {
                    "total": shutil.disk_usage(HOME).total, "used": shutil.disk_usage(HOME).used,
                    "free": shutil.disk_usage(HOME).free}}
    if name == "list_models":
        with urllib.request.urlopen(OLLAMA + "/api/tags", timeout=8) as r:
            return json.loads(r.read().decode("utf-8"))
    if name == "list_files":
        p = home_path(args.get("path", "."))
        if not p.exists() or not p.is_dir():
            raise ValueError("That directory does not exist.")
        return {"path": str(p), "items": [{"name": x.name, "type": "directory" if x.is_dir() else "file"} for x in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()) )][:150]}
    if name == "read_file":
        p = home_path(args.get("path", ""))
        if not p.is_file():
            raise ValueError("That file does not exist.")
        if p.stat().st_size > 200_000:
            raise ValueError("File is larger than the 200 KB safety limit.")
        return {"path": str(p), "content": p.read_text(encoding="utf-8", errors="replace")}
    if name == "run_safe_command":
        command = str(args.get("command", "")).strip()
        allowed = {
            "pwd": ["pwd"], "whoami": ["whoami"], "date": ["date"],
            "uname -a": ["uname", "-a"], "df -h": ["df", "-h"],
            "free -h": ["free", "-h"], "uptime": ["uptime"],
            "python --version": ["python3", "--version"],
            "ollama list": ["ollama", "list"], "git status": ["git", "-C", str(ROOT), "status", "--short"],
        }
        if command not in allowed:
            raise ValueError("Command not on the safe allowlist. Allowed: " + ", ".join(allowed))
        p = subprocess.run(allowed[command], cwd=str(HOME), capture_output=True, text=True, timeout=10)
        return {"command": command, "exit_code": p.returncode, "stdout": p.stdout[-12000:], "stderr": p.stderr[-4000:]}
    raise ValueError("Unknown tool.")

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def send_json(self, code, obj):
        body = json_bytes(obj)
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)
    def do_OPTIONS(self):
        self.send_json(200, {"ok": True})
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            try:
                with urllib.request.urlopen(OLLAMA + "/api/tags", timeout=2) as r:
                    tags = json.loads(r.read().decode())
                self.send_json(200, {"ok": True, "ollama": True, "models": len(tags.get("models", [])), "ollama_host": OLLAMA})
            except Exception as e:
                self.send_json(200, {"ok": True, "ollama": False, "error": str(e), "ollama_host": OLLAMA})
            return
        if path == "/api/tags":
            self.proxy_ollama("/api/tags", None); return
        if path == "/api/tools":
            self.send_json(200, {"tools": [
                {"name":"system_info","description":"Get operating system, Python and disk information"},
                {"name":"list_models","description":"List local Ollama models"},
                {"name":"list_files","description":"List a directory inside your home folder"},
                {"name":"read_file","description":"Read a text file inside your home folder (200 KB max)"},
                {"name":"run_safe_command","description":"Run one exact command from the safe allowlist"}
            ]}); return
        return super().do_GET()
    def read_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length < 0 or length > MAX_BODY:
            raise ValueError("Request too large.")
        return json.loads(self.rfile.read(length).decode("utf-8"))
    def do_POST(self):
        path = urlparse(self.path).path
        try:
            data = self.read_body()
            if path == "/api/chat":
                self.proxy_ollama("/api/chat", data); return
            if path == "/api/agent":
                self.agent(data); return
            if path == "/api/tool":
                result = run_tool(str(data.get("tool", "")), data.get("arguments", {}))
                self.send_json(200, {"ok": True, "result": result}); return
            self.send_json(404, {"error":"Not found"})
        except Exception as e:
            self.send_json(400, {"error": str(e)})
    def proxy_ollama(self, route, data):
        body = json_bytes(data) if data is not None else None
        req = urllib.request.Request(OLLAMA + route, data=body, headers={"Content-Type":"application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                content = r.read()
                self.send_response(r.status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
        except urllib.error.HTTPError as e:
            self.send_json(e.code, {"error": e.read().decode("utf-8", "replace")})
        except Exception as e:
            self.send_json(502, {"error": "Ollama connection failed: " + str(e)})
    def agent(self, data):
        model = str(data.get("model", "")).strip()
        messages = data.get("messages", [])
        if not model or not isinstance(messages, list):
            self.send_json(400, {"error":"A model and message list are required."}); return
        conversation = [{"role":"system","content":SYSTEM}] + messages[-20:]
        tool_trace = []
        for _ in range(5):
            payload = {"model":model,"messages":conversation,"stream":False,
                       "options":{"num_ctx":2048, "temperature":0.2}}
            req = urllib.request.Request(OLLAMA + "/api/chat", data=json_bytes(payload), headers={"Content-Type":"application/json"})
            try:
                with urllib.request.urlopen(req, timeout=180) as r:
                    answer = json.loads(r.read().decode("utf-8"))
            except Exception as e:
                self.send_json(502, {"error":"Ollama request failed: "+str(e)}); return
            msg = answer.get("message", {})
            content = str(msg.get("content", ""))
            parsed = None
            try:
                candidate = content.strip()
                if candidate.startswith("```"):
                    candidate = candidate.split("\n",1)[-1].rsplit("```",1)[0].strip()
                obj = json.loads(candidate)
                if isinstance(obj, dict) and isinstance(obj.get("tool"), str):
                    parsed = obj
            except Exception:
                pass
            if not parsed:
                self.send_json(200, {"message":{"role":"assistant","content":content},"tools_used":tool_trace}); return
            try:
                result = run_tool(parsed["tool"], parsed.get("arguments", {}))
                tool_trace.append({"tool":parsed["tool"],"ok":True,"result":result})
                conversation.append({"role":"assistant","content":content})
                conversation.append({"role":"user","content":"TOOL RESULT for "+parsed["tool"]+":\n"+json.dumps(result,ensure_ascii=False)+"\nUse this result to answer the original request, or call another available tool if necessary."})
            except Exception as e:
                result = {"error":str(e)}
                tool_trace.append({"tool":parsed["tool"],"ok":False,"result":result})
                conversation.append({"role":"assistant","content":content})
                conversation.append({"role":"user","content":"TOOL ERROR: "+str(e)+". Answer honestly or choose another available tool."})
        self.send_json(200, {"message":{"role":"assistant","content":"I reached the tool-call limit for this request. Tools used: "+", ".join(t["tool"] for t in tool_trace)},"tools_used":tool_trace})

if __name__ == "__main__":
    print("COMMAND AI local companion")
    print("Web interface: http://127.0.0.1:%s" % PORT)
    print("Ollama endpoint: %s" % OLLAMA)
    print("Tools: read-only home-folder access + strict safe command allowlist")
    print("Press Ctrl+C to stop.")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
