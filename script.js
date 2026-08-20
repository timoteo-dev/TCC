/* ══════════════════════════════════════════════════════════
   MERENDA ESCOLAR — app.js
   Lógica de navegação, pedidos, coordenação, cozinha
   e reconhecimento facial com BlazeFace (TF.js)
   ══════════════════════════════════════════════════════════ */

"use strict";

const SUPABASE_URL = "https://sifhqlbobxaofeypjnhd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZmhxbGJvYnhhb2ZleXBqbmhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMDYzNTIsImV4cCI6MjA5ODY4MjM1Mn0.tECc42Xbmya3s7rafycICTqMQAMIMTjhH3Te7bZRofI";
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function carregarTurmasLogin() {
  const { data, error } = await db
    .from("turmas")
    .select("id, nome")
    .order("nome");

  if (error) {
    console.error("Erro ao carregar turmas no login:", error);
    return;
  }

  const selectTurma = $("input-turma");
  if (selectTurma) {
    const options = data.map(t => `<option value="${t.id}">${t.nome}</option>`).join("");
    selectTurma.innerHTML = `<option value="">Selecione sua turma...</option>` + options;
  }
}

// Chame a função automaticamente quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
  carregarTurmasLogin();
});

/* ── DADOS ───────────────────────────────────────────────── */
const ALL_TURMAS = [
  "1 I01 LCH", "1 I02 LCH", "1 I01 IPI", "1 I01 MCN",
  "2 I01 LCH", "2 I02 LCH", "2 I01 IPI",
  "3 I01 ESP", "3 I02 ESP", "3 I01 IPI", "3 I01 HUM"
];

const STUDENTS = [
  // 1 I01 LCH (Baseado nas telas do Stitch)
  { id: 101, name: "Ana Clara",       turma: "1 I01 LCH", recreio: true,  almoco: true,  initials: "AC" },
  { id: 102, name: "Bento Gonçalves", turma: "1 I01 LCH", recreio: false, almoco: true,  initials: "BG" },
  { id: 103, name: "Carla Ferreira",  turma: "1 I01 LCH", recreio: true,  almoco: false, initials: "CF" },
  { id: 104, name: "Diego Lima",      turma: "1 I01 LCH", recreio: false, almoco: false, initials: "DL" },
  { id: 105, name: "Elena Sousa",     turma: "1 I01 LCH", recreio: true,  almoco: true,  initials: "ES" },
  { id: 106, name: "Fábio Mendes",    turma: "1 I01 LCH", recreio: true,  almoco: false, initials: "FM" },

  // 1 I02 LCH
  { id: 111, name: "Gabriel Souza",   turma: "1 I02 LCH", recreio: true,  almoco: true,  initials: "GS" },
  { id: 112, name: "Helena Ribeiro",  turma: "1 I02 LCH", recreio: true,  almoco: false, initials: "HR" },
  { id: 113, name: "Isabela Martins", turma: "1 I02 LCH", recreio: true,  almoco: true,  initials: "IM" },

  // 1 I01 IPI
  { id: 121, name: "Igor Santos",     turma: "1 I01 IPI", recreio: true,  almoco: true,  initials: "IS" },
  { id: 122, name: "Joana Prado",     turma: "1 I01 IPI", recreio: false, almoco: true,  initials: "JP" },

  // 1 I01 MCN
  { id: 131, name: "Julia Martins",   turma: "1 I01 MCN", recreio: true,  almoco: true,  initials: "JM" },
  { id: 132, name: "Lucas Faria",     turma: "1 I01 MCN", recreio: true,  almoco: false, initials: "LF" },

  // 2 I01 LCH
  { id: 201, name: "Kaio Rocha",      turma: "2 I01 LCH", recreio: true,  almoco: true,  initials: "KR" },
  { id: 202, name: "Letícia Neves",   turma: "2 I01 LCH", recreio: true,  almoco: true,  initials: "LN" },

  // 2 I02 LCH
  { id: 211, name: "Larissa Dias",    turma: "2 I02 LCH", recreio: true,  almoco: true,  initials: "LD" },
  { id: 212, name: "Marcos Vinicius", turma: "2 I02 LCH", recreio: false, almoco: true,  initials: "MV" },

  // 2 I01 IPI
  { id: 221, name: "Mateus Oliveira", turma: "2 I01 IPI", recreio: true,  almoco: true,  initials: "MO" },
  { id: 222, name: "Nathalia Lima",   turma: "2 I01 IPI", recreio: true,  almoco: false, initials: "NL" },

  // 3 I01 ESP
  { id: 311, name: "Natália Dias",    turma: "3 I01 ESP", recreio: true,  almoco: true,  initials: "ND" },
  { id: 312, name: "Otávio Pereira",  turma: "3 I01 ESP", recreio: false, almoco: true,  initials: "OP" },

  // 3 I02 ESP
  { id: 321, name: "Paulo Henrique",  turma: "3 I02 ESP", recreio: true,  almoco: true,  initials: "PH" },
  { id: 322, name: "Rafaela Campos",  turma: "3 I02 ESP", recreio: true,  almoco: false, initials: "RC" },

  // 3 I01 IPI (Incluindo aluno timoteo)
  { id: 301, name: "timoteo",         turma: "3 I01 IPI", recreio: true,  almoco: true,  initials: "TI" },
  { id: 302, name: "Samuel Rezende",  turma: "3 I01 IPI", recreio: true,  almoco: true,  initials: "SR" },
  { id: 303, name: "Tatiane Meireles",turma: "3 I01 IPI", recreio: false, almoco: true,  initials: "TM" },

  // 3 I01 HUM
  { id: 331, name: "Priscila Ramos",  turma: "3 I01 HUM", recreio: true,  almoco: true,  initials: "PR" },
  { id: 332, name: "Victor Hugo",     turma: "3 I01 HUM", recreio: true,  almoco: true,  initials: "VH" }
];

