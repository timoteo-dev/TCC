    -- ==============================================================================
-- MIGRAÇÃO: Separação da Biometria Facial da Tabela de Alunos
-- ==============================================================================
-- 1. Habilita a extensão pgvector para processamento de embeddings vetoriais
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Criação da tabela dedicada de biometria facial
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

-- 3. Índices para performance
-- 3.1 Índice na chave estrangeira para otimização de JOINs e deleções em cascata
CREATE INDEX IF NOT EXISTS idx_alunos_biometria_aluno_id 
    ON public.alunos_biometria_facial(aluno_id);

-- 3.2 Índice vetorial HNSW usando distância de cosseno para busca rápida de similaridade
CREATE INDEX IF NOT EXISTS idx_alunos_biometria_embedding 
    ON public.alunos_biometria_facial USING hnsw (embedding vector_cosine_ops);

-- 4. Migração de dados existentes da tabela alunos (caso existam registros legados)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'alunos' 
          AND column_name = 'embedding'
    ) THEN
        INSERT INTO public.alunos_biometria_facial (aluno_id, face_descriptor, embedding, model_version)
        SELECT 
            id AS aluno_id,
            CASE 
                WHEN face_descriptor IS NOT NULL THEN to_jsonb(face_descriptor)
                ELSE NULL 
            END AS face_descriptor,
            embedding,
            COALESCE(model_version, 'buffalo_s') AS model_version
        FROM public.alunos
        WHERE (embedding IS NOT NULL OR face_descriptor IS NOT NULL)
        ON CONFLICT (aluno_id, model_version) DO UPDATE
        SET embedding = EXCLUDED.embedding,
            face_descriptor = EXCLUDED.face_descriptor,
            updated_at = now();
    END IF;
END $$;

-- 5. Remoção das colunas legadas da tabela alunos
ALTER TABLE public.alunos
    DROP COLUMN IF EXISTS face_descriptor,
    DROP COLUMN IF EXISTS embedding,
    DROP COLUMN IF EXISTS model_version;

-- 6. Configuração de Segurança e RLS (Row Level Security)
ALTER TABLE public.alunos_biometria_facial ENABLE ROW LEVEL SECURITY;

-- Política para leitura/escrita do serviço autenticado e backend service_role
CREATE POLICY "Permitir gerenciamento total para service_role e autenticados" 
    ON public.alunos_biometria_facial
    FOR ALL
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Permissões de schema/tabela
GRANT ALL ON TABLE public.alunos_biometria_facial TO authenticated, service_role;
GRANT SELECT ON TABLE public.alunos_biometria_facial TO anon;

-- 7. Criação do bucket privado para fotos (caso ainda não exista)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-alunos', 'fotos-alunos', false)
ON CONFLICT (id) DO NOTHING;
