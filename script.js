/* ══════════════════════════════════════════════════════════
   MERENDA ESCOLAR — app.js
   Lógica de navegação, pedidos, coordenação, cozinha
   e reconhecimento facial via API Python backend
   ══════════════════════════════════════════════════════════ */

"use strict";

const firebaseConfig = {
  apiKey: "AIzaSyCaBuqoWltlPyTIpORdzq3mF7kX75z45zo",
  authDomain: "tcc-merenda.firebaseapp.com",
  projectId: "tcc-merenda",
  storageBucket: "tcc-merenda.firebasestorage.app",
  messagingSenderId: "791749110786",
  appId: "1:791749110786:web:1ad12b2c23a2b9a606cb1b",
  measurementId: "G-2JH5ZTRRRM"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestoreDb = firebase.firestore();
let FACE_BACKEND_URL = "https://api-merenda-facial.onrender.com";

// Tenta detectar backend facial local (porta 8000 via iniciar_backend.bat) se estiver executando localmente
async function detectarBackendFacial() {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:") {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 1200);
      const res = await fetch("http://127.0.0.1:8000/health", { signal: controller.signal });
      clearTimeout(t);
      if (res.ok) {
        FACE_BACKEND_URL = "http://127.0.0.1:8000";
        console.log("Conectado ao backend facial local: http://127.0.0.1:8000");
      }
    } catch(e) {
      // Backend local desligado, mantém nuvem (Render)
    }
  }
}
detectarBackendFacial();

async function carregarTurmasLogin() {
  try {
    const snap = await firestoreDb.collection("turmas").get();
    const data = [];
    snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
    data.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

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
    
    const selectTurmaFacial = $("facial-turma");
    if (selectTurmaFacial) {
      const options = data.map(t => `<option value="${t.id}">${t.nome}</option>`).join("");
      selectTurmaFacial.innerHTML = `<option value="todas" selected>Todas as turmas (Busca Geral)</option>` + options;
    }
  } catch (error) {
    console.error("Erro ao carregar turmas no login:", error);
  }
}

// Chame a função automaticamente quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
  carregarTurmasLogin();
  initSigmeAnimation();
});

/* ══════════════════════════════════════════════════════════
   ANIMAÇÃO SIGME (Scramble)
   ══════════════════════════════════════════════════════════ */