let students = JSON.parse(JSON.stringify(STUDENTS)); // cópia mutável
let currentSelectedTurma = null; // Turma selecionada na coordenação
let studentToReset = null; // Aluno em processo de reset de senha

/* ── ESTADO DE AUTENTICAÇÃO (Bloqueio Estrito) ───────────── */
let isLoggedIn = false;
let loggedInRole = null; // Guarda a única aba permitida após o login

/* ── UTILITÁRIOS ─────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

let toastTimer;
function showToast(msg) {
  const el = $("toast");
  clearTimeout(toastTimer);
  el.textContent = msg;
  el.classList.remove("hidden");
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2800);
}

function formatDate() {
  return new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
}

/* ── NAVEGAÇÃO E CONTROLO DE ACESSO ──────────────────────── */
let activeRole = "aluno";
let facialActive = false;

function goTo(name) {
  if (!name) return;
  
  // Desativa a câmara ao sair da aba facial
  if (facialActive && name !== "facial") stopCamera();

  $$(".screen").forEach(s => s.classList.remove("active"));
  $$(".nav-tab").forEach(b => b.classList.remove("active"));

  const sc = $("screen-" + name);
  const bt = document.querySelector(`.nav-tab[data-screen="${name}"]`);
  if (sc) sc.classList.add("active");
  if (bt) bt.classList.add("active");

  if (name === "coordenacao") renderCoord();
  if (name === "cozinha")     renderCozinha();
}

// Fechar modal de bloqueio
if ($("modal-btn-login")) {
  $("modal-btn-login").addEventListener("click", () => {
    $("modal-backdrop").classList.add("hidden");
    goTo("login");
  });
}

// Abas do Menu de Navegação Superior
$$(".nav-tab").forEach(btn => {
  btn.addEventListener("click", () => goTo(btn.dataset.screen));
});

// Seleção do Perfil na tela de Login
$$(".role-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".role-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeRole = btn.dataset.role;

    // Mostra a escolha de Turma apenas se o perfil selecionado for 'Aluno'
    const groupTurma = $("group-turma");
    const groupEmail = $("group-email");
    if (activeRole === "aluno") {
      groupTurma.classList.remove("hidden");
      groupEmail.classList.add("hidden");
    } else {
      groupTurma.classList.add("hidden");
      groupEmail.classList.remove("hidden");
    }
  });
});

