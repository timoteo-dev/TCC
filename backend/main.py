import os
import io
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import psycopg2
from pgvector.psycopg2 import register_vector
from supabase import create_client, Client
import insightface
from insightface.app import FaceAnalysis
from scipy.spatial.distance import cosine

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.36"))
MODEL_NAME = 'buffalo_s'

app = FastAPI(title="Reconhecimento Facial API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializa o InsightFace
face_app = FaceAnalysis(name=MODEL_NAME)
face_app.prepare(ctx_id=0, det_size=(640, 640))

# --- Storage Layer ---
class MemoryStorage:
    def __init__(self):
        self.embeddings = {} # aluno_id: embedding
        
    def save_embedding(self, aluno_id: int, embedding: np.ndarray, model_version: str):
        self.embeddings[aluno_id] = embedding
        
    def get_all_embeddings(self, turma_id: str = None):
        return self.embeddings
        
    def save_photo(self, aluno_id: int, photo_bytes: bytes):
        pass # Ignorado em memória
        
    def get_photo_url(self, aluno_id: int):
        return None

class SupabaseStorage:
    def __init__(self):
        self.conn = psycopg2.connect(DATABASE_URL)
        register_vector(self.conn)
        if SUPABASE_URL and SUPABASE_KEY:
            self.sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        else:
            self.sb = None
            
    def save_embedding(self, aluno_id: int, embedding: np.ndarray, model_version: str):
        with self.conn.cursor() as cur:
            cur.execute("""
                UPDATE alunos
                SET embedding = %s, model_version = %s
                WHERE id = %s
            """, (embedding, model_version, aluno_id))
        self.conn.commit()
        
    def get_all_embeddings(self, turma_id: str = None):
        with self.conn.cursor() as cur:
            if turma_id:
                cur.execute("SELECT id, embedding FROM alunos WHERE embedding IS NOT NULL AND model_version = %s AND turma_id = %s", (MODEL_NAME, turma_id))
            else:
                cur.execute("SELECT id, embedding FROM alunos WHERE embedding IS NOT NULL AND model_version = %s", (MODEL_NAME,))
            rows = cur.fetchall()
            return {row[0]: row[1] for row in rows}
            
    def save_photo(self, aluno_id: int, photo_bytes: bytes):
        if not self.sb: return
        file_path = f"{aluno_id}.jpg"
        # Deleta se existir para sobrescrever
        try:
            self.sb.storage.from_("fotos-alunos").remove([file_path])
        except:
            pass
        self.sb.storage.from_("fotos-alunos").upload(file_path, photo_bytes, {"content-type": "image/jpeg"})
        
    def get_photo_url(self, aluno_id: int):
        if not self.sb: return None
        file_path = f"{aluno_id}.jpg"
        res = self.sb.storage.from_("fotos-alunos").create_signed_url(file_path, 300) # 5 minutos
        if isinstance(res, dict) and "signedURL" in res:
            return res["signedURL"]
        return res

storage = SupabaseStorage() if DATABASE_URL else MemoryStorage()

# --- Funções Auxiliares ---
def get_largest_face(image: np.ndarray):
    faces = face_app.get(image)
    if not faces:
        return None
    # Maior rosto por área da bbox
    return max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))

def compress_image(image: np.ndarray) -> bytes:
    h, w = image.shape[:2]
    if max(h, w) > 160:
        scale = 160 / max(h, w)
        image = cv2.resize(image, (int(w * scale), int(h * scale)))
    _, buf = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 60])
    return buf.tobytes()

# --- Endpoints ---
@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/enroll")
async def enroll(aluno_id: int = Form(...), file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Imagem inválida")
        
    face = get_largest_face(img)
    if face is None:
        raise HTTPException(status_code=400, detail="Nenhum rosto encontrado na foto")
        
    embedding = face.embedding
    storage.save_embedding(aluno_id, embedding, MODEL_NAME)
    
    # Gera e salva a miniatura
    compressed = compress_image(img)
    storage.save_photo(aluno_id, compressed)
    
    return {"status": "success", "aluno_id": aluno_id}

@app.post("/identify")
async def identify(file: UploadFile = File(...), turma_id: str = Form(None)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Imagem inválida")
        
    face = get_largest_face(img)
    if face is None:
        return {"match": False}
        
    query_emb = face.embedding
    
    # Se estivéssemos usando pgvector para tudo no banco, faríamos uma query:
    # SELECT id FROM alunos ORDER BY embedding <=> %s LIMIT 1
    # Para simplicidade e atender aos dois storages (Memory/Supabase):
    all_embeddings = storage.get_all_embeddings(turma_id=turma_id)
    if not all_embeddings:
        return {"match": False}
        
    best_match = None
    best_sim = -1
    
    for a_id, emb in all_embeddings.items():
        sim = 1 - cosine(query_emb, emb) # similaridade cosseno
        if sim > best_sim:
            best_sim = sim
            best_match = a_id
            
    if best_sim > THRESHOLD:
        return {"match": True, "aluno_id": best_match, "score": float(best_sim)}
        
    return {"match": False, "score": float(best_sim)}

@app.get("/foto-assinada/{aluno_id}")
def get_foto(aluno_id: int):
    url = storage.get_photo_url(aluno_id)
    if url:
        return {"url": url}
    raise HTTPException(status_code=404, detail="Foto não encontrada ou Supabase não configurado")
