/* ══════════════════════════════════════════════════════════
   MERENDA ESCOLAR — app.js
   Lógica de navegação, pedidos, coordenação, cozinha
   e reconhecimento facial com BlazeFace (TF.js)
   ══════════════════════════════════════════════════════════ */

"use strict";

const SUPABASE_URL = "https://sifhqlbobxaofeypjnhd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZmhxbGJvYnhhb2ZleXBqbmhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMDYzNTIsImV4cCI6MjA5ODY4MjM1Mn0.tECc42Xbmya3s7rafycICTqMQAMIMTjhH3Te7bZRofI";
const FACE_BACKEND_URL = "http://127.0.0.1:8000";
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
  
  const selectTurmaCad = $("cad-aluno-turma");
  if (selectTurmaCad) {
    const options = data.map(t => `<option value="${t.id}">${t.nome}</option>`).join("");
    selectTurmaCad.innerHTML = `<option value="" disabled selected>Selecione a turma...</option>` + options;
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
  "3 I01 ESP", "3 I02 ESP", "3 I01 IPI", "3 I01 HUM",
  "Exceções"
];

let students = []; // carregado do Supabase
let currentSelectedTurma = null; // Turma selecionada na coordenação
let studentToReset = null; // Aluno em processo de reset de senha
let currentAlunoId = null; // Guarda o ID do aluno logado

async function carregarAlunos() {
  const { data, error } = await db.from('alunos').select(`
    id,
    nome,
    turma_id,
    turmas(nome)
  `);
  if (!error && data) {
    const existingOrders = {};
    students.forEach(s => {
      existingOrders[s.id] = { recreio: s.recreio, almoco: s.almoco };
    });

    students = data.map(al => {
      const parts = al.nome.trim().split(" ");
      let initials = parts[0] ? parts[0][0] : "";
      if (parts.length > 1) initials += parts[parts.length - 1][0];
      initials = initials.toUpperCase();
      
      const prev = existingOrders[al.id] || { recreio: false, almoco: false };

      return {
        id: al.id,
        name: al.nome,
        turma: al.turmas ? al.turmas.nome : "",
        recreio: prev.recreio,
        almoco: prev.almoco,
        initials: initials
      };
    });
  }
}

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
  
  const isProtected = ["aluno", "coordenacao", "cozinha"].includes(name);
  if (isProtected) {
    if (!isLoggedIn) {
      $("modal-backdrop").classList.remove("hidden");
      return;
    }
    // Proteção rigorosa baseada no papel logado
    if (name === "aluno" && loggedInRole !== "aluno") {
      $("modal-backdrop").classList.remove("hidden");
      return;
    }
    if ((name === "coordenacao" || name === "cozinha") && loggedInRole === "aluno") {
      $("modal-backdrop").classList.remove("hidden");
      return;
    }
  }

  // Desativa a câmara ao sair da aba facial
  if (facialActive && name !== "facial") stopCamera();

  $$(".screen").forEach(s => s.classList.remove("active"));
  $$(".nav-tab").forEach(b => b.classList.remove("active"));

  const sc = $("screen-" + name);
  const bt = document.querySelector(`.nav-tab[data-screen="${name}"]`);
  if (sc) sc.classList.add("active");
  if (bt) bt.classList.add("active");

  if (name === "coordenacao") {
    carregarAlunos().then(() => renderCoord());
  } else if (name === "cozinha") {
    carregarAlunos().then(() => renderCozinha());
  }
}

// Fechar modal de bloqueio
if ($("modal-btn-login")) {
  $("modal-btn-login").addEventListener("click", () => {
    $("modal-backdrop").classList.add("hidden");
    goTo("login");
  });
}