function initSigmeAnimation() {
  const letters = document.querySelectorAll('.sigme-letter');
  if (!letters.length) return;

  function scrambleAndAssemble() {
    letters.forEach(letter => {
      // Desativa transição para saltar instantaneamente para a posição embaralhada invisível
      letter.style.transition = 'none';
      letter.classList.remove('assembled');
      
      // Gera posições e rotações 3D aleatórias
      const tx = (Math.random() - 0.5) * 200;
      const ty = (Math.random() - 0.5) * 200;
      const tz = (Math.random() - 0.5) * 300;
      const rx = (Math.random() - 0.5) * 360;
      const ry = (Math.random() - 0.5) * 360;
      const rz = (Math.random() - 0.5) * 360;
      
      letter.style.transform = `translate3d(${tx}px, ${ty}px, ${tz}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
    });

    // Força reflow (leitura de propriedade síncrona) para o navegador aplicar a posição bagunçada antes de animar
    void document.body.offsetHeight;

    // Aguarda um instante e então reativa as transições para "montar" a palavra
    setTimeout(() => {
      letters.forEach(letter => {
        letter.style.transition = 'transform 1.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 1.2s ease';
        letter.classList.add('assembled');
      });
    }, 50);
  }

  // Inicia a primeira animação
  scrambleAndAssemble();

  // Define o loop a cada 4 segundos
  setInterval(scrambleAndAssemble, 4000);
}

/* ── DADOS ───────────────────────────────────────────────── */
const ALL_TURMAS = [
  "1 I01 LCH", "1 I02 LCH", "1 I01 IPI", "1 I01 MCN",
  "2 I01 LCH", "2 I02 LCH", "2 I01 IPI",
  "3 I01 ESP", "3 I02 ESP", "3 I01 IPI", "3 I01 HUM",
  "Exceções"
];

let students = []; // carregado do Firestore
let currentSelectedTurma = null; // Turma selecionada na coordenação
let currentResetSelectedTurma = null; // Turma selecionada no reset de senhas
let studentToReset = null; // Aluno em processo de reset de senha
let currentAlunoId = null; // Guarda o ID do aluno logado

async function carregarAlunos() {
  try {
    const turmasSnap = await firestoreDb.collection("turmas").get();
    const turmasMap = {};
    turmasSnap.forEach(d => {
      turmasMap[d.id] = d.data().nome;
    });

    const alunosSnap = await firestoreDb.collection("alunos").get();
    const existingOrders = {};
    students.forEach(s => {
      existingOrders[s.id] = { recreio: s.recreio, almoco: s.almoco };
    });

    const loaded = [];
    alunosSnap.forEach(doc => {
      const al = doc.data();
      const alunoId = doc.id;
      const parts = (al.nome || "").trim().split(" ");
      let initials = parts[0] ? parts[0][0] : "";
      if (parts.length > 1) initials += parts[parts.length - 1][0];
      initials = initials.toUpperCase();
      
      const prev = existingOrders[alunoId] || { recreio: false, almoco: false };

      loaded.push({
        id: alunoId,
        name: al.nome,
        turma: turmasMap[al.turma_id] || "",
        recreio: prev.recreio,
        almoco: prev.almoco,
        initials: initials
      });
    });

    loaded.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    students = loaded;
  } catch (err) {
    console.error("Erro ao carregar alunos do Firestore:", err);
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
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3000);
}

function formatDate() {
  return new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
}

/* ── HORÁRIO DE BRASÍLIA E REGRAS DE MERENDA ─────────────── */
function getHorarioBrasilia() {
  try {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      minute: "numeric",
      hour12: false
    }).formatToParts(new Date());
    const hour = parseInt(parts.find(p => p.type === "hour").value, 10);
    const minute = parseInt(parts.find(p => p.type === "minute").value, 10);
    return { hour, minute };
  } catch (e) {
    const now = new Date();
    const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000);
    const bsb = new Date(utcNow + (3600000 * -3));
    return { hour: bsb.getHours(), minute: bsb.getMinutes() };
  }
}

function podeMarcarMerendaHoje() {
  const { hour, minute } = getHorarioBrasilia();
  return hour < 7 || (hour === 7 && minute <= 50);
}

function atualizarPrazoBar() {
  const el = document.querySelector(".pb-remaining");
  if (!el) return;
  const { hour, minute } = getHorarioBrasilia();
  if (!podeMarcarMerendaHoje()) {
    el.textContent = "Encerrado hoje (07:50)";
  } else {
    const totalNow = hour * 60 + minute;
    const limit = 7 * 60 + 50; // 470 mins
    const diff = limit - totalNow;
    if (diff > 60) {
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      el.textContent = `Restam ${h}h ${m}min`;
    } else {
      el.textContent = `Restam ${diff} min`;
    }
  }
}

/* ── NAVEGAÇÃO E CONTROLO DE ACESSO ──────────────────────── */
let activeRole = "aluno";
let facialActive = false;

function goTo(name) {
  if (!name) return;
  
  const isProtected = ["aluno", "coordenacao", "cozinha"].includes(name);
  if (isProtected) {
    const modalSub = $("modal-auth")?.querySelector(".modal-sub");
    if (!isLoggedIn) {
      if (modalSub) {
        modalSub.textContent = "Você precisa fazer login para acessar esta área.";
      }
      $("modal-backdrop").classList.remove("hidden");
      return;
    }
    // Proteção rigorosa: cada perfil autenticado só pode acessar estritamente sua própria área
    if (name !== loggedInRole) {
      const roleLabels = { aluno: "Aluno", coordenacao: "Coordenação", cozinha: "Cozinha" };
      if (modalSub) {
        modalSub.textContent = `Seu perfil atual (${roleLabels[loggedInRole] || loggedInRole}) não tem permissão para acessar a área da ${roleLabels[name] || name}.`;
      }
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

  if (name === "aluno") {
    atualizarPrazoBar();
  } else if (name === "coordenacao") {
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
    const groupNome = $("group-nome");
    if (activeRole === "aluno") {
      groupTurma.classList.remove("hidden");
      if (groupNome) groupNome.classList.remove("hidden");
      groupEmail.classList.add("hidden");
    } else {
      groupTurma.classList.add("hidden");
      if (groupNome) groupNome.classList.add("hidden");
      groupEmail.classList.remove("hidden");
    }
  });
});

if ($("input-turma")) {
  $("input-turma").addEventListener("change", async (e) => {
    const turmaId = e.target.value;
    const selectNome = $("input-nome");
    if (!selectNome) return;
    
    if (!turmaId) {
      selectNome.innerHTML = '<option value="" disabled selected>Selecione a turma primeiro...</option>';
      selectNome.disabled = true;
      return;
    }
    
    selectNome.innerHTML = '<option value="" disabled selected>Carregando alunos...</option>';
    selectNome.disabled = true;
    
    try {
      const snap = await firestoreDb.collection("alunos").where("turma_id", "==", turmaId).get();
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

      if (data.length === 0) {
        selectNome.innerHTML = '<option value="" disabled selected>Nenhum aluno nesta turma</option>';
        return;
      }
      
      const options = data.map(al => `<option value="${al.nome}">${al.nome}</option>`).join("");
      selectNome.innerHTML = '<option value="" disabled selected>Selecione seu nome...</option>' + options;
      selectNome.disabled = false;
    } catch(err) {
      console.error("Erro ao buscar alunos:", err);
      selectNome.innerHTML = '<option value="" disabled selected>Erro ao carregar</option>';
    }
  });
}

// Lógica de Entrar (Login)
$("btn-login").addEventListener("click", async () => {
  const inputNome = $("input-nome").value ? $("input-nome").value.trim() : "";
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

    try {
      const snap = await firestoreDb.collection("alunos")
        .where("turma_id", "==", inputTurma)
        .where("nome", "==", inputNome)
        .get();

      if (snap.empty) {
        $("login-error").textContent = "Aluno não encontrado nesta turma.";
        $("login-error").classList.remove("hidden");
        return;
      }

      const alunoDoc = snap.docs[0];
      const aluno = alunoDoc.data();
      aluno.id = alunoDoc.id;

      if (aluno.bloqueado_ate && new Date(aluno.bloqueado_ate) > new Date()) {
        $("login-error").textContent = "Acesso temporariamente bloqueado por tentativas incorretas.";
        $("login-error").classList.remove("hidden");
        return;
      }

      const bcryptLib = window.dcodeIO ? window.dcodeIO.bcrypt : window.bcrypt;
      let pinValido = false;
      if (aluno.pin_hash && bcryptLib) {
        try {
          pinValido = bcryptLib.compareSync(inputSenha, aluno.pin_hash);
        } catch (e) {
          console.warn("Erro ao validar PIN:", e);
        }
      } else if (inputSenha === "1234") {
        pinValido = true;
      }

      if (!pinValido) {
        const tentativas = (aluno.tentativas_pin || 0) + 1;
        const updates = { tentativas_pin: tentativas };
        if (tentativas >= 5) {
          updates.bloqueado_ate = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }
        await firestoreDb.collection("alunos").doc(alunoDoc.id).update(updates);

        $("login-error").textContent = "PIN incorreto. Verifique sua senha.";
        $("login-error").classList.remove("hidden");
        return;
      }

      if (aluno.tentativas_pin > 0) {
        await firestoreDb.collection("alunos").doc(alunoDoc.id).update({ tentativas_pin: 0, bloqueado_ate: null });
      }

      isLoggedIn = true;
      loggedInRole = "aluno";
      activeRole = "aluno";

      $$(".nav-protected").forEach(tab => {
        if (tab.dataset.screen === loggedInRole) tab.classList.add("unlocked");
        else tab.classList.remove("unlocked");
      });

      const selectTurma = $("input-turma");
      if (selectTurma && selectTurma.selectedIndex >= 0) {
        aluno.turma = selectTurma.options[selectTurma.selectedIndex].text;
      }
      fazerLoginAlunoAutomatico(aluno);
      return;
    } catch (loginErr) {
      console.error("Erro no login do aluno:", loginErr);
      $("login-error").textContent = "Erro ao processar login: " + loginErr.message;
      $("login-error").classList.remove("hidden");
      return;
    }
  }

  // Coordenação / Cozinha
  if (!inputEmail || !inputSenha) {
    $("login-error").textContent = "E-mail e senha são obrigatórios.";
    $("login-error").classList.remove("hidden");
    return;
  }

  let perfil = null;
  const inputClean = inputEmail.trim().toLowerCase();

  try {
    if (firebase.auth && typeof firebase.auth === "function") {
      const authRes = await firebase.auth().signInWithEmailAndPassword(inputEmail, inputSenha);
      const perfilDoc = await firestoreDb.collection("perfis").doc(authRes.user.uid).get();
      if (perfilDoc.exists) {
        perfil = perfilDoc.data();
      }
    }
  } catch (authErr) {
    console.warn("Firebase Auth não utilizado ou pendente:", authErr.message);
  }

  if (!perfil) {
    try {
      const snapPerfis = await firestoreDb.collection("perfis").get();
      snapPerfis.forEach(d => {
        const p = d.data();
        const pEmail = (p.email || "").toLowerCase();
        const pNome = (p.nome || "").toLowerCase();
        const pPapel = (p.papel || "").toLowerCase();

        // 1. Match direto por email
        if (pEmail && (pEmail === inputClean || inputClean.includes(pEmail))) {
          perfil = p;
        }
        // 2. Match por papel se o email contiver palavras-chave
        else if (activeRole === "coordenacao" && ["coordenador", "admin"].includes(pPapel)) {
          if (inputClean.includes("coord") || inputClean.includes("timoteo") || inputClean.includes("admin")) {
            perfil = p;
          }
        } else if (activeRole === "cozinha" && ["merendeira", "cozinha"].includes(pPapel)) {
          if (inputClean.includes("merenda") || inputClean.includes("cozinha")) {
            perfil = p;
          }
        }
      });
    } catch (e) {
      console.warn("Erro ao buscar perfis no Firestore:", e);
    }
  }

  // Fallback garantido para a aba selecionada se não encontrou registro específico
  if (!perfil) {
    if (activeRole === "coordenacao") {
      perfil = { nome: inputEmail.split("@")[0] || "Coordenador", papel: "coordenador" };
    } else if (activeRole === "cozinha") {
      perfil = { nome: inputEmail.split("@")[0] || "Cozinha", papel: "merendeira" };
    }
  }

  // Validação de senha (123456 padrão ou verificação por hash bcrypt)
  const bcryptLib = window.dcodeIO ? window.dcodeIO.bcrypt : window.bcrypt;
  let senhaValida = false;
  if (inputSenha === "123456") {
    senhaValida = true;
  } else if (perfil && perfil.senha_hash && bcryptLib) {
    try {
      senhaValida = bcryptLib.compareSync(inputSenha, perfil.senha_hash);
    } catch (e) {
      console.warn("Erro ao comparar hash de senha:", e);
    }
  }

  if (!senhaValida) {
    $("login-error").textContent = "E-mail ou senha inválidos.";
    $("login-error").classList.remove("hidden");
    return;
  }

  const papelPermiteCoordenacao = ["coordenador", "admin"].includes(perfil ? perfil.papel : "");
  const papelPermiteCozinha = ["merendeira", "coordenador", "admin"].includes(perfil ? perfil.papel : "");

  if (activeRole === "coordenacao" && !papelPermiteCoordenacao) {
    $("login-error").textContent = "Esse usuário não tem acesso à Coordenação.";
    $("login-error").classList.remove("hidden");
    return;
  }
  if (activeRole === "cozinha" && !papelPermiteCozinha) {
    $("login-error").textContent = "Esse usuário não tem acesso à Cozinha.";
    $("login-error").classList.remove("hidden");
    return;
  }

  isLoggedIn = true;
  loggedInRole = activeRole;

  $$(".nav-protected").forEach(tab => {
    if (tab.dataset.screen === loggedInRole) tab.classList.add("unlocked");
    else tab.classList.remove("unlocked");
  });

  showToast(`Bem-vindo(a), ${perfil ? perfil.nome : "Usuário"}!`);
  goTo(loggedInRole);
});

/* ── LOGIN AUTOMÁTICO DO ALUNO ───────────────────────────── */
function fazerLoginAlunoAutomatico(aluno) {
  if (!aluno) return;

  isLoggedIn = true;
  loggedInRole = "aluno";
  activeRole = "aluno";

  $$(".nav-protected").forEach(tab => {
    if (tab.dataset.screen === loggedInRole) tab.classList.add("unlocked");
    else tab.classList.remove("unlocked");
  });

  currentAlunoId = aluno.id;
  const nome = aluno.nome || aluno.name || "Aluno";
  $("aluno-nome-display").textContent = nome;

  let initials = aluno.initials;
  if (!initials) {
    const parts = nome.trim().split(" ");
    initials = parts[0] ? parts[0][0] : "";
    if (parts.length > 1) initials += parts[parts.length - 1][0];
    initials = initials.toUpperCase();
  }
  $("aluno-avatar-display").textContent = initials;

  const turmaNome = aluno.turma || (aluno.turmas ? aluno.turmas.nome : "");
  if ($("aluno-turma-display")) {
    $("aluno-turma-display").textContent = turmaNome ? `Turma — ${turmaNome}` : "Turma — Ensino Médio";
  }

  // Verifica se o aluno já marcou merenda hoje
  const s = students.find(x => x.id === aluno.id) || aluno;
  const jaMarcou = Boolean(s.recreio || s.almoco);
  const dentroDoHorario = podeMarcarMerendaHoje();

  if (jaMarcou) {
    $("aluno-order-section").classList.add("hidden");
    $("aluno-confirmed").classList.remove("hidden");
    const tags = $("confirmed-tags");
    if (tags) {
      tags.innerHTML = "";
      if (s.recreio) tags.innerHTML += `<span class="cb-tag">Lanche</span>`;
      if (s.almoco)  tags.innerHTML += `<span class="cb-tag">Almoço</span>`;
    }
    showToast(`Bem-vindo(a), ${nome}! Sua merenda de hoje já está confirmada.`);
  } else {
    selectedMeals.recreio = false;
    selectedMeals.almoco = false;
    $("aluno-confirmed").classList.add("hidden");
    $("aluno-order-section").classList.remove("hidden");
    updateMealUI();

    if (dentroDoHorario) {
      showToast(`Bem-vindo(a), ${nome}! Você pode marcar sua merenda até às 07:50.`);
    } else {
      showToast(`Olá, ${nome}! O horário limite de pedidos (07:50 de Brasília) já encerrou.`);
    }
  }

  if (facialActive) stopCamera();
  goTo("aluno");
}

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
  if (!podeMarcarMerendaHoje()) {
    btnConfirm.disabled = true;
    btnConfirm.textContent = "Horário de pedidos encerrado (07:50)";
    return;
  }
  const any = selectedMeals.recreio || selectedMeals.almoco;
  btnConfirm.disabled = !any;
  btnConfirm.textContent = any ? "Confirmar Pedido" : "Selecione ao menos uma refeição";
}

// Clicks nos cards individuais
["recreio", "almoco"].forEach(meal => {
  $("meal-" + meal).addEventListener("click", () => {
    if (!podeMarcarMerendaHoje()) {
      showToast("O horário limite para pedidos (07:50) já encerrou hoje.");
      return;
    }
    selectedMeals[meal] = !selectedMeals[meal];
    updateMealUI();
  });
});

// Click no botão de Ambas as refeições
$("btn-ambas").addEventListener("click", () => {
  if (!podeMarcarMerendaHoje()) {
    showToast("O horário limite para pedidos (07:50) já encerrou hoje.");
    return;
  }
  const turnOn = !(selectedMeals.recreio && selectedMeals.almoco);
  selectedMeals.recreio = turnOn;
  selectedMeals.almoco = turnOn;
  updateMealUI();
});

$("btn-confirm-order").addEventListener("click", () => {
  if (!podeMarcarMerendaHoje()) {
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
    
    // Persiste no Firestore
    firestoreDb.collection('pedidos').add({
      aluno_id: currentAlunoId,
      recreio: selectedMeals.recreio,
      almoco: selectedMeals.almoco,
      data_pedido: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    }).catch(err => {
      console.log("Aviso (Firestore pedidos):", err.message);
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
    const searchTerm = $("coord-reset-search") ? $("coord-reset-search").value : "";
    renderResetView(searchTerm);
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
              <button class="stitch-delete-btn" data-id="${a.id}" data-name="${a.name}" title="Excluir cadastro do aluno">
                🗑️
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
            const id = btn.dataset.id;
            const meal = btn.dataset.action;
            const s = students.find(s => String(s.id) === String(id));
            if (s) {
              s[meal] = !s[meal];
              showToast(`${s.name}: ${meal === "recreio" ? "Recreio" : "Almoço"} ${s[meal] ? "confirmado" : "desmarcado"}!`);
              renderCoord();
              syncCozinha();
            }
          });
        });

        // Event listeners para o botão de exclusão de aluno
        list.querySelectorAll(".stitch-delete-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const s = students.find(s => String(s.id) === String(id));
            const nome = s ? s.name : (btn.dataset.name || "o aluno");
            
            if (!confirm(`Deseja realmente excluir o cadastro de "${nome}"?\n\nEsta ação apagará todos os dados, histórico de refeições e biometria facial.`)) {
              return;
            }

            try {
              showToast(`Excluindo ${nome}...`);
              
              // 1. Apaga no backend (limpa biometria facial, fotos e registro no banco)
              try {
                await fetch(`${FACE_BACKEND_URL}/aluno/${id}`, { method: "DELETE" });
              } catch(e) {
                console.warn("Backend delete notice:", e);
              }

              // 2. Apaga no Firestore (pedidos e alunos)
              try {
                const pedidosSnap = await firestoreDb.collection("pedidos").where("aluno_id", "==", id).get();
                const pBatch = firestoreDb.batch();
                pedidosSnap.forEach(d => pBatch.delete(d.ref));
                await pBatch.commit();
                await firestoreDb.collection("alunos").doc(id).delete();
              } catch(e) {
                console.warn("Firestore delete notice:", e);
              }

              // 3. Atualiza estado local e re-renderiza
              students = students.filter(s => String(s.id) !== String(id));
              showToast(`Cadastro de ${nome} excluído com sucesso!`);
              renderCoord();
              syncCozinha();
            } catch(err) {
              console.error("Erro ao excluir:", err);
              showToast(`Erro ao excluir aluno: ${err.message || err}`);
            }
          });
        });

        // Event listener para o botão Confirmar
        list.querySelectorAll("[data-action='confirmar']").forEach(btn => {
          btn.addEventListener("click", () => {
            const id = btn.dataset.id;
            const s = students.find(s => String(s.id) === String(id));
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

  // Configurar breadcrumb de retorno à turma se aplicável
  const crumbTurma = $("crumb-newpwd-to-turma");
  const sepTurma = $("crumb-newpwd-sep-turma");
  if (currentResetSelectedTurma && crumbTurma && sepTurma) {
    crumbTurma.textContent = `Turma ${currentResetSelectedTurma}`;
    crumbTurma.classList.remove("hidden");
    sepTurma.classList.remove("hidden");
  } else if (crumbTurma && sepTurma) {
    crumbTurma.classList.add("hidden");
    sepTurma.classList.add("hidden");
  }

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

  const searchTerm = $("coord-reset-search") ? $("coord-reset-search").value : "";
  renderResetView(searchTerm);
}

if ($("btn-cancel-new-pwd")) {
  $("btn-cancel-new-pwd").addEventListener("click", closeNewPasswordView);
}
if ($("crumb-newpwd-to-reset")) {
  $("crumb-newpwd-to-reset").addEventListener("click", closeNewPasswordView);
}
if ($("crumb-newpwd-to-turma")) {
  $("crumb-newpwd-to-turma").addEventListener("click", closeNewPasswordView);
}
if ($("crumb-newpwd-to-classes")) {
  $("crumb-newpwd-to-classes").addEventListener("click", () => {
    studentToReset = null;
    isResetViewOpen = false;
    currentResetSelectedTurma = null;
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
      const bcryptLib = window.dcodeIO ? window.dcodeIO.bcrypt : window.bcrypt;
      if (!bcryptLib) {
        throw new Error("Biblioteca bcrypt não carregada corretamente no navegador.");
      }
      const salt = bcryptLib.genSaltSync(6);
      const hash = bcryptLib.hashSync(newPwd, salt);

      // 2. Atualiza a senha no Firestore
      await firestoreDb.collection("alunos").doc(studentToReset.id).update({
        pin_hash: hash,
        tentativas_pin: 0,
        bloqueado_ate: null
      });

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
  const grid = $("coord-reset-classes-grid");
  const list = $("coord-reset-list");
  const title = $("coord-reset-title");
  const btnBack = $("btn-reset-back-classes");
  const crumbMain = $("crumb-reset-main");
  const crumbSep2 = $("crumb-reset-sep-2");
  const crumbSub = $("crumb-reset-sub");
  const searchInput = $("coord-reset-search");

  if (!grid || !list) return;

  const term = searchTerm ? searchTerm.trim().toLowerCase() : "";

  // ── CENÁRIO 1: BUSCA ATIVA POR NOME OU TURMA ──
  if (term.length > 0) {
    grid.classList.add("hidden");
    list.classList.remove("hidden");

    if (crumbMain) {
      crumbMain.className = "crumb-link";
      crumbMain.style.cursor = "pointer";
    }
    if (crumbSep2) crumbSep2.classList.remove("hidden");
    if (crumbSub) {
      crumbSub.classList.remove("hidden");
      crumbSub.textContent = "Resultados da busca";
    }
    if (title) title.textContent = "Resultados da Busca";
    if (btnBack) btnBack.textContent = "← Voltar às Turmas";

    list.innerHTML = "";
    const filteredStudents = students.filter(s => 
      s.name.toLowerCase().includes(term) || 
      (s.turma && s.turma.toLowerCase().includes(term))
    );

    if (filteredStudents.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding: 48px 20px; background: #fff; border-radius: 20px; border: 1.5px dashed #d5c8b8; color: #8c7b6d;">
          <p style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Nenhum aluno encontrado para "${searchTerm}".</p>
          <p style="font-size: 14px;">Tente pesquisar por outro nome ou turma.</p>
        </div>
      `;
      return;
    }

    filteredStudents.forEach(a => {
      const row = document.createElement("div");
      row.className = "stitch-student-row";
      row.innerHTML = `
        <div class="stitch-student-left">
          <div class="stitch-avatar" id="reset-avatar-${a.id}">${a.initials}</div>
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

    // Foto do aluno via URL assinada
    filteredStudents.forEach(async a => {
      try {
        const res = await fetch(`${FACE_BACKEND_URL}/foto-assinada/${a.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            const avatarEl = document.getElementById(`reset-avatar-${a.id}`);
            if (avatarEl) {
              avatarEl.innerHTML = `<img src="${data.url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" alt="Foto do aluno" />`;
              avatarEl.style.background = "transparent";
            }
          }
        }
      } catch(e) {}
    });

    list.querySelectorAll("[data-action='senha']").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const s = students.find(x => String(x.id) === String(id));
        if (s) openNewPasswordView(s);
      });
    });

    return;
  }

  // ── CENÁRIO 2: TURMA ESPECÍFICA SELECIONADA ──
  if (currentResetSelectedTurma) {
    grid.classList.add("hidden");
    list.classList.remove("hidden");

    if (crumbMain) {
      crumbMain.className = "crumb-link";
      crumbMain.style.cursor = "pointer";
    }
    if (crumbSep2) crumbSep2.classList.remove("hidden");
    if (crumbSub) {
      crumbSub.classList.remove("hidden");
      crumbSub.textContent = `Turma ${currentResetSelectedTurma}`;
    }
    if (title) title.textContent = `Resetar Senha – Turma ${currentResetSelectedTurma}`;
    if (btnBack) btnBack.textContent = "← Voltar às Turmas";

    list.innerHTML = "";
    const alunosDaTurma = students.filter(s => s.turma === currentResetSelectedTurma);

    if (alunosDaTurma.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding: 48px 20px; background: #fff; border-radius: 20px; border: 1.5px dashed #d5c8b8; color: #8c7b6d;">
          <p style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Nenhum aluno cadastrado na turma ${currentResetSelectedTurma}.</p>
          <p style="font-size: 14px;">Cadastre novos alunos ou selecione outra turma.</p>
        </div>
      `;
      return;
    }

    alunosDaTurma.forEach(a => {
      const row = document.createElement("div");
      row.className = "stitch-student-row";
      row.innerHTML = `
        <div class="stitch-student-left">
          <div class="stitch-avatar" id="reset-avatar-${a.id}">${a.initials}</div>
          <span class="stitch-name">${a.name}</span>
        </div>
        <div class="stitch-actions">
          <button class="btn-reset-pin" data-action="senha" data-id="${a.id}">
            🔑 Resetar Senha
          </button>
        </div>
      `;
      list.appendChild(row);
    });

    // Foto do aluno via URL assinada
    alunosDaTurma.forEach(async a => {
      try {
        const res = await fetch(`${FACE_BACKEND_URL}/foto-assinada/${a.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            const avatarEl = document.getElementById(`reset-avatar-${a.id}`);
            if (avatarEl) {
              avatarEl.innerHTML = `<img src="${data.url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" alt="Foto do aluno" />`;
              avatarEl.style.background = "transparent";
            }
          }
        }
      } catch(e) {}
    });

    list.querySelectorAll("[data-action='senha']").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const s = students.find(x => String(x.id) === String(id));
        if (s) openNewPasswordView(s);
      });
    });

    return;
  }

  // ── CENÁRIO 3: GRID DE TURMAS (IGUAL AO PAINEL DE COORDENAÇÃO) ──
  grid.classList.remove("hidden");
  list.classList.add("hidden");

  if (crumbMain) {
    crumbMain.className = "crumb-current";
    crumbMain.style.cursor = "default";
  }
  if (crumbSep2) crumbSep2.classList.add("hidden");
  if (crumbSub) crumbSub.classList.add("hidden");
  if (title) title.textContent = "Resetar Senha de Alunos";
  if (btnBack) btnBack.textContent = "← Voltar ao Painel";

  grid.innerHTML = "";
  const turmasParaReset = ALL_TURMAS.filter(turma => turma !== "Exceções");
  turmasParaReset.forEach(turma => {
    const alunosDaTurma = students.filter(s => s.turma === turma);
    const totalAlunos = alunosDaTurma.length;

    const card = document.createElement("div");
    card.className = "coord-class-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("title", `Clique para gerenciar senhas da turma ${turma}`);

    card.innerHTML = `
      <div class="coord-card-header">
        <h3 class="coord-class-name">${turma}</h3>
      </div>
      <div class="coord-class-stats">
        <div class="coord-stat-col">
          <svg class="coord-stat-svg" viewBox="0 0 24 24" fill="none" stroke="#2D5A43" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <div class="coord-stat-info">
            <span class="coord-stat-num">${totalAlunos}</span>
            <span class="coord-stat-label">ALUNOS</span>
          </div>
        </div>
        <div class="coord-stat-col">
          <svg class="coord-stat-svg" viewBox="0 0 24 24" fill="none" stroke="#2D5A43" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="7.5" cy="15.5" r="4.5"/>
            <path d="M10.7 12.3L19 4"/>
            <path d="M15 8l3 3"/>
            <path d="M18 5l2 2"/>
          </svg>
          <div class="coord-stat-info">
            <span class="coord-stat-num">${totalAlunos}</span>
            <span class="coord-stat-label">SENHAS</span>
          </div>
        </div>
      </div>
    `;

    const selectTurma = () => {
      currentResetSelectedTurma = turma;
      if (searchInput) searchInput.value = "";
      renderResetView();
    };

    card.addEventListener("click", selectTurma);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectTurma();
      }
    });

    grid.appendChild(card);
  });
}

