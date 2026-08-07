"use strict";

/* ══════════════════════════════════════════════════════
   CONFIGURAÇÃO SUPABASE
   ══════════════════════════════════════════════════════ */
const SUPABASE_URL = "https://sifhqlbobxaofeypjnhd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZmhxbGJvYnhhb2ZleXBqbmhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMDYzNTIsImV4cCI6MjA5ODY4MjM1Mn0.tECc42Xbmya3s7rafycICTqMQAMIMTjhH3Te7bZRofI";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── UTILS ───────────────────────────────────────────── */
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

let toastTimer;
function toast(msg, tipo = "success") {
  const el = $("toast");
  clearTimeout(toastTimer);
  el.textContent = msg;
  el.className = `toast ${tipo}`;
  el.classList.remove("hidden");
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3000);
}

function initials(nome) {
  const parts = nome.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function gerarSenha() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function setLoading(btnTxt, btnLoader, btn, on) {
  $(btnTxt).classList.toggle("hidden", on);
  $(btnLoader).classList.toggle("hidden", !on);
  $(btn).disabled = on;
}

/* ══ TABS ════════════════════════════════════════════════ */
$$(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach(t => t.classList.remove("active"));
    $$(".tab-panel").forEach(p => p.classList.add("hidden"));
    tab.classList.add("active");
    $(`panel-${tab.dataset.tab}`).classList.remove("hidden");
    if (tab.dataset.tab === "lista") carregarListaAlunos();
    if (tab.dataset.tab === "sistema") carregarUsuariosSistema();
  });
});

/* ══ TURMAS — carrega nos selects ════════════════════════ */
async function carregarTurmas() {
  const { data, error } = await db
    .from("turmas")
    .select("id, nome")
    .order("nome");

  if (error) { toast("Erro ao carregar turmas", "error"); return; }

  const opts = data.map(t => `<option value="${t.id}">${t.nome}</option>`).join("");
  $("aluno-turma").innerHTML = `<option value="">Selecione a turma...</option>` + opts;

  const filterOpts = data.map(t => `<option value="${t.id}">${t.nome}</option>`).join("");
  $("filter-turma").innerHTML = `<option value="">Todas as turmas</option>` + filterOpts;
}

/* ══ TOTAL DE ALUNOS ════════════════════════════════════ */
async function atualizarTotal() {
  const { count } = await db
    .from("alunos")
    .select("*", { count: "exact", head: true })
    .eq("ativo", true);
  $("total-alunos").textContent = count ?? "—";
}

/* ══ CADASTRO DE ALUNO ══════════════════════════════════ */
let ultimosCadastrados = [];

$("btn-gerar-senha").addEventListener("click", () => {
  $("aluno-senha").value = gerarSenha();
});

$("btn-salvar-aluno").addEventListener("click", async () => {
  const nome    = $("aluno-nome").value.trim();
  const turmaId = $("aluno-turma").value;
  const senha   = $("aluno-senha").value.trim();
  const errEl   = $("aluno-error");

  errEl.classList.add("hidden");
  $("aluno-nome").classList.remove("error");
  $("aluno-turma").classList.remove("error");
  $("aluno-senha").classList.remove("error");

  if (!nome || !turmaId || !senha) {
    errEl.textContent = "Preencha todos os campos antes de salvar.";
    errEl.classList.remove("hidden");
    if (!nome)    $("aluno-nome").classList.add("error");
    if (!turmaId) $("aluno-turma").classList.add("error");
    if (!senha)   $("aluno-senha").classList.add("error");
    return;
  }
  if (senha.length < 6) {
    errEl.textContent = "A senha deve ter ao menos 6 caracteres.";
    errEl.classList.remove("hidden");
    $("aluno-senha").classList.add("error");
    return;
  }

  setLoading("btn-aluno-txt", "btn-aluno-loader", "btn-salvar-aluno", true);

  // Gera uma matrícula simples (não há campo próprio no formulário ainda)
  const matricula = `AL${Date.now().toString().slice(-8)}`;

  const { data, error } = await db.rpc("cadastrar_aluno", {
    p_nome: nome,
    p_turma_id: turmaId,
    p_matricula: matricula,
    p_pin: senha,
  });

  setLoading("btn-aluno-txt", "btn-aluno-loader", "btn-salvar-aluno", false);

  if (error) {
    errEl.textContent = "Erro ao salvar. Verifique se você está logado como Coordenação/Secretaria.";
    errEl.classList.remove("hidden");
    console.log(error)
    return;
  }

  const turmaEl   = $("aluno-turma");
  const turmaNome = turmaEl.options[turmaEl.selectedIndex].text;

  $("aluno-nome").value  = "";
  $("aluno-senha").value = "";
  $("aluno-turma").value = "";
  $("aluno-nome").focus();

  ultimosCadastrados.unshift({ nome, turmaNome });
  if (ultimosCadastrados.length > 6) ultimosCadastrados.pop();
  renderUltimos();
  atualizarTotal();

  toast(`${nome} cadastrado com sucesso!`);
});

function renderUltimos() {
  const el = $("ultimos-lista");
  if (ultimosCadastrados.length === 0) {
    el.innerHTML = `<p class="empty-hint">Nenhum cadastro ainda.</p>`;
    return;
  }
  el.innerHTML = ultimosCadastrados.map(a => `
    <div class="ultimo-item">
      <div class="ui-av">${initials(a.nome)}</div>
      <div>
        <div class="ui-nome">${a.nome}</div>
        <div class="ui-turma">${a.turmaNome}</div>
      </div>
    </div>
  `).join("");
}

