 rodando dentro da pasta do repositório (branch `Timotio`).

<context>
Este é o repositório `timoteo-dev/TCC` (branch `Timotio`), um sistema web de
controle de merenda escolar: front-end estático (HTML/CSS/JS puro, sem
framework/bundler) + Supabase (Postgres) como backend de dados. Telas
principais: `index.html` (login, aluno, coordenação, cozinha, reconhecimento
facial — toda a lógica em `script.js`) e `tela.html` (cadastro de alunos —
lógica em `tela.js`), com estilos em `merenda.css` e `tela.css`.

A tela de "Reconhecimento Facial" hoje só faz DETECÇÃO (TensorFlow.js +
BlazeFace, desenha a caixa verde ao redor do rosto). Depois de ~2,6s com um
rosto detectado, o código atual chama `showIdentified(students[0])` — ou
seja, é um mock que sempre "reconhece" o primeiro aluno da lista local
`STUDENTS`. Não existe identificação real de quem é a pessoa.

O cadastro de aluno (`tela.js`, função que trata o clique em
`btn-salvar-aluno`) hoje insere `{ nome, turma_id, senha, ativo }` na tabela
`alunos` do Supabase — sem foto.
</context>

<objective>
Substituir o mock por reconhecimento facial de verdade usando InsightFace
(ArcFace), mantendo a arquitetura atual (front-end estático + Supabase) e
adicionando um serviço Python novo só para a parte de reconhecimento.
</objective>

<architecture_decisions>
Estas decisões já foram validadas e testadas (rode com elas, não redesenhe
do zero):

1. **Novo serviço backend em Python (pasta `backend/`)**: FastAPI + InsightFace
   (pacote de modelos `buffalo_l`, que já embute detector SCRFD + reconhecedor
   ArcFace, embedding de 512 dimensões). Dois endpoints principais:
   - `POST /enroll` — recebe `file` (foto) + `aluno_id`, extrai o embedding do
     maior rosto encontrado, salva.
   - `POST /identify` — recebe `file` (frame da câmera), compara contra a
     galeria de embeddings via similaridade de cosseno, retorna o `aluno_id`
     mais próximo se a similaridade passar de um limiar (padrão `0.36`,
     configurável por env var `FACE_MATCH_THRESHOLD`), ou `match: false`.
   - Camada de storage plugável: `MemoryStorage` (padrão, dev/teste, em RAM)
     e `SupabaseStorage` (ativa quando `DATABASE_URL` está setado — conecta
     direto no Postgres do Supabase via `psycopg2` + extensão `pgvector`,
     **não** via PostgREST).
   - CORS liberado para o front-end poder chamar via `fetch`.

2. **Banco (Supabase)**: extensão `pgvector` habilitada; tabela `alunos`
   ganha as colunas `embedding vector(512)` e `model_version text` (guardar
   a versão do modelo evita comparar embeddings de motores diferentes no
   futuro).

3. **Front-end**:
   - `tela.html`/`tela.js`: adicionar captura de foto (via
     `navigator.mediaDevices.getUserMedia`) no formulário de cadastro de
     aluno. Foto é opcional (aluno pode ser salvo sem foto, só não terá
     reconhecimento automático). Depois que o `insert` do aluno retorna o
     `id`, enviar a foto para `POST {FACE_BACKEND_URL}/enroll`.
   - `script.js`: no ponto exato onde hoje roda
     `setTimeout(() => showIdentified(students[0]), 200)`, capturar o frame
     atual do `<video>` como blob e chamar `POST {FACE_BACKEND_URL}/identify`.
     Se `match === true`, buscar os dados reais do aluno no Supabase
     (`nome`, turma via join) e chamar `showIdentified(...)` com eles. Se
     `match === false`, mostrar um estado de "rosto não reconhecido" (sem
     travar a tela).
   - `FACE_BACKEND_URL` deve ser uma constante configurável no topo dos dois
     arquivos JS (padrão `http://127.0.0.1:8000` para dev local).