if ($("btn-gestao-senhas")) {
  $("btn-gestao-senhas").addEventListener("click", () => {
    isResetViewOpen = true;
    currentSelectedTurma = null; // Reseta seleção de turma da coordenação
    currentResetSelectedTurma = null; // Inicia no grid de turmas do reset
    if ($("coord-reset-search")) $("coord-reset-search").value = "";
    renderCoord();
  });
}

if ($("btn-reset-back-classes")) {
  $("btn-reset-back-classes").addEventListener("click", () => {
    const searchInput = $("coord-reset-search");
    if (searchInput && searchInput.value.trim().length > 0) {
      searchInput.value = "";
      renderResetView();
    } else if (currentResetSelectedTurma !== null) {
      currentResetSelectedTurma = null;
      renderResetView();
    } else {
      isResetViewOpen = false;
      renderCoord();
    }
  });
}

if ($("crumb-reset-to-classes")) {
  $("crumb-reset-to-classes").addEventListener("click", () => {
    isResetViewOpen = false;
    currentResetSelectedTurma = null;
    if ($("coord-reset-search")) $("coord-reset-search").value = "";
    renderCoord();
  });
}

if ($("crumb-reset-main")) {
  $("crumb-reset-main").addEventListener("click", () => {
    if (currentResetSelectedTurma !== null || ($("coord-reset-search") && $("coord-reset-search").value.trim().length > 0)) {
      currentResetSelectedTurma = null;
      if ($("coord-reset-search")) $("coord-reset-search").value = "";
      renderResetView();
    }
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

// Botões de abrir no painel da coordenação e no registro facial
["btn-add-excecao", "btn-facial-add-excecao"].forEach(id => {
  const btn = $(id);
  if (btn) btn.addEventListener("click", abrirModalExcecao);
});

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
   RECONHECIMENTO FACIAL — Envio de Frames para API Backend
   ══════════════════════════════════════════════════════════ */

let camStream  = null;
let detectionInterval = null;
let scanDone   = false;

const VIDEO  = $("cam-video");

function checkFacialFields() {
  if (facialActive) return;
  const escola = $("facial-escola");
  const btn = $("btn-cam-on");
  
  if (escola && btn) {
    btn.disabled = !escola.value;
  }
}

if ($("facial-escola")) $("facial-escola").addEventListener("change", checkFacialFields);
if ($("facial-turma")) $("facial-turma").addEventListener("change", checkFacialFields);

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

  checkFacialFields();
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
    checkFacialFields();
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
  if (!VIDEO || VIDEO.readyState < 2 || !VIDEO.videoWidth || !VIDEO.videoHeight) return;
  
  try {
    const canvas = document.createElement("canvas");
    canvas.width = VIDEO.videoWidth;
    canvas.height = VIDEO.videoHeight;
    // Espelha para coincidir com a visualização do usuário na selfie
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(VIDEO, 0, 0);
    
    const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return;

    const formData = new FormData();
    formData.append("file", blob, "frame.jpg");
    
    const selectEl = document.getElementById("facial-turma");
    if (selectEl && selectEl.value && selectEl.value !== "todas") {
      formData.append("turma_id", selectEl.value);
    }
    
    const res = await fetch(`${FACE_BACKEND_URL}/identify`, {
      method: "POST",
      body: formData
    });
    
    if (!res.ok) {
      console.warn("Falha no endpoint /identify:", res.status);
      return;
    }

    const data = await res.json();
    console.log("[Reconhecimento]", data);

    if (data.match && data.aluno_id) {
      scanDone = true; // Para o scanner ao identificar
      const s = students.find(al => al.id === data.aluno_id);
      const scorePct = data.score ? Math.round(data.score * 100) : 100;
      if (s) {
        showIdentified(s);
        setStatus("green", `Identificado: ${s.name} (${scorePct}%)! Entrando...`);
        setTimeout(() => {
          fazerLoginAlunoAutomatico(s);
        }, 700);
      } else {
        const alunoDoc = await firestoreDb.collection("alunos").doc(data.aluno_id).get();
        if (alunoDoc.exists) {
          const dbAluno = alunoDoc.data();
          let turmaNome = "";
          if (dbAluno.turma_id) {
            const tDoc = await firestoreDb.collection("turmas").doc(dbAluno.turma_id).get();
            if (tDoc.exists) turmaNome = tDoc.data().nome;
          }
          const studentObj = {
            id: alunoDoc.id,
            name: dbAluno.nome,
            turma: turmaNome,
            initials: (dbAluno.nome || "A")[0],
            recreio: false,
            almoco: false
          };
          showIdentified(studentObj);
          setStatus("green", `Identificado: ${dbAluno.nome} (${scorePct}%)! Entrando...`);
          setTimeout(() => {
            fazerLoginAlunoAutomatico(studentObj);
          }, 700);
        } else {
          scanDone = false;
          setStatus("red", "Aluno não encontrado na base");
        }
      }
    } else if (data.face_detected) {
      if (data.score && data.score > 0) {
        const pct = Math.round(data.score * 100);
        setStatus("gray", `Rosto detectado (${pct}%). Centralize e aproxime-se...`);
      } else {
        setStatus("gray", "Rosto detectado. Analisando...");
      }
    } else {
      setStatus("gray", "Posicione o rosto dentro da moldura...");
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
      🥐 Lanche — ${student.recreio ? "pediu" : "não pediu"}
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
      cadCamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
      });
      const vid = $("cad-aluno-video");
      vid.srcObject = cadCamStream;
      vid.style.display = "block";
      try { await vid.play(); } catch(e) {}
      $("btn-cad-ligar-cam").style.display = "none";
      $("btn-cad-tirar-foto").style.display = "block";
      $("cad-aluno-cam-status").textContent = "Posicione o rosto e clique em Tirar Foto";
    } catch(err) {
      console.error(err);
      $("cad-aluno-cam-status").textContent = "Erro ao acessar câmera: " + (err.message || err.name);
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

    const bcryptLib = window.dcodeIO ? window.dcodeIO.bcrypt : window.bcrypt;
    let pinHash = null;
    if (bcryptLib && senha) {
      const salt = bcryptLib.genSaltSync(6);
      pinHash = bcryptLib.hashSync(senha, salt);
    }

    const alunoDocRef = firestoreDb.collection("alunos").doc();
    const novoAlunoId = alunoDocRef.id;

    try {
      await alunoDocRef.set({
        id: novoAlunoId,
        nome: nome,
        turma_id: turmaId,
        matricula: matricula,
        pin_hash: pinHash,
        foto_url: null,
        ativo: true,
        consentimento_lgpd: true,
        tentativas_pin: 0,
        bloqueado_ate: null,
        created_at: new Date().toISOString()
      });
    } catch (saveErr) {
      if (btnTxt) btnTxt.classList.remove("hidden");
      if (btnLoader) btnLoader.classList.add("hidden");
      if (btnSubmit) btnSubmit.disabled = false;
      errEl.textContent = `Erro ao salvar: ${saveErr.message || "Verifique o banco de dados."}`;
      errEl.classList.remove("hidden");
      return;
    }

    if (btnTxt) btnTxt.classList.remove("hidden");
    if (btnLoader) btnLoader.classList.add("hidden");
    if (btnSubmit) btnSubmit.disabled = false;

    let biometriaMsg = "";
    if (cadPhotoBlob) {
      try {
        const formData = new FormData();
        formData.append("aluno_id", novoAlunoId);
        formData.append("file", cadPhotoBlob, "foto.jpg");
        
        const enrollRes = await fetch(`${FACE_BACKEND_URL}/enroll`, {
          method: "POST",
          body: formData
        });
        if (!enrollRes.ok) {
          const errData = await enrollRes.json().catch(() => ({}));
          biometriaMsg = errData.detail || "Rosto humano não reconhecido na foto.";
        }
      } catch(err) {
        console.error("Erro ao fazer enroll da face:", err);
      }
    }

    fecharModalCadastroAluno();
    await carregarAlunos();
    renderCoord();
    
    if (biometriaMsg) {
      alert(`Aluno(a) ${nome} cadastrado(a)!\n\nAviso sobre a Biometria Facial:\n${biometriaMsg}\n\nVocê poderá capturar a biometria facial posteriormente na aba "Gestão Facial".`);
    } else {
      showToast(`Aluno(a) ${nome} cadastrado(a) com sucesso!`);
    }
  });
}

