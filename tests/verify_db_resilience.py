import sys
import os
import psycopg2

sys.path.append(os.path.abspath("backend"))
from main import SupabaseStorage, LocalPersistentStorage, storage

# Testar o mecanismo de retry em _execute
class MockConn:
    def __init__(self):
        self.closed = 0
        self.call_count = 0

    def cursor(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def execute(self, sql, params=None):
        self.call_count += 1
        if self.call_count == 1:
            # Simula desconexão abrupta na 1ª tentativa
            raise psycopg2.OperationalError("Simulated connection drop by server")
        # 2ª tentativa tem sucesso
        return True

    def commit(self):
        pass

    def rollback(self):
        pass

# Instancia temporária de teste para simular o comportamento de _execute
class TestStorage(SupabaseStorage):
    def __init__(self):
        self.conn = None
        self.sb = None
        self.mock = MockConn()

    def get_conn(self):
        return self.mock

dummy_storage = TestStorage()
attempts = []

def test_operation(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT 1")
    attempts.append(True)
    return "success"

result = dummy_storage._execute(test_operation)
assert result == "success", f"Falha: Esperado sucesso após reconexão, obteve {result}"
assert len(attempts) == 1, f"Falha: Operação deveria ter sido executada com sucesso após retry"
print("[OK] Mecanismo de auto-reconnect e retry absorveu queda de conexão com sucesso.")

print("G4_DB_RESILIENCE_PASSED")
