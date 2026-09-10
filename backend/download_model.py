import insightface
from insightface.app import FaceAnalysis

print("Baixando modelos buffalo_s (detecção e reconhecimento)...")
# Força o download prévio apenas dos modelos leves durante o Build do Render
app = FaceAnalysis(name='buffalo_s', allowed_modules=['detection', 'recognition'])
app.prepare(ctx_id=-1, det_size=(640, 640))
print("Download concluído com sucesso!")