// Lógica de Entrar (Login)
$("btn-login").addEventListener("click", async () => {
  const inputNome = $("input-nome").value.trim();
  const inputSenha = $("input-senha").value.trim();
  const inputTurma = $("input-turma").value;
  const inputEmail = $("input-email").value.trim();

  $("login-error").classList.add("hidden");

  if (activeRole === "aluno") {
    if (!inputNome || !inputSenha || !inputTurma) {
      $("login-error").textContent = "Nome, turma e PIN são obrigatórios.";
      $("login-error").classList.remove("hidden");
      return;
    }

    const { data, error } = await db.rpc("login_aluno_por_pin", {
      p_nome: inputNome,
      p_turma_id: inputTurma,
      p_pin: inputSenha,
    });

    if (error || !data || data.length === 0) {
      $("login-error").textContent = error ? error.message : "Não foi possível entrar.";
      $("login-error").classList.remove("hidden");
      return;
    }

    isLoggedIn = true;
    loggedInRole = "aluno";
    activeRole = "aluno";

    $$(".nav-protected").forEach(tab => {
      if (tab.dataset.screen === loggedInRole) tab.classList.add("unlocked");
      else tab.classList.remove("unlocked");
    });

    const aluno = data[0];
    $("aluno-nome-display").textContent = aluno.nome;
    const nameParts = aluno.nome.split(" ");
    let initials = nameParts[0][0];
    if (nameParts.length > 1) initials += nameParts[nameParts.length - 1][0];
    $("aluno-avatar-display").textContent = initials.toUpperCase();

    showToast(`Bem-vindo(a), ${aluno.nome}!`);
    goTo("aluno");
    return;
  }

  // Coordenação / Cozinha → login real via Supabase Auth
  if (!inputEmail || !inputSenha) {
    $("login-error").textContent = "E-mail e senha são obrigatórios.";
    $("login-error").classList.remove("hidden");
    return;
  }

  const { data: authData, error: authError } = await db.auth.signInWithPassword({
    email: inputEmail,
    password: inputSenha,
  });

  if (authError) {
    $("login-error").textContent = "E-mail ou senha inválidos.";
    $("login-error").classList.remove("hidden");
    return;
  }

  const { data: perfil, error: perfilError } = await db
    .from("perfis")
    .select("papel, nome")
    .eq("id", authData.user.id)
    .single();

  if (perfilError || !perfil) {
    $("login-error").textContent = "Perfil de acesso não encontrado.";
    $("login-error").classList.remove("hidden");
    await db.auth.signOut();
    return;
  }

  const papelPermiteCoordenacao = ["coordenador", "admin"].includes(perfil.papel);
  const papelPermiteCozinha = ["merendeira", "coordenador", "admin"].includes(perfil.papel);

  if (activeRole === "coordenacao" && !papelPermiteCoordenacao) {
    $("login-error").textContent = "Esse usuário não tem acesso à Coordenação.";
    $("login-error").classList.remove("hidden");
    await db.auth.signOut();
    return;
  }
  if (activeRole === "cozinha" && !papelPermiteCozinha) {
    $("login-error").textContent = "Esse usuário não tem acesso à Cozinha.";
    $("login-error").classList.remove("hidden");
    await db.auth.signOut();
    return;
  }

  isLoggedIn = true;
  loggedInRole = activeRole;

  $$(".nav-protected").forEach(tab => {
    if (tab.dataset.screen === loggedInRole) tab.classList.add("unlocked");
    else tab.classList.remove("unlocked");
  });

  showToast(`Bem-vindo(a), ${perfil.nome}!`);
  goTo(loggedInRole);
});

/* ── TELA ALUNO ──────────────────────────────────────────── */
const selectedMeals = { recreio: false, almoco: false };

function updateMealUI() {
  // Atualiza os botões individuais
  ["recreio", "almoco"].forEach(meal => {
    const card = $("meal-" + meal);
    card.classList.toggle("selected", selectedMeals[meal]);
    $("check-" + meal).textContent = selectedMeals[meal] ? "✓" : "";
  });

  // Atualiza o botão de "Ambas as refeições"
  const btnAmbas = $("btn-ambas");
  const checkAmbas = $("ambas-check");
  if (selectedMeals.recreio && selectedMeals.almoco) {
    btnAmbas.classList.add("selected");
    checkAmbas.classList.remove("hidden");
  } else {
    btnAmbas.classList.remove("selected");
    checkAmbas.classList.add("hidden");
  }

  // Atualiza o botão de confirmação
  const btnConfirm = $("btn-confirm-order");
  const any = selectedMeals.recreio || selectedMeals.almoco;
  btnConfirm.disabled = !any;
  btnConfirm.textContent = any ? "Confirmar Pedido" : "Selecione ao menos uma refeição";
}

// Clicks nos cards individuais
["recreio", "almoco"].forEach(meal => {
  $("meal-" + meal).addEventListener("click", () => {
    selectedMeals[meal] = !selectedMeals[meal];
    updateMealUI();
  });
});

// Click no botão de Ambas as refeições
$("btn-ambas").addEventListener("click", () => {
  const turnOn = !(selectedMeals.recreio && selectedMeals.almoco);
  selectedMeals.recreio = turnOn;
  selectedMeals.almoco = turnOn;
  updateMealUI();
});

$("btn-confirm-order").addEventListener("click", () => {
  $("aluno-order-section").classList.add("hidden");
  $("aluno-confirmed").classList.remove("hidden");

  const tags = $("confirmed-tags");
  tags.innerHTML = "";
  if (selectedMeals.recreio) tags.innerHTML += `<span class="cb-tag">🥐 1º Recreio</span>`;
  if (selectedMeals.almoco)  tags.innerHTML += `<span class="cb-tag">🍽️ Almoço</span>`;
  
  showToast("Pedido confirmado com sucesso!");
});