if ($("btn-close-auth-modal")) {
  $("btn-close-auth-modal").addEventListener("click", () => {
    $("modal-backdrop").classList.add("hidden");
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
    currentAlunoId = aluno.id;
    $("aluno-nome-display").textContent = aluno.nome;
    const nameParts = aluno.nome.split(" ");
    let initials = nameParts[0][0];
    if (nameParts.length > 1) initials += nameParts[nameParts.length - 1][0];
    $("aluno-avatar-display").textContent = initials.toUpperCase();

    const selectTurma = $("input-turma");
    if (selectTurma && selectTurma.selectedIndex >= 0) {
      const turmaName = selectTurma.options[selectTurma.selectedIndex].text;
      if ($("aluno-turma-display")) {
        $("aluno-turma-display").textContent = `Turma — ${turmaName}`;
      }
    }

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
  const now = new Date();
  const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000);
  const bsbTime = new Date(utcNow + (3600000 * -3)); 
  
  if (bsbTime.getHours() > 7 || (bsbTime.getHours() === 7 && bsbTime.getMinutes() > 50)) {
    const toast = $("toast");
    if (toast) {
      toast.textContent = "O horário limite (07:50) já foi encerrado.";
      toast.classList.remove("hidden");
      setTimeout(() => toast.classList.add("hidden"), 3000);
    } else {
      alert("O horário limite para pedidos (07:50) já foi encerrado.");
    }
    return;
  }

  $("aluno-order-section").classList.add("hidden");
  $("aluno-confirmed").classList.remove("hidden");

  // Salvar no estado local para que Coordenação/Cozinha veja (simulação)
  if (currentAlunoId) {
    const s = students.find(x => x.id === currentAlunoId);
    if (s) {
      s.recreio = selectedMeals.recreio;
      s.almoco = selectedMeals.almoco;
    }
    
    // Tenta persistir no Supabase (ignoramos erro se tabela não estiver exposta/RLS restrito)
    db.from('pedidos').insert([{
      aluno_id: currentAlunoId,
      recreio: selectedMeals.recreio,
      almoco: selectedMeals.almoco,
      data_pedido: new Date().toISOString().split('T')[0]
    }]).then(res => {
       if (res.error) console.log("Aviso (Supabase):", res.error.message);
    });
  }

  const tags = $("confirmed-tags");
  tags.innerHTML = "";
  if (selectedMeals.recreio) tags.innerHTML += `<span class="cb-tag">Lanche</span>`;
  if (selectedMeals.almoco)  tags.innerHTML += `<span class="cb-tag">Almoço</span>`;
  
  const toast = $("toast");
  if (toast) {
    toast.textContent = "Pedido confirmado com sucesso!";
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 3000);
  }
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

let isResetViewOpen = false;

function renderCoord() {
  if (activeRole !== "coordenacao") return;
  if ($("coord-date")) $("coord-date").textContent = formatDate();

  const viewClasses = $("coord-view-classes");
  const viewStudents = $("coord-view-students");
  const viewReset = $("coord-view-reset");

  if (isResetViewOpen) {
    if (viewClasses) viewClasses.classList.add("hidden");
    if (viewStudents) viewStudents.classList.add("hidden");
    if (viewReset) viewReset.classList.remove("hidden");
    renderResetView();
    return; // Early return to avoid rendering classes/students
  } else {
    if (viewReset) viewReset.classList.add("hidden");
  }

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
            <p style="font-size: 14px;">Use o botão "Adicionar Exceção" ou cadastre alunos usando o botão "Cadastrar Aluno" acima.</p>
          </div>
        `;
      } else {
        alunosDaTurma.forEach(a => {
          const row = document.createElement("div");
          row.className = "stitch-student-row";
          row.innerHTML = `
            <div class="stitch-student-left">
              <div class="stitch-avatar" id="coord-avatar-${a.id}">${a.initials}</div>
              <span class="stitch-name">${a.name}</span>
            </div>
            <div class="stitch-actions">
              <button class="stitch-meal-btn ${a.recreio ? "active" : "inactive"}" data-action="recreio" data-id="${a.id}">
                🥐 Recreio
              </button>
              <button class="stitch-meal-btn ${a.almoco ? "active" : "inactive"}" data-action="almoco" data-id="${a.id}">
                🍽️ Almoço
              </button>
            </div>
          `;
          list.appendChild(row);
        });

        alunosDaTurma.forEach(async a => {
          try {
            const res = await fetch(`${FACE_BACKEND_URL}/foto-assinada/${a.id}`);
            if (res.ok) {
              const data = await res.json();
              if (data.url) {
                const avatarEl = document.getElementById(`coord-avatar-${a.id}`);
                if (avatarEl) {
                  avatarEl.innerHTML = `<img src="${data.url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" alt="Foto do aluno" />`;
                  avatarEl.style.background = "transparent";
                }
              }
            }
          } catch(e) {
            // Se falhar (ex: backend offline), mantém as iniciais silenciosamente
          }
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

        // Event listener removido da VISÃO 2. Senhas agora resetadas na VISÃO 3.

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

/* ── LÓGICA DE DEFINIR NOVA SENHA (VISÃO 4) ────────────────── */

function openNewPasswordView(student) {
  studentToReset = student;
  
  if ($("newpwd-student-name")) $("newpwd-student-name").textContent = student.name;
  if ($("new-pwd-input")) $("new-pwd-input").value = "";
  if ($("new-pwd-error")) $("new-pwd-error").classList.add("hidden");

  // Ocultar as outras visões
  const viewClasses = $("coord-view-classes");
  const viewStudents = $("coord-view-students");
  const viewReset = $("coord-view-reset");
  const viewNewPwd = $("coord-view-new-password");

  if (viewClasses) viewClasses.classList.add("hidden");
  if (viewStudents) viewStudents.classList.add("hidden");
  if (viewReset) viewReset.classList.add("hidden");
  if (viewNewPwd) viewNewPwd.classList.remove("hidden");
}

function closeNewPasswordView() {
  studentToReset = null;
  const viewNewPwd = $("coord-view-new-password");
  if (viewNewPwd) viewNewPwd.classList.add("hidden");
  
  // Volta para a Visão 3 (Gestão de Senhas)
  const viewReset = $("coord-view-reset");
  if (viewReset) viewReset.classList.remove("hidden");
}

if ($("btn-cancel-new-pwd")) {
  $("btn-cancel-new-pwd").addEventListener("click", closeNewPasswordView);
}
if ($("crumb-newpwd-to-reset")) {
  $("crumb-newpwd-to-reset").addEventListener("click", closeNewPasswordView);
}
if ($("crumb-newpwd-to-classes")) {
  $("crumb-newpwd-to-classes").addEventListener("click", () => {
    studentToReset = null;
    isResetViewOpen = false;
    const viewNewPwd = $("coord-view-new-password");
    if (viewNewPwd) viewNewPwd.classList.add("hidden");
    renderCoord();
  });
}

const formNewPwd = $("form-new-password");
if (formNewPwd) {
  formNewPwd.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!studentToReset) return;

    const newPwd = $("new-pwd-input").value.trim();
    if (newPwd.length < 6) {
      if ($("new-pwd-error")) {
        $("new-pwd-error").textContent = "A senha deve ter pelo menos 6 caracteres.";
        $("new-pwd-error").classList.remove("hidden");
      }
      return;
    }
    if (studentToReset.isException) {
      if ($("new-pwd-error")) {
        $("new-pwd-error").textContent = "Alunos adicionados como exceção não possuem senha no sistema.";
        $("new-pwd-error").classList.remove("hidden");
      }
      return;
    }

    const btnTxt = $("btn-newpwd-txt");
    const btnLoader = $("btn-newpwd-loader");
    const errorDiv = $("new-pwd-error");
    
    if (btnTxt) btnTxt.classList.add("hidden");
    if (btnLoader) btnLoader.classList.remove("hidden");
    if (errorDiv) errorDiv.classList.add("hidden");

    try {
      // 1. Criptografa a nova senha com bcrypt (salto de 6, como o padrão do seu app)
      // Obs: Depende do CDN bcryptjs importado no HTML
      const bcryptLib = window.dcodeIO ? window.dcodeIO.bcrypt : window.bcrypt;
      if (!bcryptLib) {
        throw new Error("Biblioteca bcrypt não carregada corretamente no navegador.");
      }
      const salt = bcryptLib.genSaltSync(6);
      const hash = bcryptLib.hashSync(newPwd, salt);

      // 2. Chama a Função Segura (RPC) no Supabase para ignorar o bloqueio de RLS
      const { data, error } = await db.rpc('resetar_senha_aluno', {
        p_aluno_id: parseInt(studentToReset.id) || studentToReset.id,
        p_novo_hash: hash
      });

      if (error) {
        // Se a função não existir, tenta o update direto (fallback caso o usuário tenha adicionado política RLS em vez de RPC)
        console.warn("RPC falhou ou não existe, tentando update direto...", error);
        const fallback = await db.from("alunos")
          .update({ 
            pin_hash: hash, 
            tentativas_pin: 0, 
            bloqueado_ate: null 
          })
          .eq("id", studentToReset.id);
          
        if (fallback.error) {
           throw new Error(fallback.error.message || "Erro desconhecido no Supabase ao atualizar a senha.");
        }
      }

      showToast(`A senha de ${studentToReset.name} foi redefinida com sucesso! 🔑`);
      closeNewPasswordView();
    } catch (err) {
      console.error("Erro ao resetar senha:", err);
      if (errorDiv) {
        errorDiv.textContent = "Erro ao resetar senha: " + err.message;
        errorDiv.classList.remove("hidden");
      }
    } finally {
      if (btnTxt) btnTxt.classList.remove("hidden");
      if (btnLoader) btnLoader.classList.add("hidden");
    }
  });
}

/* ── LÓGICA DO GESTÃO DE SENHAS (VISÃO 3) ── */
function renderResetView(searchTerm = "") {
  const list = $("coord-reset-list");
  if (!list) return;
  list.innerHTML = "";

  const term = searchTerm.toLowerCase();
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(term) || 
    (s.turma && s.turma.toLowerCase().includes(term))
  );

  if (filteredStudents.length === 0) {
    list.innerHTML = `<p style="text-align:center; padding:32px; color:#888;">Nenhum aluno encontrado.</p>`;
    return;
  }

  filteredStudents.forEach(a => {
    const row = document.createElement("div");
    row.className = "stitch-student-row";
    row.innerHTML = `
      <div class="stitch-student-left">
        <div class="stitch-avatar">${a.initials}</div>
        <span class="stitch-name">${a.name} <span style="font-size: 13px; color: #888; font-weight: normal;">(${a.turma})</span></span>
      </div>
      <div class="stitch-actions">
        <button class="btn-reset-pin" data-action="senha" data-id="${a.id}">
          🔑 Resetar Senha
        </button>
      </div>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll("[data-action='senha']").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const s = students.find(x => String(x.id) === String(id));
      if (s) openNewPasswordView(s);
    });
  });
}

