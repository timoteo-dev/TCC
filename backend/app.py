import os
import gradio as gr
from main import app, storage, MODEL_NAME

# Obtém o nome amigável do storage para exibição
is_fs = "FirestoreStorage" in type(storage).__name__
is_sb = "SupabaseStorage" in type(storage).__name__
storage_name = "Firebase Firestore" if is_fs else ("Supabase (PostgreSQL)" if is_sb else "Local (Cache)")

with gr.Blocks(title="API Merenda Facial") as demo:
    gr.Markdown("# 🍽️ API de Reconhecimento Facial — Merenda Escolar")
    gr.Markdown(
        f"""
        ### 🟢 Servidor Ativo (Hugging Face Spaces)
        - **Status:** Operacional
        - **Hardware:** 16 GB RAM (CPU Basic)
        - **Banco Conectado:** {storage_name}
        - **Modelo de IA:** InsightFace (`{MODEL_NAME}`)
        
        ---
        #### Endpoints da API Prontos para Uso no Frontend:
        - `POST /identify` — Reconhecimento facial de alunos em tempo real
        - `POST /enroll` — Cadastro de biometria facial
        - `GET /health` — Verificação de saúde da API
        - `DELETE /aluno/{{id}}` — Exclusão de aluno e biometria
        """
    )

# Monta o Gradio mantendo todas as rotas originais do FastAPI (/identify, /enroll, etc.)
app = gr.mount_gradio_app(app, demo, path="/")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