/* ── TELA COORDENAÇÃO (STITCH INTERACTION SYSTEM) ────────── */
function calcStats() {
  const nRecreo  = students.filter(s => s.recreio).length;
  const nAlmoco  = students.filter(s => s.almoco).length;
  const nTotal   = students.filter(s => s.recreio || s.almoco).length;
  const nSem     = students.length - nTotal;
  return { nRecreo, nAlmoco, nTotal, nSem };
}

function selectTurmaCoord(turma) {
  currentSelectedTurma = turma;
  renderCoord();
}

function voltarParaTurmas() {
  currentSelectedTurma = null;
  renderCoord();
}

function renderCoord() {
  if ($("coord-date")) $("coord-date").textContent = formatDate();

  const viewClasses = $("coord-view-classes");
  const viewStudents = $("coord-view-students");

  if (!currentSelectedTurma) {
    // ── MOSTRA VISÃO 1: CARDS DE TURMAS (Stitch Screen 1) ──
    if (viewClasses) viewClasses.classList.remove("hidden");
    if (viewStudents) viewStudents.classList.add("hidden");

    const grid = $("coord-classes-grid");
    if (grid) {
      grid.innerHTML = "";

      ALL_TURMAS.forEach(turma => {
        const alunosDaTurma = students.filter(s => s.turma === turma);
        const countRecreio = alunosDaTurma.filter(s => s.recreio).length;
        const countAlmoco  = alunosDaTurma.filter(s => s.almoco).length;

        const card = document.createElement("div");
        card.className = "coord-class-card";
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute("title", `Clique para ver os alunos da turma ${turma}`);

        card.innerHTML = `
          <div class="coord-card-header">
            <h3 class="coord-class-name">${turma}</h3>
          </div>
          <div class="coord-class-stats">
            <div class="coord-stat-col">
              <svg class="coord-stat-svg" viewBox="0 0 24 24" fill="none" stroke="#2D5A43" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>
                <circle cx="12" cy="12" r="2"/>
              </svg>
              <div class="coord-stat-info">
                <span class="coord-stat-num">${countRecreio}</span>
                <span class="coord-stat-label">RECREIO</span>
              </div>
            </div>
            <div class="coord-stat-col">
              <svg class="coord-stat-svg" viewBox="0 0 24 24" fill="none" stroke="#2D5A43" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 4V2"/>
                <path d="M4 17h16a1 1 0 0 0 1-1A9 9 0 0 0 3 16a1 1 0 0 0 1 1z"/>
                <path d="M2 20h20"/>
              </svg>
              <div class="coord-stat-info">
                <span class="coord-stat-num">${countAlmoco}</span>
                <span class="coord-stat-label">ALMOÇO</span>
              </div>
            </div>
          </div>
        `;

        card.addEventListener("click", () => selectTurmaCoord(turma));
        card.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selectTurmaCoord(turma);
          }
        });

        grid.appendChild(card);
      });
    }

  } else {
    // ── MOSTRA VISÃO 2: LISTA DE ALUNOS DA TURMA (Stitch Screens 2 & 4) ──
    if (viewClasses) viewClasses.classList.add("hidden");
    if (viewStudents) viewStudents.classList.remove("hidden");

    if ($("coord-current-turma-crumb")) {
      $("coord-current-turma-crumb").textContent = `Class ${currentSelectedTurma}`;
    }
    if ($("coord-students-title")) {
      $("coord-students-title").textContent = `Student List – Class ${currentSelectedTurma}`;
    }

    const list = $("coord-students-list");
    if (list) {
      list.innerHTML = "";
      const alunosDaTurma = students.filter(s => s.turma === currentSelectedTurma);

      if (alunosDaTurma.length === 0) {
        list.innerHTML = `
          <div style="text-align:center; padding: 48px 20px; background: #fff; border-radius: 20px; border: 1.5px dashed #d5c8b8; color: #8c7b6d;">
            <p style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Nenhum aluno cadastrado nesta turma ainda.</p>
            <p style="font-size: 14px;">Use o botão "Adicionar Exceção" acima ou cadastre alunos no painel de cadastro.</p>
          </div>
        `;
      } else {
        alunosDaTurma.forEach(a => {
          const row = document.createElement("div");
          row.className = "stitch-student-row";
          row.innerHTML = `
            <div class="stitch-student-left">
              <div class="stitch-avatar">${a.initials}</div>
              <span class="stitch-name">${a.name}</span>
            </div>
            <div class="stitch-actions">
              <button class="stitch-meal-btn ${a.recreio ? "active" : "inactive"}" data-action="recreio" data-id="${a.id}">
                🥐 Recreio
              </button>
              <button class="stitch-meal-btn ${a.almoco ? "active" : "inactive"}" data-action="almoco" data-id="${a.id}">
                🍽️ Almoço
              </button>
              <button class="btn-reset-pin" data-action="senha" data-id="${a.id}">
                Senha
              </button>
            </div>
          `;
          list.appendChild(row);
        });

        // Event listeners para os botões de refeição da linha
        list.querySelectorAll(".stitch-meal-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            const id = parseInt(btn.dataset.id);
            const meal = btn.dataset.action;
            const s = students.find(s => s.id === id);
            if (s) {
              s[meal] = !s[meal];
              showToast(`${s.name}: ${meal === "recreio" ? "Recreio" : "Almoço"} ${s[meal] ? "confirmado" : "desmarcado"}!`);
              renderCoord();
              syncCozinha();
            }
          });
        });

        // Event listener para o botão Senha (Abre Modal de Reset)
        list.querySelectorAll("[data-action='senha']").forEach(btn => {
          btn.addEventListener("click", () => {
            const id = parseInt(btn.dataset.id);
            const s = students.find(s => s.id === id);
            if (s) openResetPinModal(s);
          });
        });

        // Event listener para o botão Confirmar
        list.querySelectorAll("[data-action='confirmar']").forEach(btn => {
          btn.addEventListener("click", () => {
            const id = parseInt(btn.dataset.id);
            const s = students.find(s => s.id === id);
            if (s) {
              showToast(`Presença e refeições confirmadas para ${s.name}! ✅`);
            }
          });
        });
      }
    }
  }
}

