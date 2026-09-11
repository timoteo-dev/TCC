import sys
import os
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath("backend"))
from main import app, storage

client = TestClient(app)

# 1. Testar diretamente o método storage.get_photo_url com ID que não possui foto
dummy_id = "00000000-0000-0000-0000-000000000000"
try:
    url = storage.get_photo_url(dummy_id)
    print(f"[OK] get_photo_url retornou de forma segura: {url}")
except Exception as e:
    raise AssertionError(f"Falha: get_photo_url lançou exceção em vez de tratar: {e}")

# 2. Testar endpoint HTTP /foto-assinada/{id} com ID inexistente
res = client.get(f"/foto-assinada/{dummy_id}")
assert res.status_code == 404, f"Falha: Esperado status 404, mas obteve {res.status_code} ({res.text})"
print(f"[OK] Endpoint /foto-assinada retornou 404 seguro (sem crash 500): {res.json()}")

print("G2_PHOTO_ERROR_HANDLING_PASSED")
