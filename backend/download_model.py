import os
import insightface
from insightface.app import FaceAnalysis

models_root = os.path.join(os.path.dirname(__file__), "insightface_models")
print("Verificando modelos locais buffalo_s (detecção e reconhecimento)...")
app = FaceAnalysis(name='buffalo_s', root=models_root, allowed_modules=['detection', 'recognition'])
app.prepare(ctx_id=-1, det_size=(640, 640))
print("Modelos verificados e prontos!")

