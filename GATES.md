# Gates: Auditoria e Hardening do Backend e Reconhecimento Facial

OWNS: backend/**, script.js, GATES.md

Scope: Auditoria profunda, correção de falhas de robustez/conexão e validação 100% testada do backend e reconhecimento facial.

- [x] G1: Validação anatômica e filtro de confiança no detector facial (is_valid_human_face)
  CHECK: backend\venv\Scripts\python.exe tests/verify_face_validation.py
  EXPECT: G1_FACE_VALIDATION_PASSED
  EVIDENCE: Processo finalizou com código 0. Controle positivo aprovado com score 0.7751, controle negativo de ruído rejeitado, controle de anatomia com olhos invertidos rejeitado e score fraco rejeitado.

- [x] G2: Prevenção de erro 500 no endpoint de foto assinada quando foto não existir
  CHECK: backend\venv\Scripts\python.exe tests/verify_photo_error_handling.py
  EXPECT: G2_PHOTO_ERROR_HANDLING_PASSED
  EVIDENCE: Processo finalizou com código 0. Chamada de foto inexistente no storage retorna None de forma segura e rota HTTP /foto-assinada/{id} retorna 404 seguro em vez de falha 500.

- [x] G3: Endpoint e persistência de exclusão atômica de aluno (DELETE /aluno/{id})
  CHECK: backend\venv\Scripts\python.exe tests/verify_delete_endpoint.py
  EXPECT: G3_DELETE_ENDPOINT_PASSED
  EVIDENCE: Processo finalizou com código 0. Chamada storage.delete_aluno executada com sucesso e endpoint DELETE /aluno respondeu status 200 com {'status': 'success', 'deleted_id': test_aluno_id}.

- [x] G4: Resiliência de conexão PostgreSQL (auto-reconnect e retry automático contra idle timeout)
  CHECK: backend\venv\Scripts\python.exe tests/verify_db_resilience.py
  EXPECT: G4_DB_RESILIENCE_PASSED
  EVIDENCE: Processo finalizou com código 0. Queda de conexão simulada via OperationalError foi absorvida na tentativa 1, reconectando e executando a operação com sucesso.

- [x] G5: Suíte completa de testes de ponta a ponta do backend (compilação, rotas e detecção)
  CHECK: backend\venv\Scripts\python.exe tests/verify_e2e_backend.py
  EXPECT: G5_E2E_SUITE_PASSED
  EVIDENCE: Processo finalizou com código 0. Rotas /health (200), / (200), /identify sem rosto (match: False, 200), /enroll sem rosto (400 com mensagem amigável) e /identify com rosto real validado com score de 0.8618.