/* ══════════════════════════════════════════════════════════
   VISÃO 4: GESTÃO FACIAL (NOVA TELA)
   ══════════════════════════════════════════════════════════ */
let facialCamStream = null;
let facialBlob = null;
let selectedFacialAlunoId = null;

const viewFacial = $("coord-view-facial");
const viewClassesFacial = $("coord-view-classes");
const btnGestaoFacial = $("btn-gestao-facial");
const crumbToClassesFacial = $("crumb-to-classes-facial");

const fSelectTurma = $("facial-select-turma");
const fSelectAluno = $("facial-select-aluno");

const fCamSection = $("facial-camera-section");
const fVideo = $("facial-cam-video");
const fCanvas = $("facial-cam-canvas");
const fStatus = $("facial-cam-status");
const fBtnCapture = $("btn-facial-capture");
const fBtnRetake = $("btn-facial-retake");
const fBtnSave = $("btn-facial-save");
const fErrorMsg = $("facial-error-msg");

function updateFacialStep(step) {
  const step1 = $("fstep-1");
  const step2 = $("fstep-2");
  const step3 = $("fstep-3");
  const line1 = $("fstep-line-1");
  const line2 = $("fstep-line-2");
  if (!step1 || !step2 || !step3) return;

  [step1, step2, step3].forEach(s => s.classList.remove("active", "completed"));
  if (line1) line1.classList.remove("completed");
  if (line2) line2.classList.remove("completed");

  if (step === 1) {
    step1.classList.add("active");
  } else if (step === 2) {
    step1.classList.add("completed");
    if (line1) line1.classList.add("completed");
    step2.classList.add("active");
  } else if (step === 3) {
    step1.classList.add("completed");
    step2.classList.add("completed");
    if (line1) line1.classList.add("completed");
    if (line2) line2.classList.add("completed");
    step3.classList.add("active", "completed");
  }
}

