import sys
import os
import io
import cv2
import numpy as np
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath("backend"))
from main import app

client = TestClient(app)

# 1. Health check
res = client.get("/health")
assert res.status_code == 200, f"Health check falhou: {res.text}"
assert res.json() == {"status": "ok"}
print("[OK] /health -> 200")

# 2. Root info
res = client.get("/")
assert res.status_code == 200
assert "service" in res.json()
print(f"[OK] / -> 200 ({res.json()})")

# 3. /identify com frame sem rosto
blank_img = np.zeros((480, 640, 3), dtype=np.uint8)
_, buf = cv2.imencode(".jpg", blank_img)
files = {"file": ("blank.jpg", io.BytesIO(buf.tobytes()), "image/jpeg")}
res = client.post("/identify", files=files)
assert res.status_code == 200
data = res.json()
assert data.get("match") is False
assert data.get("face_detected") is False
assert data.get("reason") == "no_face"
print("[OK] /identify sem rosto -> match: False, face_detected: False")

# 4. /enroll com frame sem rosto (deve retornar 400 com mensagem instrutiva)
files = {"file": ("blank.jpg", io.BytesIO(buf.tobytes()), "image/jpeg")}
res = client.post("/enroll", data={"aluno_id": "dummy-aluno"}, files=files)
assert res.status_code == 400
detail = res.json().get("detail", "")
assert "rosto humano nítido" in detail.lower() or "não encontrado" in detail.lower(), f"Mensagem inesperada: {detail}"
print(f"[OK] /enroll sem rosto -> 400 com mensagem amigável: '{detail}'")

# 5. /identify com foto humana real
real_path = os.path.join("backend", "fotos_salvas", "44c85097-41a4-494b-8905-e71920ed6270.jpg")
if os.path.exists(real_path):
    with open(real_path, "rb") as f:
        files = {"file": ("real.jpg", f, "image/jpeg")}
        res = client.post("/identify", files=files)
        assert res.status_code == 200
        print(f"[OK] /identify com rosto real -> {res.json()}")

print("G5_E2E_SUITE_PASSED")
