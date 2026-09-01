-- Habilita a extensão pgvector para trabalhar com embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Criação da tabela dedicada de biometria facial
CREATE TABLE IF NOT EXISTS public.alunos_biometria_facial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
    face_descriptor JSONB,
    embedding vector(512),
    model_version TEXT NOT NULL DEFAULT 'buffalo_s',
    foto_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_alunos_biometria_aluno_model UNIQUE (aluno_id, model_version)
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_alunos_biometria_aluno_id 
    ON public.alunos_biometria_facial(aluno_id);

CREATE INDEX IF NOT EXISTS idx_alunos_biometria_embedding 
    ON public.alunos_biometria_facial USING hnsw (embedding vector_cosine_ops);

-- RLS e Permissões
ALTER TABLE public.alunos_biometria_facial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir gerenciamento total para service_role e autenticados" 
    ON public.alunos_biometria_facial
    FOR ALL
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);

GRANT ALL ON TABLE public.alunos_biometria_facial TO authenticated, service_role;
GRANT SELECT ON TABLE public.alunos_biometria_facial TO anon;

-- Cria o bucket privado para armazenar as fotos (miniaturas geradas no backend)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-alunos', 'fotos-alunos', false)
ON CONFLICT (id) DO NOTHING;
