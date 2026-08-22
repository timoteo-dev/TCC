-- Habilita a extensão pgvector para trabalhar com embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Adiciona colunas para armazenar a face e a versão do modelo (ex: buffalo_l)
ALTER TABLE public.alunos
ADD COLUMN IF NOT EXISTS embedding vector(512),
ADD COLUMN IF NOT EXISTS model_version text;

-- Cria o bucket privado para armazenar as fotos (miniaturas geradas no backend)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-alunos', 'fotos-alunos', false)
ON CONFLICT (id) DO NOTHING;

-- Por ser false (privado), usuários anon/authenticated não possuem acesso por padrão
-- O backend usará a SUPABASE_SERVICE_ROLE_KEY para realizar uploads e gerar URLs assinadas.
-- Portanto, políticas extras de RLS não são estritamente necessárias para o uso do frontend,
-- já que o service_role bypassa RLS.