/* ══ CADASTRO DE USUÁRIO DO SISTEMA ════════════════════ */
let perfilAtivo = "coordenacao";

$$(".perfil-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".perfil-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    perfilAtivo = btn.dataset.perfil;
  });
});

$("btn-gerar-sys").addEventListener("click", () => {
  $("sys-senha").value = gerarSenha();
});

$("btn-salvar-sys").addEventListener("click", async () => {
  const nome  = $("sys-nome").value.trim();
  const senha = $("sys-senha").value.trim();
  const errEl = $("sys-error");

  errEl.classList.add("hidden");

  if (!nome || !senha) {
    errEl.textContent = "Preencha nome e senha antes de salvar.";
    errEl.classList.remove("hidden");
    return;
  }
  if (senha.length < 6) {
    errEl.textContent = "A senha deve ter ao menos 6 caracteres.";
    errEl.classList.remove("hidden");
    return;
  }

  setLoading("btn-sys-txt", "btn-sys-loader", "btn-salvar-sys", true);

  const { error } = await db
    .from("usuarios_sistema")
    .insert({ nome, perfil: perfilAtivo, senha_hash: senha });

  setLoading("btn-sys-txt", "btn-sys-loader", "btn-salvar-sys", false);

  if (error) {
    errEl.textContent = "Erro ao salvar usuário.";
    errEl.classList.remove("hidden");
    return;
  }

  $("sys-nome").value  = "";
  $("sys-senha").value = "";
  carregarUsuariosSistema();
  toast(`${nome} cadastrado como ${perfilAtivo}!`);
});

// ✅ CORRIGIDO: função restaurada para buscar usuarios_sistema corretamente
async function carregarUsuariosSistema() {
  const { data, error } = await db
    .from("usuarios_sistema")
    .select("id, nome, perfil")
    .order("nome");

  const el = $("sys-lista");
  if (error || !data?.length) {
    el.innerHTML = `<p class="empty-hint">Nenhum usuário cadastrado.</p>`;
    return;
  }

  el.innerHTML = data.map(u => `
    <div class="sys-item">
      <div class="sys-av ${u.perfil === 'cozinha' ? 'cozinha' : ''}">${initials(u.nome)}</div>
      <div class="sys-info">
        <div class="sys-nome">${u.nome}</div>
        <div class="sys-perfil">${u.perfil}</div>
      </div>
      <span class="sys-badge ${u.perfil === 'cozinha' ? 'coz' : 'coord'}">
        ${u.perfil === 'cozinha' ? 'Cozinha' : 'Coord.'}
      </span>
    </div>
  `).join("");
}

/* ══ LISTA DE ALUNOS ════════════════════════════════════ */
let todosAlunos = [];
let alunoParaDeletar = null;

async function carregarListaAlunos() {
  const { data, error } = await db
    .from("alunos")
    .select("id, nome, ativo, turmas(id, nome)")
    .order("nome");

  if (error) {
    $("alunos-tbody").innerHTML = `<tr><td colspan="5" class="table-empty">Erro ao carregar alunos.</td></tr>`;
    return;
  }

  todosAlunos = data;
  renderTabela(data);
}

function renderTabela(lista) {
  const tbody = $("alunos-tbody");
  $("lista-count").textContent = `${lista.length} alunos`;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Nenhum aluno encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map((a, i) => `
    <tr>
      <td class="td-num">${i + 1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="td-av">${initials(a.nome)}</div>
          <span class="td-nome">${a.nome}</span>
        </div>
      </td>
      <td><span class="badge-turma">${a.turmas?.nome ?? '—'}</span></td>
      <td><span class="badge-ativo">Ativo</span></td>
      <td>
        <button class="table-action" data-id="${a.id}" data-nome="${a.nome}">Remover</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".table-action").forEach(btn => {
    btn.addEventListener("click", () => {
      alunoParaDeletar = { id: parseInt(btn.dataset.id), nome: btn.dataset.nome };
      $("modal-del-nome").textContent = `O aluno "${alunoParaDeletar.nome}" será removido do sistema.`;
      $("modal-del").classList.remove("hidden");
    });
  });
}

$("search-aluno").addEventListener("input", filtrar);
$("filter-turma").addEventListener("change", filtrar);

function filtrar() {
  const busca   = $("search-aluno").value.toLowerCase();
  const turmaId = $("filter-turma").value;

  const filtrado = todosAlunos.filter(a => {
    const nomeBate  = a.nome.toLowerCase().includes(busca);
    const turmaBate = !turmaId || String(a.turmas?.id) === turmaId;
    return nomeBate && turmaBate;
  });

  renderTabela(filtrado);
}

$("modal-cancel").addEventListener("click", () => {
  $("modal-del").classList.add("hidden");
  alunoParaDeletar = null;
});

$("modal-confirm").addEventListener("click", async () => {
  if (!alunoParaDeletar) return;

  const { error } = await db
    .from("alunos")
    .update({ ativo: false })
    .eq("id", alunoParaDeletar.id);

  $("modal-del").classList.add("hidden");

  if (error) { toast("Erro ao remover aluno.", "error"); return; }

  toast(`${alunoParaDeletar.nome} removido.`);
  alunoParaDeletar = null;
  carregarListaAlunos();
  atualizarTotal();
});

/* ══ INICIALIZAÇÃO ══════════════════════════════════════ */
(async function init() {
  await carregarTurmas();
  await atualizarTotal();
  $("header-user").textContent = "Coordenação";
  $("aluno-nome").focus();
})();