import insightface
from insightface.app import FaceAnalysis

print("Baixando modelo buffalo_l para cache da nuvem...")
# Isso força o download do modelo para ~/.insightface/models/buffalo_l
app = FaceAnalysis(name='buffalo_s')
app.prepare(ctx_id=-1, det_size=(640, 640))
print("Download concluído!")