// Navegação de retorno às turmas (Breadcrumb & Voltar)
if ($("crumb-to-classes")) $("crumb-to-classes").addEventListener("click", voltarParaTurmas);
if ($("crumb-to-classes-2")) $("crumb-to-classes-2").addEventListener("click", voltarParaTurmas);
if ($("btn-back-classes")) $("btn-back-classes").addEventListener("click", voltarParaTurmas);

/* ── MODAL RESETAR SENHA (Stitch Screen 3) ────────────────── */
function openResetPinModal(student) {
  studentToReset = student;
  if ($("reset-student-name")) $("reset-student-name").textContent = student.name;
  const modal = $("modal-reset-senha");
  if (modal) modal.classList.remove("hidden");
}

function closeResetPinModal() {
  studentToReset = null;
  const modal = $("modal-reset-senha");
  if (modal) modal.classList.add("hidden");
}

if ($("btn-cancel-reset")) $("btn-cancel-reset").addEventListener("click", closeResetPinModal);
const modalResetSenha = $("modal-reset-senha");
if (modalResetSenha) {
  modalResetSenha.addEventListener("click", (e) => {
    if (e.target === modalResetSenha) closeResetPinModal();
  });
}

if ($("btn-confirm-reset")) {
  $("btn-confirm-reset").addEventListener("click", async () => {
    if (studentToReset) {
      const studentName = studentToReset.name;
      // Reset no banco Supabase se aplicável
      try {
        await db.from("alunos")
          .update({ pin_hash: "$2a$06$dw9gR1sO8C0lvMlOLzoKAekYpL.RJozWrAoUCbhcMe2DOxh5uamgq", tentativas_pin: 0, bloqueado_ate: null })
          .ilike("nome", studentName);
      } catch (err) {
        console.log("Nota: Reset local efetuado.", err);
      }

      showToast(`A senha do aluno ${studentName} foi resetada para a senha padrão! 🔑`);
      closeResetPinModal();
    }
  });
}

/* ── LÓGICA DO MODAL ADICIONAR EXCEÇÃO (Stitch Screens 5 & 6) ─ */
function abrirModalExcecao() {
  const modal = $("modal-excecao");
  if (modal) modal.classList.remove("hidden");
}

function fecharModalExcecao() {
  const modal = $("modal-excecao");
  if (modal) modal.classList.add("hidden");
  
  const f1 = $("form-excecao-interno");
  const f2 = $("form-excecao-externo");
  if (f1) f1.reset();
  if (f2) f2.reset();
}

// Botão de abrir no painel da coordenação
if ($("btn-add-excecao")) {
  $("btn-add-excecao").addEventListener("click", abrirModalExcecao);
}

// Fechar modal
["btn-close-excecao", "btn-cancel-excecao-1", "btn-cancel-excecao-2"].forEach(id => {
  const btn = $(id);
  if (btn) btn.addEventListener("click", fecharModalExcecao);
});

// Fechar clicando no fundo escuro
const modalExcecao = $("modal-excecao");
if (modalExcecao) {
  modalExcecao.addEventListener("click", (e) => {
    if (e.target === modalExcecao) fecharModalExcecao();
  });
}

