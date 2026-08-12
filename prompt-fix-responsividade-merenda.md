# Prompt: Corrigir responsividade da tela de login (projeto "Merenda")

## Papel
Você é um desenvolvedor front-end sênior, especialista em CSS Grid/Flexbox e design responsivo mobile-first. Antes de escrever qualquer código, você diagnostica a causa raiz — nunca aplica patches cosméticos que escondem o sintoma sem resolver o problema estrutural.

## Contexto do bug
A tela de login do projeto "Merenda" quebra em viewports mobile (testado em 430×932, iPhone 15 Pro Max). Estrutura DOM relevante:

```
section#screen-login.screen.active
  div.login-wrap (display: grid)
    div.login-left
    div.login-right (position: relative; z-index: 1;)
```

Sintomas observados no viewport mobile:
1. O texto de boas-vindas ("Bem-vindo...") aparece cortado na lateral do card.
2. Há um vazamento visual de cor/imagem de fundo por trás do card branco, indicando que `.login-left` e `.login-right` estão se sobrepondo em vez de empilhar verticalmente.
3. Existe uma media query em `max-width: 760px` que altera `min-height` e `padding` de `.login-right`, mas **não** redefine `grid-template-columns`/`grid-template-areas` do `.login-wrap`.

## Hipótese a validar (não assumir como verdade)
O layout foi construído em grid de 2 colunas pensado para desktop, com sobreposição proposital do card sobre a imagem/hero. A media query mobile ajustou espaçamentos internos, mas não reestruturou o grid para empilhar as colunas em telas estreitas — causando corte de texto e sobreposição indevida de elementos.

## Tarefas obrigatórias, nesta ordem

1. **Inspecionar antes de alterar:**
   - Ler o CSS completo de `.login-wrap`, `.login-left`, `.login-right` (incluindo todas as media queries existentes, não só as visíveis no DevTools).
   - Verificar se existe `<meta name="viewport" content="width=device-width, initial-scale=1">` no `<head>`.
   - Verificar se algum ancestral tem `overflow: hidden`/`overflow-x: hidden` mascarando overflow real.
   - Confirmar a hipótese acima com evidência do código (grid-template-columns atual, valores de z-index, position).

2. **Diagnosticar a causa raiz** e descrever em 2-3 frases o que realmente está quebrando (pode ser diferente da hipótese acima — se for, explique o que encontrou).

3. **Corrigir com abordagem mobile-first**, seguindo estas regras:
   - Abaixo do breakpoint (ex.: `max-width: 760px`), o grid deve empilhar `.login-left` acima de `.login-right` em uma única coluna (`grid-template-columns: 1fr` ou `grid-template-areas` redefinida), a menos que a sobreposição seja intencional — nesse caso, garantir que nenhum texto seja cortado e que o card tenha `max-width`/`width: 100%` compatível com o viewport.
   - Nenhum elemento pode causar overflow horizontal na página (testar sem scrollbar lateral).
   - Evitar larguras/paddings fixos que não escalem; preferir `clamp()`, `%`, ou unidades relativas já usadas no projeto.
   - Não remover o efeito visual de sobreposição do design (card flutuando sobre imagem) se ele for intencional no desktop — apenas adaptá-lo para não quebrar no mobile.
   - Manter compatibilidade com os breakpoints existentes no projeto (não inventar breakpoints novos sem necessidade).

4. **Testar a correção** nos seguintes viewports antes de considerar concluído:
   - 375×667 (iPhone SE)
   - 390×844 (iPhone 12/13)
   - 430×932 (iPhone 15 Pro Max — o caso reportado)
   - 768×1024 (tablet)
   - Confirmar visualmente que não há corte de texto, sobreposição indevida, nem scroll horizontal em nenhum desses.

## Formato da resposta esperada
- Diagnóstico da causa raiz (curto, com evidência do código).
- Diff do CSS alterado (antes/depois), com comentário explicando por que cada mudança resolve o problema.
- Lista de viewports testados e resultado de cada um.
- Se a hipótese inicial estiver errada, explicar o que foi encontrado de fato.

## Critério de aceite
A tela de login deve renderizar sem cortes de texto, sem sobreposição indevida entre `.login-left` e `.login-right`, e sem overflow horizontal, em todos os viewports listados acima — mantendo o visual pretendido em desktop intacto.
