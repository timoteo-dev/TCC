import sys
import os
import cv2
import numpy as np

sys.path.append(os.path.abspath("backend"))
from main import is_valid_human_face, get_largest_face

# 1. Teste de controle positivo com foto real
test_img_path = os.path.join("backend", "fotos_salvas", "44c85097-41a4-494b-8905-e71920ed6270.jpg")
assert os.path.exists(test_img_path), f"Foto de teste não encontrada: {test_img_path}"
img = cv2.imread(test_img_path)
face = get_largest_face(img, min_det_score=0.65, min_face_size=35)
assert face is not None, "Falha: Rosto humano real legítimo foi rejeitado pelo detector!"
assert face.det_score >= 0.65, f"Score abaixo do esperado: {face.det_score}"
print(f"[OK] Controle positivo aprovado: Rosto humano detectado com score {face.det_score:.4f}")

# 2. Teste de controle negativo com imagem aleatória / ruído
noise_img = np.random.randint(0, 255, (300, 300, 3), dtype=np.uint8)
no_face = get_largest_face(noise_img)
assert no_face is None, "Falha: Ruído gerou falsa detecção positiva!"
print("[OK] Controle negativo aprovado: Ruído rejeitado com sucesso.")

# 3. Teste de anatomia invertida (olhos abaixo da boca)
class MockFace:
    def __init__(self, det_score, bbox, kps):
        self.det_score = det_score
        self.bbox = bbox
        self.kps = kps

inverted_kps = np.array([
    [50, 80],   # left_eye (abaixo do nariz)
    [90, 80],   # right_eye (abaixo do nariz)
    [70, 50],   # nose
    [50, 30],   # left_mouth (acima do nariz)
    [90, 30]    # right_mouth (acima do nariz)
])
mock_inverted = MockFace(0.95, [30, 20, 110, 100], inverted_kps)
assert not is_valid_human_face(mock_inverted, min_det_score=0.65, min_face_size=35), "Falha: Anatomia invertida foi aceita!"
print("[OK] Controle anatômico aprovado: Face com marcos invertidos rejeitada.")

# 4. Teste de pontuação de confiança fraca (ex: boneco / pelúcia com score 0.45)
mock_weak = MockFace(0.45, [30, 20, 110, 100], None)
assert not is_valid_human_face(mock_weak, min_det_score=0.65, min_face_size=35), "Falha: Score fraco foi aceito!"
print("[OK] Controle de confiança aprovado: Score fraco (0.45) rejeitado.")

print("G1_FACE_VALIDATION_PASSED")