// Troca de Abas (Aluno Interno vs Aluno de Outra Escola)
const tabInterno = $("tab-aluno-interno");
const tabExterno = $("tab-aluno-externo");
const formInterno = $("form-excecao-interno");
const formExterno = $("form-excecao-externo");

if (tabInterno && tabExterno) {
  tabInterno.addEventListener("click", () => {
    tabInterno.classList.add("active");
    tabExterno.classList.remove("active");
    if (formInterno) formInterno.classList.remove("hidden");
    if (formExterno) formExterno.classList.add("hidden");
  });

  tabExterno.addEventListener("click", () => {
    tabExterno.classList.add("active");
    tabInterno.classList.remove("active");
    if (formExterno) formExterno.classList.remove("hidden");
    if (formInterno) formInterno.classList.add("hidden");
  });
}

// Submissão Opção 1: Aluno da Escola (Interno)
if (formInterno) {
  formInterno.addEventListener("submit", (e) => {
    e.preventDefault();
    const turma = $("exc-turma").value;
    const nome = $("exc-nome-interno").value.trim();
    const mealChoice = document.querySelector('input[name="exc-meal-interno"]:checked')?.value || "recreio";

    if (!turma || !nome) {
      showToast("Por favor, selecione a turma e digite o nome do aluno.");
      return;
    }

    const recreio = mealChoice === "recreio" || mealChoice === "ambos";
    const almoco  = mealChoice === "almoco"  || mealChoice === "ambos";

    // Cria as iniciais do aluno
    const parts = nome.split(" ");
    let initials = parts[0][0];
    if (parts.length > 1) initials += parts[parts.length - 1][0];
    initials = initials.toUpperCase();

    // Verifica se aluno já existe na lista
    let existing = students.find(s => s.name.toLowerCase() === nome.toLowerCase() && s.turma === turma);
    if (existing) {
      existing.recreio = recreio;
      existing.almoco = almoco;
    } else {
      const newStudent = {
        id: Date.now(),
        name: nome,
        turma: turma,
        recreio: recreio,
        almoco: almoco,
        initials: initials
      };
      students.push(newStudent);
    }

    showToast(`Exceção confirmada para ${nome} (${turma})! ✨`);
    renderCoord();
    syncCozinha();
    fecharModalExcecao();
  });
}

// Submissão Opção 2: Aluno de Outra Escola (Externo / Visitante)
if (formExterno) {
  formExterno.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = $("exc-nome-externo").value.trim();
    const escola = $("exc-escola-externa").value.trim();
    const refeicaoDesc = $("exc-refeicao-externa").value.trim();

    if (!nome || !escola || !refeicaoDesc) {
      showToast("Por favor, preencha todos os campos do aluno visitante.");
      return;
    }

    // Cria as iniciais do visitante
    const parts = nome.split(" ");
    let initials = parts[0][0];
    if (parts.length > 1) initials += parts[parts.length - 1][0];
    initials = initials.toUpperCase();

    // Adiciona como aluno visitante de outra escola
    const newVisitor = {
      id: Date.now(),
      name: `${nome} [🏫 ${escola}] - ${refeicaoDesc}`,
      turma: "1 I01 LCH", // atrela à turma atual ou externa
      recreio: true,
      almoco: true,
      initials: initials
    };
    students.push(newVisitor);

    showToast(`Exceção cadastrada para ${nome} (${escola})! ✨`);
    renderCoord();
    syncCozinha();
    fecharModalExcecao();
  });
}

/* ── TELA COZINHA ────────────────────────────────────────── */
function renderCozinha() {
  const dateStr = new Date().toLocaleDateString("pt-BR", { day:"numeric", month:"short", year:"numeric" });
  if ($("cz-date")) $("cz-date").textContent = formatDate();
  if ($("cz-chip-date")) $("cz-chip-date").textContent = dateStr;
  syncCozinha();
}

function syncCozinha() {
  const { nRecreo, nAlmoco } = calcStats();
  if ($("cz-recreio")) $("cz-recreio").textContent = nRecreo;
  if ($("cz-almoco")) $("cz-almoco").textContent = nAlmoco;
  const cozinhaWrap = document.querySelector(".cozinha-wrap");
  if (cozinhaWrap) cozinhaWrap.dataset.total = nRecreo + nAlmoco;

  if ($("stat-recreio")) {
    const { nRecreo: nr, nAlmoco: na, nTotal: nt, nSem: ns } = calcStats();
    $("stat-recreio").textContent = nr;
    $("stat-almoco").textContent  = na;
    $("stat-total").textContent   = nt;
    $("stat-sem").textContent     = ns;
  }
}