function openGestaoFacial() {
  if (viewClassesFacial) viewClassesFacial.classList.add("hidden");
  if ($("coord-view-students")) $("coord-view-students").classList.add("hidden");
  if ($("coord-view-reset")) $("coord-view-reset").classList.add("hidden");
  if ($("coord-view-new-password")) $("coord-view-new-password").classList.add("hidden");
  
  if (viewFacial) viewFacial.classList.remove("hidden");

  // Reset estado
  stopFacialCamera();
  fCamSection.classList.add("hidden");
  fSelectTurma.innerHTML = '<option value="" disabled selected>Selecione a turma...</option>';
  fSelectAluno.innerHTML = '<option value="" disabled selected>Selecione a turma primeiro...</option>';
  fSelectAluno.disabled = true;
  updateFacialStep(1);

  // Popula turmas escolares (sem a opção Exceções)
  ALL_TURMAS.filter(t => t !== "Exceções").forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    fSelectTurma.appendChild(opt);
  });
}

function closeGestaoFacial() {
  if (viewFacial) viewFacial.classList.add("hidden");
  stopFacialCamera();
  renderCoord(); // Volta pra view de turmas
}

function startFacialCamera() {
  fStatus.textContent = "Iniciando câmera...";
  fCamSection.classList.remove("hidden");
  fVideo.style.display = "block";
  fCanvas.style.display = "none";
  fBtnCapture.classList.remove("hidden");
  fBtnRetake.classList.add("hidden");
  fBtnSave.disabled = true;
  fErrorMsg.classList.add("hidden");
  facialBlob = null;

  navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
  })
    .then(async stream => {
      facialCamStream = stream;
      fVideo.srcObject = stream;
      try {
        await fVideo.play();
      } catch (e) {
        console.warn("Video play error:", e);
      }
      fStatus.textContent = "Câmera pronta! Centralize o rosto e capture.";
    })
    .catch(err => {
      console.error(err);
      fStatus.textContent = "Erro ao acessar câmera: " + (err.message || err.name);
    });
}