4. **Extra (se o tempo permitir): foto do aluno na tela da Coordenação**
   Trocar o círculo de iniciais (`<div class="s-avatar">${a.initials}</div>`
   em `renderCoord()`, `script.js`) pela foto do aluno, com fallback para as
   iniciais quando não houver foto.
   - **Não reusar a foto de cadastro em alta resolução aqui.** Gerar uma
     miniatura pequena e comprimida (ex.: 160px, JPEG qualidade ~0.6) no
     momento do cadastro, guardar num bucket **privado** do Supabase Storage
     (`fotos-alunos`). Motivo: a foto de alta qualidade usada no embedding é
     material bom demais para um ataque de apresentação contra a própria
     câmera de reconhecimento (o pipeline não tem liveness detection); expor
     ela numa tela de uso comum (coordenação) aumenta essa superfície de
     ataque desnecessariamente.
   - Servir a miniatura via URL assinada de curta duração (5 min), gerada por
     um endpoint novo no backend (`GET /foto-assinada/{aluno_id}`) que usa a
     `SUPABASE_SERVICE_ROLE_KEY` — essa chave nunca vai para o front-end.
</architecture_decisions>

<constraints>
- Não trocar o stack existente (continua vanilla JS + Supabase no front).
- Não quebrar o fluxo de cadastro/identificação quando o backend estiver
  fora do ar — falhar de forma graciosa (toast de aviso), nunca travar a UI.
- Manter compatibilidade com o cadastro sem foto (fallback para iniciais).
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` em nenhum arquivo servido ao
  navegador (`tela.js`, `script.js`, `index.html`, `tela.html`).
- Comentários e mensagens de UI em português, no mesmo tom do código
  existente (ex.: mensagens de `toast(...)`).
</constraints>

<tasks>
Siga nesta ordem, e depois de cada etapa rode alguma forma de verificação
antes de seguir para a próxima (não acumule mudanças não testadas):

1. Leia `index.html`, `script.js`, `tela.html`, `tela.js`, `merenda.css` por
   inteiro para confirmar nomes de funções, IDs de elementos e convenções
   antes de editar (não assuma nomes — confira).
2. Crie `backend/main.py`, `backend/requirements.txt`, `backend/.env.example`
   conforme `<architecture_decisions>`. Instale as dependências e suba o
   servidor localmente. Teste `GET /health`, um `POST /enroll` com uma
   imagem de rosto qualquer (pode gerar uma imagem de teste sintética ou
   usar uma imagem de amostra que já venha com a biblioteca InsightFace) e
   um `POST /identify` correspondente — confirme que o `match` retorna
   correto antes de seguir.
3. Crie a migração SQL (`supabase/migration_pgvector.sql`) com a extensão
   `pgvector`, as colunas novas em `alunos`, e (se for fazer a etapa 5) a
   criação do bucket `fotos-alunos` + policies de storage.
4. Edite `tela.html` e `tela.js` para a captura de foto + chamada ao
   `/enroll`. Rode um linter/`node --check tela.js` para garantir que não
   quebrou a sintaxe.
5. Edite `script.js` para a chamada real ao `/identify` no lugar do mock.
   Rode `node --check script.js`.
6. (Extra) Implemente a foto na tela da coordenação conforme descrito, com
   o endpoint `/foto-assinada` e a miniatura comprimida.
7. Escreva um `README.md` dentro de `backend/` explicando como rodar, quais
   env vars configurar, e o que falta para produção (deploy do backend,
   consentimento LGPD dos responsáveis, licença dos modelos `buffalo_l` para
   uso não comercial vs. produção).
</tasks>

<acceptance_criteria>
- `uvicorn backend.main:app` sobe sem erro e `/health` responde `200`.
- Um `enroll` seguido de um `identify` com a mesma pessoa retorna
  `match: true` com score acima do limiar; com pessoa diferente, retorna
  `match: false`.
- Nenhum arquivo front-end contém a `SUPABASE_SERVICE_ROLE_KEY`.
- O cadastro de aluno sem foto continua funcionando normalmente.
- `node --check` passa em todos os `.js` alterados.
</acceptance_criteria>

Antes de começar a codar, me mostre um plano curto (bullet points) do que
você vai fazer e em que ordem, para eu confirmar antes de você tocar nos
arquivos.