if ($("btn-gestao-senhas")) {
  $("btn-gestao-senhas").addEventListener("click", () => {
    isResetViewOpen = true;
    currentSelectedTurma = null; // Reseta seleção de turma se houver
    renderCoord();
  });
}

if ($("btn-reset-back-classes")) {
  $("btn-reset-back-classes").addEventListener("click", () => {
    isResetViewOpen = false;
    renderCoord();
  });
}
if ($("crumb-reset-to-classes")) {
  $("crumb-reset-to-classes").addEventListener("click", () => {
    isResetViewOpen = false;
    renderCoord();
  });
}

if ($("coord-reset-search")) {
  $("coord-reset-search").addEventListener("input", (e) => {
    renderResetView(e.target.value);
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
      turma: "Exceções", // atrela à turma de Exceções
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

let camStream  = null;
let detectionInterval = null;
let scanDone   = false;

const VIDEO  = $("cam-video");

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
  if (detectionInterval) { clearInterval(detectionInterval); detectionInterval = null; }
  
  // Desliga todas as faixas (tracks) da câmara de forma segura
  if (camStream) { 
    camStream.getTracks().forEach(t => t.stop()); 
    camStream = null; 
  }
  
  VIDEO.srcObject = null; // Limpa o vídeo do elemento HTML
  
  showOverlay(true, "Câmara pausada. Pressione 'Ligar Câmara' para iniciar.");
  setStatus("gray", "Câmara desativada");

  $("btn-cam-on").disabled = false;
  $("btn-cam-off").disabled = true;
}

async function initFacial() {
  if (facialActive) return;
  facialActive = true;
  scanDone = false;

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

    // Se chegou até aqui, tudo correu bem! Remove a tela escura e liberta o botão de desligar.
    showOverlay(false);
    setStatus("gray", "Procurando rosto...");
    $("btn-cam-off").disabled = false;

    startDetectionLoop();

  } catch (err) {
    console.error(err);
    
    // CORREÇÃO: Se deu erro, força o desligamento da câmara fisicamente
    if (camStream) {
      camStream.getTracks().forEach(t => t.stop());
      camStream = null;
    }
    VIDEO.srcObject = null;

    // Define a mensagem exata do erro
    let msg = "Erro ao iniciar a câmara.";
    if (err.name === "NotAllowedError") {
      msg = "Permissão negada. Autorize o uso da câmara no topo do navegador.";
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
  scanDone = false;
  
  if (detectionInterval) clearInterval(detectionInterval);
  
  detectionInterval = setInterval(async () => {
    if (!facialActive || scanDone) return;
    if (!VIDEO || VIDEO.readyState < 2) return;
    
    await identificarRostoNoBackend();
  }, 1500); // 1.5s polling
}

async function identificarRostoNoBackend() {
  if (!facialActive || scanDone) return;
  
  try {
    const canvas = document.createElement("canvas");
    canvas.width = VIDEO.videoWidth;
    canvas.height = VIDEO.videoHeight;
    // Espelha para capturar corretamente se estiver usando front-cam
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(VIDEO, 0, 0);
    
    const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.9));
    const formData = new FormData();
    formData.append("file", blob, "frame.jpg");
    
    const res = await fetch(`${FACE_BACKEND_URL}/identify`, {
      method: "POST",
      body: formData
    });
    
    const data = await res.json();
    if (data.match && data.aluno_id) {
      scanDone = true; // Para de tentar
      const s = students.find(al => al.id === data.aluno_id);
      if (s) {
        showIdentified(s);
        setStatus("green", "Aluno identificado com sucesso");
      } else {
        const { data: dbAluno } = await db.from("alunos").select("id, nome, turma_id, turmas(nome)").eq("id", data.aluno_id).single();
        if (dbAluno) {
          showIdentified({
            id: dbAluno.id,
            name: dbAluno.nome,
            turma: dbAluno.turmas ? dbAluno.turmas.nome : "",
            initials: dbAluno.nome[0],
            recreio: false,
            almoco: false
          });
          setStatus("green", "Aluno identificado com sucesso");
        } else {
          scanDone = false; // Continua tentando
          setStatus("red", "Aluno não encontrado na base");
        }
      }
    } else {
      setStatus("gray", "Procurando rosto...");
    }
  } catch(err) {
    console.error("Erro na identificação:", err);
  }
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
  scanDone = false;
  setStatus("gray", "Procurando rosto...");
});