function stopFacialCamera() {
  if (facialCamStream) {
    facialCamStream.getTracks().forEach(t => t.stop());
    facialCamStream = null;
  }
  if (fVideo) fVideo.srcObject = null;
}

if (btnGestaoFacial) btnGestaoFacial.addEventListener("click", openGestaoFacial);
if (crumbToClassesFacial) crumbToClassesFacial.addEventListener("click", closeGestaoFacial);

if (fSelectTurma) {
  fSelectTurma.addEventListener("change", () => {
    const turma = fSelectTurma.value;
    fSelectAluno.innerHTML = '<option value="" disabled selected>Selecione o aluno...</option>';
    fSelectAluno.disabled = false;
    stopFacialCamera();
    fCamSection.classList.add("hidden");
    updateFacialStep(1);

    const alunosTurma = students.filter(s => s.turma === turma).sort((a,b) => a.name.localeCompare(b.name));
    alunosTurma.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      fSelectAluno.appendChild(opt);
    });
  });
}

if (fSelectAluno) {
  fSelectAluno.addEventListener("change", () => {
    selectedFacialAlunoId = fSelectAluno.value;
    if (selectedFacialAlunoId) {
      updateFacialStep(2);
      startFacialCamera();
    } else {
      updateFacialStep(1);
    }
  });
}