/* ══════════════════════════════════════════════════════════
   RECONHECIMENTO FACIAL — BlazeFace + TensorFlow.js
   ══════════════════════════════════════════════════════════ */

let tfModel    = null;
let camStream  = null;
let rafId      = null;
let scanDone   = false;
let firstFaceAt = null;

const VIDEO  = $("cam-video");
const CANVAS = $("cam-canvas");
const CTX    = CANVAS.getContext("2d");

$("btn-cam-on").addEventListener("click", () => initFacial());
$("btn-cam-off").addEventListener("click", () => stopCamera());

function setStatus(dot, text) {
  $("fs-dot").className = "fs-dot " + dot;
  $("fs-text").textContent = text;
}

function showOverlay(show, msg = "") {
  if (show) {
    $("cam-overlay").classList.remove("hidden");
    $("cam-msg").textContent = msg;
  } else {
    $("cam-overlay").classList.add("hidden");
  }
}

function stopCamera() {
  facialActive = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  
  // Desliga todas as faixas (tracks) da câmara de forma segura
  if (camStream) { 
    camStream.getTracks().forEach(t => t.stop()); 
    camStream = null; 
  }
  
  VIDEO.srcObject = null; // Limpa o vídeo do elemento HTML
  CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);
  
  showOverlay(true, "Câmara pausada. Pressione 'Ligar Câmara' para iniciar.");
  setStatus("gray", "Câmara desativada");

  $("btn-cam-on").disabled = false;
  $("btn-cam-off").disabled = true;
}

async function initFacial() {
  if (facialActive) return;
  facialActive = true;
  scanDone = false;
  firstFaceAt = null;

  $("id-result").classList.add("hidden");
  showOverlay(true, "A aguardar permissão e a ligar a câmara...");
  setStatus("gray", "A iniciar...");
  
  // Desativa o botão de ligar para evitar cliques duplos que bloqueiam a câmara
  $("btn-cam-on").disabled = true; 

  try {
    // 1. Tenta aceder à câmara
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
    });

    VIDEO.srcObject = camStream;
    await new Promise(res => { VIDEO.onloadedmetadata = res; });
    await VIDEO.play();

    setStatus("gray", "A carregar Inteligência Artificial...");
    
    // 2. Tenta carregar o modelo de reconhecimento (BlazeFace)
    if (!tfModel) {
      if (typeof blazeface === "undefined") {
        throw new Error("A biblioteca BlazeFace não foi encontrada. Verifique sua conexão e recarregue a página.");
      }
      // Aproveita o modelo pré-carregado no início da página, se disponível
      tfModel = window._blazefaceModelPromise
        ? await window._blazefaceModelPromise
        : await blazeface.load();

      if (!tfModel) {
        throw new Error("Falha ao carregar o modelo de IA. Recarregue a página e tente novamente.");
      }
    }

    // Se chegou até aqui, tudo correu bem! Remove a tela escura e liberta o botão de desligar.
    showOverlay(false);
    setStatus("gray", "Posicione o rosto do aluno na câmara");
    $("btn-cam-off").disabled = false;

    startDetectionLoop();

  } catch (err) {
    console.error(err);
    
    // CORREÇÃO: Se deu erro na IA, força o desligamento da câmara fisicamente
    // para que não fique a rodar invisível atrás da tela preta de erro.
    if (camStream) {
      camStream.getTracks().forEach(t => t.stop());
      camStream = null;
    }
    VIDEO.srcObject = null;

    // Define a mensagem exata do erro
    let msg = "Erro ao iniciar a câmara ou a IA.";
    if (err.name === "NotAllowedError") {
      msg = "Permissão negada. Autorize o uso da câmara no topo do navegador.";
    } else if (location.protocol === 'file:') {
      msg = "Os navegadores bloqueiam a IA ao abrir o ficheiro diretamente. Utilize a extensão 'Live Server' no VS Code.";
    } else {
      msg = err.message;
    }

    // Aplica o estado de erro
    showOverlay(true, msg);
    setStatus("gray", "Câmara indisponível");
    facialActive = false;
    
    // Devolve o controlo para o utilizador tentar novamente
    $("btn-cam-on").disabled = false;
    $("btn-cam-off").disabled = true;
  }
}