/* ── INICIALIZAÇÃO ───────────────────────────────────────── */
(function init() {
  if ($("cz-date")) $("cz-date").textContent = formatDate();
  if ($("cz-chip-date")) $("cz-chip-date").textContent = new Date().toLocaleDateString("pt-BR", { day:"numeric", month:"short", year:"numeric" });
  syncCozinha();
})();

/* ── LÓGICA DO MODAL CADASTRAR ALUNO ─ */
function abrirModalCadastroAluno() {
  const modal = $("modal-cadastro-aluno");
  if (modal) modal.classList.remove("hidden");
}

let cadCamStream = null;
let cadPhotoBlob = null;

function fecharModalCadastroAluno() {
  const modal = $("modal-cadastro-aluno");
  if (modal) modal.classList.add("hidden");
  const form = $("form-cadastro-aluno");
  if (form) form.reset();
  const errEl = $("cad-aluno-error");
  if (errEl) errEl.classList.add("hidden");
  
  if (cadCamStream) {
    cadCamStream.getTracks().forEach(t => t.stop());
    cadCamStream = null;
  }
  const vid = $("cad-aluno-video");
  const prev = $("cad-aluno-preview");
  const btnLigar = $("btn-cad-ligar-cam");
  const btnTirar = $("btn-cad-tirar-foto");
  const btnLimpar = $("btn-cad-limpar-foto");
  const status = $("cad-aluno-cam-status");
  
  if (vid) vid.style.display = "none";
  if (prev) prev.style.display = "none";
  if (btnTirar) btnTirar.style.display = "none";
  if (btnLimpar) btnLimpar.style.display = "none";
  if (btnLigar) btnLigar.style.display = "block";
  if (status) status.textContent = "O rosto será usado para reconhecimento na entrega da merenda.";
  cadPhotoBlob = null;
}