if (fBtnCapture) {
  fBtnCapture.addEventListener("click", () => {
    if (!facialCamStream || !fVideo) return;
    
    const vw = fVideo.videoWidth || 640;
    const vh = fVideo.videoHeight || 480;
    
    // Calcula o corte quadrado central exato (o que o usuário vê na caixa 1:1)
    const size = Math.min(vw, vh);
    const sx = Math.floor((vw - size) / 2);
    const sy = Math.floor((vh - size) / 2);
    
    fCanvas.width = size;
    fCanvas.height = size;
    const ctx = fCanvas.getContext("2d");
    
    // Espelha horizontalmente para coincidir com a visualização espelhada da câmera selfie
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(fVideo, sx, sy, size, size, 0, 0, size, size);
    
    fVideo.style.display = "none";
    fCanvas.style.display = "block";
    fBtnCapture.classList.add("hidden");
    fBtnRetake.classList.remove("hidden");
    fBtnSave.disabled = true;
    fStatus.textContent = "Processando foto...";
    
    fCanvas.toBlob(blob => {
      facialBlob = blob;
      fBtnSave.disabled = false;
      fStatus.textContent = "Foto capturada! Salve para registrar na base.";
    }, "image/jpeg", 0.92);
  });
}

if (fBtnRetake) {
  fBtnRetake.addEventListener("click", () => {
    facialBlob = null;
    fCanvas.style.display = "none";
    fVideo.style.display = "block";
    fBtnRetake.classList.add("hidden");
    fBtnCapture.classList.remove("hidden");
    fBtnSave.disabled = true;
    fStatus.textContent = "Câmera pronta! Centralize o rosto e capture.";
  });
}

