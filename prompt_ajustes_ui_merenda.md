# Prompt Técnico — Ajustes de UI no Sistema "Merenda"

## Contexto
Sistema web "Merenda", área de **Coordenação > Gestão Facial > Registro Facial**.
Referências visuais em anexo: 3 prints de tela do fluxo atual.

---

## Tarefa 1 — Remover "Exceções" do dropdown de turma

**Onde:** Tela "Registro Facial", campo "1. SELECIONE A TURMA".

**Problema atual:** A opção "Exceções" aparece misturada na lista de turmas do select
(com destaque visual diferente — fundo azul), mas na verdade é uma ação que abre o
modal "Adicionar Exceção de Merenda", não uma turma de fato.

**Ação:**
1. Remover o item "Exceções" da lista de opções do dropdown de turmas.
2. **Importante:** criar um ponto de acesso alternativo para o modal "Adicionar Exceção
   de Merenda", já que ele hoje só é acessado por esse item do select. Sugestão: um
   botão próprio (ex.: "+ Exceção de Merenda") posicionado ao lado do card ou no menu
   de Coordenação, mantendo o comportamento atual do modal intacto.

**Critério de aceite:** o select passa a listar apenas turmas reais; a funcionalidade
de exceção continua acessível por outro caminho e o modal abre normalmente.

---

## Tarefa 2 — Renomear "1º Recreio" para "Lanche"

**Onde:** Modal "Adicionar Exceção de Merenda", grupo de opções "REFEIÇÃO DESEJADA".

**Ação:**
1. Alterar o rótulo exibido de "1º Recreio" para "Lanche".
2. Manter as demais opções ("Almoço", "Ambas") e o comportamento de seleção inalterados.
3. Verificar se o valor interno enviado/salvo (value/key usado em banco, API ou
   relatórios) precisa ser atualizado também, ou se basta trocar o texto exibido —
   confirmar se há outras telas (cozinha, relatórios) que dependem dessa string exata
   para não quebrar consistência.

**Critério de aceite:** a opção exibe "Lanche", o restante do fluxo do modal funciona
como antes, e nenhuma outra tela do sistema quebra por causa da troca de rótulo.

---

## Tarefa 3 — Corrigir texto órfão na tela "Registro Facial"

**Onde:** Tela "Registro Facial", estado inicial (antes de selecionar turma/aluno).

**Problema atual:** Abaixo do card principal aparece um texto solto e sem estilização:
"2 Confirmar identidade" e "3 Pronto" — indício de um stepper (indicador de etapas
1/2/3) que está sendo renderizado fora do layout/container correto.
*(O círculo azul nos prints é apenas uma marcação de referência para localizar o
problema — não faz parte da interface real.)*

**Ação — escolher uma das duas opções, conforme padrão de design já usado no projeto:**
- **Opção A (recomendada):** reposicionar esse conteúdo como um stepper de verdade,
  visível e estilizado, no topo do card, mostrando as etapas "1. Selecione a turma →
  2. Confirmar identidade → 3. Pronto" — consistente com o padrão numerado já usado
  no campo "1. SELECIONE A TURMA".
- **Opção B (mínima):** remover completamente esse bloco de texto solto, caso não haja
  intenção de manter indicador de progresso nesta versão.

**Critério de aceite:** não deve haver texto sem estilização/fora de posição na tela;
o layout final deve estar visualmente consistente com o restante da página.

---

## Checklist geral de QA
- [ ] Dropdown de turma não lista mais "Exceções"
- [ ] Existe novo caminho funcional para abrir "Adicionar Exceção de Merenda"
- [ ] Opção "Lanche" aparece corretamente no modal e submete o valor esperado
- [ ] Nenhum texto solto/sem estilo aparece na tela "Registro Facial"
- [ ] Nenhuma regressão visual nas três telas envolvidas