if ($("btn-cadastrar-aluno")) {
  $("btn-cadastrar-aluno").addEventListener("click", abrirModalCadastroAluno);
}

["btn-close-cadastro-aluno", "btn-cancel-cadastro-aluno"].forEach(id => {
  const btn = $(id);
  if (btn) btn.addEventListener("click", fecharModalCadastroAluno);
});

const modalCadastroAluno = $("modal-cadastro-aluno");
if (modalCadastroAluno) {
  modalCadastroAluno.addEventListener("click", (e) => {
    if (e.target === modalCadastroAluno) fecharModalCadastroAluno();
  });
}

function gerarSenha() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

if ($("btn-gerar-senha-aluno")) {
  $("btn-gerar-senha-aluno").addEventListener("click", () => {
    $("cad-aluno-senha").value = gerarSenha();
  });
}

if ($("btn-cad-ligar-cam")) {
  $("btn-cad-ligar-cam").addEventListener("click", async () => {
    try {
      cadCamStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
      const vid = $("cad-aluno-video");
      vid.srcObject = cadCamStream;
      vid.style.display = "block";
      $("btn-cad-ligar-cam").style.display = "none";
      $("btn-cad-tirar-foto").style.display = "block";
      $("cad-aluno-cam-status").textContent = "Posicione o rosto e clique em Tirar Foto";
    } catch(err) {
      console.error(err);
      $("cad-aluno-cam-status").textContent = "Erro ao acessar câmera.";
    }
  });
}

