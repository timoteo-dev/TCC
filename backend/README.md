# Backend de Reconhecimento Facial (Merenda)

Este é o serviço FastAPI responsável pelo reconhecimento facial dos alunos, utilizando a biblioteca [InsightFace](https://github.com/deepinsight/insightface) com o modelo `buffalo_l` (SCRFD para detecção e ArcFace para reconhecimento).

## Pré-requisitos
- Python 3.9+
- Dependências de sistema para compilar pacotes (como cmake, build-essential), caso necessário na sua plataforma.

## Como Rodar Localmente

1. Crie um ambiente virtual (recomendado):
   ```bash
   python -m venv venv
   # No Windows:
   venv\Scripts\activate
   # No Linux/Mac:
   source venv/bin/activate
   ```

2. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure as variáveis de ambiente:
   - Copie o `.env.example` para `.env`
   - Preencha os valores do `DATABASE_URL` (banco Supabase), `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

4. Execute o servidor:
   ```bash
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```

5. Acesse `http://127.0.0.1:8000/docs` para ver a interface interativa (Swagger) e testar a API.

## Avisos para Produção

- **Modelos InsightFace**: Os modelos `buffalo_l` possuem licença restrita para uso não-comercial. Se este sistema for comercializado, será necessário trocar os pesos do modelo ou adquirir uma licença comercial.
- **LGPD**: Certifique-se de obter o termo de consentimento dos responsáveis para capturar, armazenar e processar a biometria facial dos alunos. O aplicativo possui a variável `p_consentimento = true` fixada no front; isso exige um documento real assinado.
- **Segurança**: Nunca exponha a porta deste backend diretamente para a internet pública sem restrições ou autenticação. Use TLS/SSL no deploy, e limite o acesso CORS.
- **Storage**: O Supabase precisa ter a chave Service Role configurada no backend para fazer uploads no bucket privado `fotos-alunos`.