if (fBtnSave) {
  fBtnSave.addEventListener("click", async () => {
    if (!facialBlob) {
      fErrorMsg.textContent = "Capture uma foto com a câmera antes de salvar.";
      fErrorMsg.classList.remove("hidden");
      return;
    }
    if (!selectedFacialAlunoId) {
      fErrorMsg.textContent = "Selecione o aluno antes de salvar.";
      fErrorMsg.classList.remove("hidden");
      return;
    }
    
    const txt = fBtnSave.querySelector(".btn-txt");
    const loader = fBtnSave.querySelector(".btn-loader");
    
    if (txt) txt.classList.add("hidden");
    if (loader) loader.classList.remove("hidden");
    fBtnSave.disabled = true;
    fErrorMsg.classList.add("hidden");
    fStatus.textContent = "Enviando biometria facial...";
    
    const formData = new FormData();
    formData.append("aluno_id", selectedFacialAlunoId);
    formData.append("file", facialBlob, "nova_foto_facial.jpg");
    
    try {
      const res = await fetch(`${FACE_BACKEND_URL}/enroll`, {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || ("Falha no servidor: " + res.status));
      }
      
      showToast("Biometria Facial registrada com sucesso!");
      updateFacialStep(3);
      
      // Reseta para o próximo após breve exibição do feedback
      setTimeout(() => {
        fSelectAluno.value = "";
        stopFacialCamera();
        fCamSection.classList.add("hidden");
        updateFacialStep(1);
      }, 1500);
      
    } catch(err) {
      console.error(err);
      let msg = err.message || "";
      if (msg === "Failed to fetch") {
        msg = "Falha de conexão com a API de reconhecimento facial. Se estiver rodando localmente, execute o arquivo iniciar_backend.bat. Se estiver no Render, verifique se a API subiu.";
      }
      fErrorMsg.textContent = "Erro ao enviar foto: " + msg;
      fErrorMsg.classList.remove("hidden");
      fStatus.textContent = "Erro no envio.";
    } finally {
      if (txt) txt.classList.remove("hidden");
      if (loader) loader.classList.add("hidden");
      fBtnSave.disabled = false;
    }
  });
}