import sys
import os
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath("backend"))
from main import app, storage

client = TestClient(app)

# 1. Testar método delete_aluno da camada de storage com ID de teste
test_aluno_id = "test-delete-check-12345"
try:
    storage.delete_aluno(test_aluno_id)
    print(f"[OK] storage.delete_aluno executou com sucesso para {test_aluno_id}")
except Exception as e:
    raise AssertionError(f"Falha ao chamar storage.delete_aluno: {e}")

# 2. Testar chamada HTTP DELETE /aluno/{id}
res = client.delete(f"/aluno/{test_aluno_id}")
assert res.status_code == 200, f"Falha: Esperado status 200, mas obteve {res.status_code}: {res.text}"
data = res.json()
assert data.get("status") == "success", f"Resposta inesperada: {data}"
assert data.get("deleted_id") == test_aluno_id, f"ID deletado inesperado: {data}"
print(f"[OK] Endpoint DELETE /aluno/{test_aluno_id} respondeu: {data}")

print("G3_DELETE_ENDPOINT_PASSED")
