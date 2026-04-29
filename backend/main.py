import os
import uuid
import time
import json
from pathlib import Path
from typing import List, Set
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import shutil

app = FastAPI(title="DropLink")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use /tmp/uploads on hosted platforms (Render/Railway), local otherwise
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)

connected_clients: Set[WebSocket] = set()


def get_files():
    files = []
    for f in UPLOAD_DIR.iterdir():
        if f.is_file():
            stat = f.stat()
            parts = f.name.split("_", 2)
            display_name = parts[2] if len(parts) >= 3 else f.name
            files.append({
                "id": f.name,
                "name": display_name,
                "filename": f.name,
                "size": stat.st_size,
                "uploaded_at": stat.st_mtime,
                "extension": f.suffix.lower()
            })
    files.sort(key=lambda x: x["uploaded_at"], reverse=True)
    return files


async def broadcast(message: dict):
    dead = set()
    for ws in connected_clients:
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            dead.add(ws)
    connected_clients.difference_update(dead)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    await websocket.send_text(json.dumps({"type": "files", "data": get_files()}))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.discard(websocket)


@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    uploaded = []
    for file in files:
        ext = Path(file.filename).suffix
        uid = f"{int(time.time())}_{uuid.uuid4().hex[:6]}_{file.filename}"
        dest = UPLOAD_DIR / uid
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        info = {
            "id": uid,
            "name": file.filename,
            "filename": uid,
            "size": dest.stat().st_size,
            "uploaded_at": time.time(),
            "extension": ext.lower()
        }
        uploaded.append(info)
    await broadcast({"type": "new_files", "data": uploaded})
    return {"uploaded": uploaded}


@app.get("/files")
async def list_files():
    return get_files()

@app.post("/send-text")
async def send_text(request: Request):
    body = await request.json()
    text = body.get("text", "").strip()
    if not text:
        return JSONResponse(status_code=400, content={"error": "Empty text"})
    payload = {
        "type": "text_message",
        "data": {
            "id": uuid.uuid4().hex[:8],
            "text": text,
            "sent_at": time.time()
        }
    }
    await broadcast(payload)
    return {"sent": True}

@app.get("/download/{filename}")
async def download_file(filename: str):
    path = UPLOAD_DIR / filename
    if not path.exists():
        return JSONResponse(status_code=404, content={"error": "File not found"})
    parts = filename.split("_", 2)
    original_name = parts[2] if len(parts) >= 3 else filename
    return FileResponse(path, filename=original_name, media_type="application/octet-stream")


@app.delete("/files/{filename}")
async def delete_file(filename: str):
    path = UPLOAD_DIR / filename
    if path.exists():
        path.unlink()
    await broadcast({"type": "deleted", "data": {"filename": filename}})
    return {"deleted": filename}


@app.delete("/files")
async def clear_all():
    for f in UPLOAD_DIR.iterdir():
        if f.is_file():
            f.unlink()
    await broadcast({"type": "cleared"})
    return {"cleared": True}


# Serve built React frontend — must be LAST
STATIC_DIR = Path("static")
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
