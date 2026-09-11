import os
import io
import json
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import psycopg2
from pgvector.psycopg2 import register_vector
from supabase import create_client, Client
import insightface
from insightface.app import FaceAnalysis
from scipy.spatial.distance import cosine

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    DATABASE_URL = DATABASE_URL.strip()

SUPABASE_URL = os.getenv("SUPABASE_URL")
if SUPABASE_URL:
    SUPABASE_URL = SUPABASE_URL.strip().replace("/rest/v1/", "").replace("/rest/v1", "").rstrip("/")

SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if SUPABASE_KEY:
    SUPABASE_KEY = SUPABASE_KEY.strip()

THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.33").strip())
MODEL_NAME = 'buffalo_s'

app = FastAPI(title="Reconhecimento Facial API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

photos_dir = os.path.join(os.path.dirname(__file__), "fotos_salvas")
os.makedirs(photos_dir, exist_ok=True)
app.mount("/fotos-locais", StaticFiles(directory=photos_dir), name="fotos-locais")

# Inicializa o InsightFace com os modelos leves locais (economiza ~85% de RAM e NÃO baixa zip de 125MB no Render)
models_root = os.path.join(os.path.dirname(__file__), "insightface_models")
face_app = FaceAnalysis(name=MODEL_NAME, root=models_root, allowed_modules=['detection', 'recognition'])
face_app.prepare(ctx_id=-1, det_size=(640, 640))

# --- Storage Layer ---
class LocalPersistentStorage:
    def __init__(self, data_file="embeddings_cache.npz", photos_dir="fotos_salvas"):
        self.data_file = os.path.join(os.path.dirname(__file__), data_file)
        self.photos_dir = os.path.join(os.path.dirname(__file__), photos_dir)
        os.makedirs(self.photos_dir, exist_ok=True)
        self.embeddings = {} # aluno_id: embedding
        self._load()
        
    def _load(self):
        if os.path.exists(self.data_file):
            try:
                data = np.load(self.data_file, allow_pickle=True)
                self.embeddings = {k: data[k] for k in data.files}
                print(f"[Storage Local] {len(self.embeddings)} biometrias faciais carregadas do cache em disco.")
            except Exception as e:
                print(f"[Storage Local] Erro ao ler cache: {e}")

    def _save(self):
        try:
            np.savez_compressed(self.data_file, **self.embeddings)
        except Exception as e:
            print(f"[Storage Local] Erro ao persistir cache: {e}")

    def save_embedding(self, aluno_id: str, embedding: np.ndarray, model_version: str):
        self.embeddings[str(aluno_id)] = embedding
        self._save()
        
    def get_all_embeddings(self, turma_id: str = None):
        return self.embeddings
        
    def save_photo(self, aluno_id: str, photo_bytes: bytes):
        file_path = os.path.join(self.photos_dir, f"{aluno_id}.jpg")
        try:
            with open(file_path, "wb") as f:
                f.write(photo_bytes)
        except Exception as e:
            print(f"[Storage Local] Erro ao salvar miniatura: {e}")
        
    def get_photo_url(self, aluno_id: str):
        file_path = os.path.join(self.photos_dir, f"{aluno_id}.jpg")
        if os.path.exists(file_path):
            return f"/fotos-locais/{aluno_id}.jpg"
        return None

class SupabaseStorage:
    def __init__(self):
        self.conn = None
        self._connect()
        if SUPABASE_URL and SUPABASE_KEY:
            self.sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        else:
            self.sb = None
            
    def _connect(self):
        try:
            self.conn = psycopg2.connect(DATABASE_URL)
            register_vector(self.conn)
        except Exception as e:
            print(f"[Supabase Storage] Erro ao conectar banco: {e}")
            self.conn = None
            
    def get_conn(self):
        if self.conn is None or self.conn.closed != 0:
            self._connect()
        else:
            try:
                self.conn.rollback() # Limpa qualquer transação abortada anterior
            except Exception:
                self._connect()
        return self.conn
            
    def save_embedding(self, aluno_id: str, embedding: np.ndarray, model_version: str):
        conn = self.get_conn()
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE alunos
                SET embedding = %s, model_version = %s
                WHERE id = %s
            """, (embedding, model_version, aluno_id))
        conn.commit()
        
    def get_all_embeddings(self, turma_id: str = None):
        conn = self.get_conn()
        with conn.cursor() as cur:
            if turma_id and turma_id != "todas":
                cur.execute("SELECT id, embedding FROM alunos WHERE embedding IS NOT NULL AND model_version = %s AND turma_id = %s", (MODEL_NAME, turma_id))
            else:
                cur.execute("SELECT id, embedding FROM alunos WHERE embedding IS NOT NULL AND model_version = %s", (MODEL_NAME,))
            rows = cur.fetchall()
            result = {}
            for row in rows:
                a_id, emb = row[0], row[1]
                if emb is None:
                    continue
                if hasattr(emb, "to_numpy"):
                    emb = emb.to_numpy()
                elif isinstance(emb, np.ndarray):
                    pass
                elif isinstance(emb, str):
                    try:
                        emb = np.array(json.loads(emb), dtype=np.float32)
                    except Exception:
                        emb = np.fromstring(emb.strip("[]"), sep=",", dtype=np.float32)
                else:
                    try:
                        emb = np.array(emb, dtype=np.float32)
                    except Exception:
                        continue
                result[a_id] = emb
            return result
            
    def save_photo(self, aluno_id: str, photo_bytes: bytes):
        if not self.sb: return
        file_path = f"{aluno_id}.jpg"
        # Deleta se existir para sobrescrever
        try:
            self.sb.storage.from_("fotos-alunos").remove([file_path])
        except:
            pass
        try:
            self.sb.storage.from_("fotos-alunos").upload(file_path, photo_bytes, {"content-type": "image/jpeg"})
        except Exception as e:
            print(f"[Supabase Storage] Aviso: Falha ao salvar arquivo no bucket ({e})")
        
    def get_photo_url(self, aluno_id: str):
        if not self.sb: return None
        file_path = f"{aluno_id}.jpg"
        res = self.sb.storage.from_("fotos-alunos").create_signed_url(file_path, 300) # 5 minutos
        if isinstance(res, dict) and "signedURL" in res:
            return res["signedURL"]
        return res

try:
    if DATABASE_URL:
        storage = SupabaseStorage()
        print("[Storage] Conectado ao PostgreSQL/Supabase com sucesso.")
    else:
        storage = LocalPersistentStorage()
        print("[Storage] DATABASE_URL não definida. Usando LocalPersistentStorage.")
except Exception as e:
    print(f"[Storage] AVISO: Falha ao conectar ao banco de dados Supabase ({e}).")
    print("[Storage] Ativando fallback para LocalPersistentStorage para manter a API online.")
    storage = LocalPersistentStorage()

@app.get("/")
def read_root():
    is_sb = isinstance(storage, SupabaseStorage)
    return {
        "status": "online",
        "service": "API Reconhecimento Facial Merenda",
        "storage": "Supabase (PostgreSQL)" if is_sb else "Local (Cache)"
    }


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
async def enroll(aluno_id: str = Form(...), file: UploadFile = File(...)):
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
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Imagem inválida")
            
        face = get_largest_face(img)
        if face is None:
            return {"match": False, "face_detected": False, "reason": "no_face"}
            
        query_emb = face.embedding
        
        # 1. Busca primeiro na turma filtrada (se informada)
        all_embeddings = {}
        if turma_id and turma_id != "todas":
            all_embeddings = storage.get_all_embeddings(turma_id=turma_id)
            
        # 2. Se a turma filtrada não possui biometrias, busca todas
        if not all_embeddings:
            all_embeddings = storage.get_all_embeddings(turma_id=None)
            
        if not all_embeddings:
            return {"match": False, "face_detected": True, "reason": "no_enrolled_faces"}
            
        best_match = None
        best_sim = -1.0
        
        for a_id, emb in all_embeddings.items():
            try:
                sim = 1.0 - float(cosine(query_emb, emb)) # similaridade cosseno
                if sim > best_sim:
                    best_sim = sim
                    best_match = a_id
            except Exception as e:
                print(f"[Cosine Error] Erro ao comparar aluno {a_id}: {e}")
                continue
                
        # Se não bateu o threshold com a turma filtrada, tenta em todas as turmas
        if best_sim < THRESHOLD and turma_id and turma_id != "todas":
            all_global = storage.get_all_embeddings(turma_id=None)
            for a_id, emb in all_global.items():
                if a_id not in all_embeddings:
                    try:
                        sim = 1.0 - float(cosine(query_emb, emb))
                        if sim > best_sim:
                            best_sim = sim
                            best_match = a_id
                    except Exception:
                        continue
                        
        print(f"[Identify] Match: {best_match}, Score: {best_sim:.4f} (Threshold: {THRESHOLD})")
        
        if best_sim >= THRESHOLD and best_match:
            return {"match": True, "face_detected": True, "aluno_id": best_match, "score": float(best_sim)}
            
        return {"match": False, "face_detected": True, "score": float(best_sim), "reason": "below_threshold"}
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        print(f"[Identify Error Traceback]\n{err_msg}")
        return {"match": False, "face_detected": False, "error": str(e), "traceback": err_msg}

@app.get("/foto-assinada/{aluno_id}")
def get_foto(aluno_id: str, request: Request):
    url = storage.get_photo_url(aluno_id)
    if url:
        if url.startswith("/"):
            base_url = str(request.base_url).rstrip("/")
            return {"url": f"{base_url}{url}"}
        return {"url": url}
    raise HTTPException(status_code=404, detail="Foto não encontrada ou Supabase não configurado")