function startDetectionLoop() {
  scanDone    = false;
  firstFaceAt = null;

  async function detect() {
    if (!facialActive || scanDone) return;

    const video = VIDEO;
    if (!video || !tfModel || video.readyState < 2) {
      rafId = requestAnimationFrame(detect);
      return;
    }

    if (CANVAS.width  !== video.videoWidth)  CANVAS.width  = video.videoWidth;
    if (CANVAS.height !== video.videoHeight) CANVAS.height = video.videoHeight;
    CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);

    try {
      const predictions = await tfModel.estimateFaces(video, false);

      if (predictions.length > 0) {
        const face = predictions[0];
        const [x1, y1] = face.topLeft;
        const [x2, y2] = face.bottomRight;
        const w = x2 - x1;
        const h = y2 - y1;
        const c = Math.min(w, h) * 0.22;

        drawFaceBox(x1, y1, x2, y2, w, h, c);

        if (!firstFaceAt) {
          firstFaceAt = Date.now();
          setStatus("yellow", "A identificar aluno...");
        }

        const elapsed = Date.now() - firstFaceAt;
        const progress = Math.min(elapsed / 2600, 1);
        drawProgressBar(x1, y2 + 8, w, progress);

        if (elapsed > 2600 && !scanDone) {
          scanDone = true;
          drawSuccess(x1, y1, w, h);
          // Simula a identificação do primeiro aluno
          setTimeout(() => showIdentified(students[0]), 200);
          return;
        }

      } else {
        firstFaceAt = null;
        CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);
        setStatus("gray", "Posicione o rosto do aluno na câmara");
      }
    } catch (_) { /* frame skip */ }

    rafId = requestAnimationFrame(detect);
  }

  rafId = requestAnimationFrame(detect);
}

/* ── FUNÇÕES DE DESENHO ──────────────────────────────────── */
function drawFaceBox(x1, y1, x2, y2, w, h, c) {
  CTX.strokeStyle = "#4ADE80";
  CTX.lineWidth   = 3;
  CTX.lineCap     = "round";
  CTX.beginPath();
  CTX.moveTo(x1 + c, y1); CTX.lineTo(x1, y1); CTX.lineTo(x1, y1 + c);
  CTX.moveTo(x2 - c, y1); CTX.lineTo(x2, y1); CTX.lineTo(x2, y1 + c);
  CTX.moveTo(x2, y2 - c); CTX.lineTo(x2, y2); CTX.lineTo(x2 - c, y2);
  CTX.moveTo(x1 + c, y2); CTX.lineTo(x1, y2); CTX.lineTo(x1, y2 - c);
  CTX.stroke();

  const t   = (Date.now() % 1800) / 1800;
  const sy  = y1 + h * t;
  const grad = CTX.createLinearGradient(x1, sy - 12, x1, sy + 12);
  grad.addColorStop(0,   "rgba(74,222,128,0)");
  grad.addColorStop(0.5, "rgba(74,222,128,0.5)");
  grad.addColorStop(1,   "rgba(74,222,128,0)");
  CTX.fillStyle = grad;
  CTX.fillRect(x1, sy - 12, w, 24);
}

function drawProgressBar(x, y, w, progress) {
  CTX.fillStyle = "rgba(255,255,255,0.15)";
  CTX.beginPath();
  CTX.roundRect(x, y, w, 5, 3);
  CTX.fill();

  CTX.fillStyle = "#4ADE80";
  CTX.beginPath();
  CTX.roundRect(x, y, w * progress, 5, 3);
  CTX.fill();
}

function drawSuccess(x1, y1, w, h) {
  CTX.fillStyle = "rgba(74,222,128,0.15)";
  CTX.fillRect(x1, y1, w, h);
  setStatus("green", "Aluno identificado com sucesso");
}

/* ── RESULTADO DA IDENTIFICAÇÃO ──────────────────────────── */
function showIdentified(student) {
  const box = $("id-result");
  $("ir-avatar").textContent  = student.initials;
  $("ir-name").textContent    = student.name;
  $("ir-turma").textContent   = `Turma ${student.turma} · Ensino Médio`;

  $("ir-meals").innerHTML = `
    <span class="ir-tag ${student.recreio ? "sim" : "nao"}">
      🥐 1º Recreio — ${student.recreio ? "pediu" : "não pediu"}
    </span>
    <span class="ir-tag ${student.almoco ? "sim" : "nao"}">
      🍽️ Almoço — ${student.almoco ? "pediu" : "não pediu"}
    </span>
  `;

  box.classList.remove("hidden");
}

$("btn-next-scan").addEventListener("click", () => {
  $("id-result").classList.add("hidden");
  CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);
  scanDone    = false;
  firstFaceAt = null;
  setStatus("gray", "Posicione o rosto do aluno na câmara");
  startDetectionLoop();
});

/* ── INICIALIZAÇÃO ───────────────────────────────────────── */
(function init() {
  if ($("cz-date")) $("cz-date").textContent = formatDate();
  if ($("cz-chip-date")) $("cz-chip-date").textContent = new Date().toLocaleDateString("pt-BR", { day:"numeric", month:"short", year:"numeric" });
  syncCozinha();
})();