if ($("btn-cad-tirar-foto")) {
  $("btn-cad-tirar-foto").addEventListener("click", () => {
    const vid = $("cad-aluno-video");
    const cvs = $("cad-aluno-canvas");
    cvs.width = vid.videoWidth;
    cvs.height = vid.videoHeight;
    const ctx = cvs.getContext("2d");
    ctx.translate(cvs.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(vid, 0, 0);
    
    cvs.toBlob(blob => {
      cadPhotoBlob = blob;
      const url = URL.createObjectURL(blob);
      $("cad-aluno-preview").src = url;
      $("cad-aluno-preview").style.display = "block";
      vid.style.display = "none";
      $("btn-cad-tirar-foto").style.display = "none";
      $("btn-cad-limpar-foto").style.display = "block";
      $("cad-aluno-cam-status").textContent = "Foto capturada!";
      
      if (cadCamStream) {
        cadCamStream.getTracks().forEach(t => t.stop());
        cadCamStream = null;
      }
    }, "image/jpeg", 0.9);
  });
}

if ($("btn-cad-limpar-foto")) {
  $("btn-cad-limpar-foto").addEventListener("click", () => {
    $("cad-aluno-preview").style.display = "none";
    $("btn-cad-limpar-foto").style.display = "none";
    $("btn-cad-ligar-cam").style.display = "block";
    $("cad-aluno-cam-status").textContent = "O rosto será usado para reconhecimento na entrega da merenda.";
    cadPhotoBlob = null;
  });
}

if ($("form-cadastro-aluno")) {
  $("form-cadastro-aluno").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome    = $("cad-aluno-nome").value.trim();
    const turmaId = $("cad-aluno-turma").value;
    const senha   = $("cad-aluno-senha").value.trim();
    const errEl   = $("cad-aluno-error");

    errEl.classList.add("hidden");
    $("cad-aluno-nome").classList.remove("error");
    $("cad-aluno-turma").classList.remove("error");
    $("cad-aluno-senha").classList.remove("error");

    if (!nome || !turmaId || !senha) {
      errEl.textContent = "Preencha todos os campos antes de salvar.";
      errEl.classList.remove("hidden");
      return;
    }
    if (senha.length < 6) {
      errEl.textContent = "A senha deve ter ao menos 6 caracteres.";
      errEl.classList.remove("hidden");
      return;
    }

    const btnTxt = $("btn-aluno-txt");
    const btnLoader = $("btn-aluno-loader");
    const btnSubmit = $("btn-salvar-aluno");
    
    if (btnTxt) btnTxt.classList.add("hidden");
    if (btnLoader) btnLoader.classList.remove("hidden");
    if (btnSubmit) btnSubmit.disabled = true;

    const matricula = `AL${Date.now().toString().slice(-8)}`;

    const { data, error } = await db.rpc("cadastrar_aluno", {
      p_nome: nome,
      p_turma_id: turmaId,
      p_matricula: matricula,
      p_pin: senha,
      p_consentimento: true
    });

    if (btnTxt) btnTxt.classList.remove("hidden");
    if (btnLoader) btnLoader.classList.add("hidden");
    if (btnSubmit) btnSubmit.disabled = false;

    if (error) {
      errEl.textContent = `Erro ao salvar: ${error.message || "Verifique as permissões."}`;
      errEl.classList.remove("hidden");
      console.log(error);
      return;
    }

    if (cadPhotoBlob) {
      try {
        const { data: novoAluno } = await db.from("alunos").select("id").eq("matricula", matricula).single();
        if (novoAluno) {
          const formData = new FormData();
          formData.append("aluno_id", novoAluno.id);
          formData.append("file", cadPhotoBlob, "foto.jpg");
          
          fetch(`${FACE_BACKEND_URL}/enroll`, {
            method: "POST",
            body: formData
          }).catch(e => console.error("Enroll network error:", e));
        }
      } catch(err) {
        console.error("Erro ao fazer enroll da face:", err);
      }
    }

    fecharModalCadastroAluno();
    
    const toast = $("toast");
    if (toast) {
      toast.textContent = `Aluno(a) ${nome} cadastrado(a) com sucesso!`;
      toast.classList.remove("hidden");
      setTimeout(() => toast.classList.add("hidden"), 3000);
    } else {
      alert(`Aluno(a) ${nome} cadastrado(a) com sucesso!`);
    }
  });
}