/* ══════════════════════════════════════════════════════════
   MERENDA ESCOLAR — app.js
   Lógica de navegação, pedidos, coordenação, cozinha
   e reconhecimento facial com BlazeFace (TF.js)
   ══════════════════════════════════════════════════════════ */

"use strict";

/* ── DADOS ───────────────────────────────────────────────── */
const STUDENTS = [
  { id:1, name:"Ana Silva",     turma:"3A", recreio:true,  almoco:true,  initials:"AS" },
  { id:2, name:"Bruno Costa",   turma:"3A", recreio:false, almoco:true,  initials:"BC" },
  { id:3, name:"Carla Mendes",  turma:"3A", recreio:true,  almoco:false, initials:"CM" },
  { id:4, name:"Diego Alves",   turma:"3A", recreio:true,  almoco:true,  initials:"DA" },
  { id:5, name:"Elena Souza",   turma:"3B", recreio:false, almoco:false, initials:"ES" },
  { id:6, name:"Felipe Ramos",  turma:"3B", recreio:true,  almoco:true,  initials:"FR" },
  { id:7, name:"Gabriela Lima", turma:"3B", recreio:false, almoco:true,  initials:"GL" },
  { id:8, name:"Hugo Martins",  turma:"3B", recreio:true,  almoco:true,  initials:"HM" },
];

let students = JSON.parse(JSON.stringify(STUDENTS)); // cópia mutável

/* ── ESTADO DE AUTENTICAÇÃO ──────────────────────────────── */
let isLoggedIn = false;
let currentUser = null;

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

/* ── NAVEGAÇÃO ───────────────────────────────────────────── */
const ROLE_DEST = { aluno:"aluno", coordenacao:"coordenacao", cozinha:"cozinha" };
let activeRole = "aluno";
let facialActive = false;

function goTo(name) {
  // Desativa câmera ao sair da tela facial
  if (facialActive && name !== "facial") {
    stopCamera();
  }

  // CONTROLE DE ACESSO: Bloqueia abas protegidas se não estiver logado
  if (!isLoggedIn && (name === "aluno" || name === "coordenacao" || name === "cozinha")) {
    $("modal-backdrop").classList.remove("hidden");
    return;
  }

  $$(".screen").forEach(s   => s.classList.remove("active"));
  $$(".nav-tab").forEach(b  => b.classList.remove("active"));

  const sc = $("screen-" + name);
  const bt = document.querySelector(`.nav-tab[data-screen="${name}"]`);
  if (sc) sc.classList.add("active");
  if (bt) bt.classList.add("active");

  if (name === "coordenacao") renderCoord();
  if (name === "cozinha")     renderCozinha();
  // Nota: A câmera não inicia mais sozinha ao entrar na aba 'facial'. 
  // O usuário precisa clicar em "Ligar Câmera".
}

// Fechar Modal de Acesso Negado e ir para Login
$("modal-btn-login").addEventListener("click", () => {
  $("modal-backdrop").classList.add("hidden");
  goTo("login");
});

// Tabs de navegação
$$(".nav-tab").forEach(btn => {
  btn.addEventListener("click", () => goTo(btn.dataset.screen));
});

// Seleção de perfil no Login
$$(".role-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".role-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeRole = btn.dataset.role;
  });
});

// Botão de Entrar (Login com Nome e Senha)
$("btn-login").addEventListener("click", () => {
  const inputNome = $("input-nome").value.trim();
  const inputSenha = $("input-senha").value.trim();

  // Validação simples (futuramente será validado no Banco de Dados)
  if (!inputNome || !inputSenha) {
    $("login-error").classList.remove("hidden");
    return;
  }
  
  $("login-error").classList.add("hidden");
  isLoggedIn = true;
  currentUser = { nome: inputNome, role: activeRole };

  // Remove o cadeado visual das abas
  $$(".nav-protected").forEach(tab => tab.classList.add("unlocked"));

  // Se o login for como Aluno, atualiza os dados na tela de boas-vindas
  if (activeRole === "aluno") {
    $("aluno-nome-display").textContent = inputNome;
    
    // Gera as iniciais do nome para o Avatar
    const nameParts = inputNome.split(" ");
    let initials = nameParts[0][0];
    if (nameParts.length > 1) {
      initials += nameParts[nameParts.length - 1][0];
    }
    $("aluno-avatar-display").textContent = initials.toUpperCase();
  }

  showToast(`Bem-vindo(a), ${inputNome}!`);
  goTo(ROLE_DEST[activeRole] || "aluno");
});

/* ── TELA ALUNO ──────────────────────────────────────────── */
const selectedMeals = { recreio: false, almoco: false };

// Atualiza visual de botões individuais e do botão "Ambas"
function updateMealUI() {
  // Atualiza os cards individuais
  ["recreio", "almoco"].forEach(meal => {
    const card = $("meal-" + meal);
    card.classList.toggle("selected", selectedMeals[meal]);
    $("check-" + meal).textContent = selectedMeals[meal] ? "✓" : "";
  });

  // Atualiza o visual do botão "Selecionar Ambas"
  const btnAmbas = $("btn-ambas");
  const checkAmbas = $("ambas-check");
  
  if (selectedMeals.recreio && selectedMeals.almoco) {
    btnAmbas.classList.add("selected");
    checkAmbas.classList.remove("hidden");
  } else {
    btnAmbas.classList.remove("selected");
    checkAmbas.classList.add("hidden");
  }

  // Atualiza o botão final de confirmação
  const btnConfirm = $("btn-confirm-order");
  const any = selectedMeals.recreio || selectedMeals.almoco;
  btnConfirm.disabled = !any;
  btnConfirm.textContent = any ? "Confirmar Pedido" : "Selecione ao menos uma refeição";
}

// Clicks nos cards individuais
["recreio", "almoco"].forEach(meal => {
  const card = $("meal-" + meal);
  card.addEventListener("click", () => {
    selectedMeals[meal] = !selectedMeals[meal];
    updateMealUI();
  });
});

// Click no botão "Selecionar Ambas"
$("btn-ambas").addEventListener("click", () => {
  // Se ambas já estiverem selecionadas, desmarca as duas. Caso contrário, marca as duas.
  const turnOn = !(selectedMeals.recreio && selectedMeals.almoco);
  selectedMeals.recreio = turnOn;
  selectedMeals.almoco = turnOn;
  updateMealUI();
});

$("btn-confirm-order").addEventListener("click", () => {
  $("aluno-order-section").classList.add("hidden");
  const confirmed = $("aluno-confirmed");
  confirmed.classList.remove("hidden");

  const tags = $("confirmed-tags");
  tags.innerHTML = "";
  if (selectedMeals.recreio) tags.innerHTML += `<span class="cb-tag">🥐 1º Recreio</span>`;
  if (selectedMeals.almoco)  tags.innerHTML += `<span class="cb-tag">🍽️ Almoço</span>`;
  
  showToast("Pedido confirmado com sucesso!");
});

/* ── TELA COORDENAÇÃO ────────────────────────────────────── */
function calcStats() {
  const nRecreo  = students.filter(s => s.recreio).length;
  const nAlmoco  = students.filter(s => s.almoco).length;
  const nTotal   = students.filter(s => s.recreio || s.almoco).length;
  const nSem     = students.length - nTotal;
  return { nRecreo, nAlmoco, nTotal, nSem };
}

function renderCoord() {
  $("coord-date").textContent = formatDate();
  const { nRecreo, nAlmoco, nTotal, nSem } = calcStats();
  $("stat-recreio").textContent = nRecreo;
  $("stat-almoco").textContent  = nAlmoco;
  $("stat-total").textContent   = nTotal;
  $("stat-sem").textContent     = nSem;

  const byTurma = {};
  students.forEach(s => {
    if (!byTurma[s.turma]) byTurma[s.turma] = [];
    byTurma[s.turma].push(s);
  });

  const list = $("coord-list");
  list.innerHTML = "";

  Object.entries(byTurma).forEach(([turma, alunos]) => {
    const header = document.createElement("div");
    header.className = "turma-header";
    header.textContent = "Turma " + turma;
    list.appendChild(header);

    alunos.forEach(a => {
      const row = document.createElement("div");
      row.className = "student-row";
      row.innerHTML = `
        <div class="s-avatar">${a.initials}</div>
        <span class="s-name">${a.name}</span>
        <div class="meal-badges">
          <span class="mbadge ${a.recreio ? "sim" : "nao"}" data-id="${a.id}" data-meal="recreio">🥐 Recreio</span>
          <span class="mbadge ${a.almoco  ? "sim" : "nao"}" data-id="${a.id}" data-meal="almoco">🍽️ Almoço</span>
        </div>
        <button class="act-btn" data-action="senha" data-id="${a.id}">Senha</button>
      `;
      list.appendChild(row);
    });
  });

  list.querySelectorAll(".mbadge").forEach(badge => {
    badge.addEventListener("click", () => {
      const id   = parseInt(badge.dataset.id);
      const meal = badge.dataset.meal;
      const s    = students.find(s => s.id === id);
      s[meal]    = !s[meal];
      showToast(`${s.name}: ${meal === "recreio" ? "recreio" : "almoço"} ${s[meal] ? "adicionado" : "removido"}`);
      renderCoord();
      syncCozinha();
    });
  });

  list.querySelectorAll("[data-action='senha']").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = students.find(s => s.id === parseInt(btn.dataset.id));
      showToast(`Senha de ${s.name} foi resetada`);
    });
  });
}

$("btn-add-excecao").addEventListener("click", () => {
  showToast("Exceção adicionada com sucesso");
  syncCozinha();
});

/* ── TELA COZINHA ────────────────────────────────────────── */
function renderCozinha() {
  const dateStr = new Date().toLocaleDateString("pt-BR", { day:"numeric", month:"short", year:"numeric" });
  const el = $("cz-date");
  if (el) el.textContent = formatDate();
  const chip = $("cz-chip-date");
  if (chip) chip.textContent = dateStr;
  syncCozinha();
}

function syncCozinha() {
  const { nRecreo, nAlmoco } = calcStats();
  const r = $("cz-recreio");
  const a = $("cz-almoco");
  if (r) r.textContent = nRecreo;
  if (a) a.textContent = nAlmoco;

  const sr = $("stat-recreio");
  if (sr) {
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

// Eventos dos botões de Câmera
$("btn-cam-on").addEventListener("click", () => initFacial());
$("btn-cam-off").addEventListener("click", () => stopCamera());

function setStatus(dot, text) {
  const d = $("fs-dot");
  const t = $("fs-text");
  d.className = "fs-dot " + dot;
  t.textContent = text;
}

function showOverlay(show, msg = "") {
  const overlay = $("cam-overlay");
  const msgEl   = $("cam-msg");
  if (show) {
    overlay.classList.remove("hidden");
    msgEl.textContent = msg;
  } else {
    overlay.classList.add("hidden");
  }
}

function stopCamera() {
  facialActive = false;
  if (rafId)     { cancelAnimationFrame(rafId); rafId = null; }
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);
  
  showOverlay(true, "Câmera pausada. Pressione 'Ligar Câmera' para iniciar.");
  setStatus("gray", "Câmera desativada");

  // Altera o estado dos botões
  $("btn-cam-on").disabled = false;
  $("btn-cam-off").disabled = true;
}

function loadScript(src, check) {
  return new Promise((resolve, reject) => {
    if (check()) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Falha ao carregar: " + src));
    document.head.appendChild(s);
  });
}

async function initFacial() {
  if (facialActive) return;
  facialActive = true;
  scanDone = false;
  firstFaceAt = null;

  $("id-result").classList.add("hidden");
  showOverlay(true, "Aguardando permissão e inicializando IA...");
  setStatus("gray", "Carregando modelo de reconhecimento...");

  try {
    await loadScript(
      "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js",
      () => typeof window.tf !== "undefined"
    );

    await loadScript(
      "https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.1.0/dist/blazeface.min.js",
      () => typeof window.blazeface !== "undefined"
    );

    setStatus("gray", "Carregando modelo BlazeFace...");

    if (!tfModel) {
      tfModel = await window.blazeface.load();
    }

    setStatus("gray", "Solicitando acesso à câmera...");
    
    // Pede permissão para a câmera
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
    });

    VIDEO.srcObject = camStream;
    await new Promise(res => { VIDEO.onloadedmetadata = res; });
    await VIDEO.play();

    showOverlay(false);
    setStatus("gray", "Posicione o rosto do aluno na câmera");
    
    // Habilita o botão de desligar e desabilita o de ligar
    $("btn-cam-on").disabled = true;
    $("btn-cam-off").disabled = false;

    startDetectionLoop();

  } catch (err) {
    console.error(err);
    const msg = err.name === "NotAllowedError"
      ? "Permissão de câmera negada. Verifique as configurações do navegador."
      : "Não foi possível iniciar a câmera ou o modelo de IA.";
    showOverlay(true, msg);
    setStatus("gray", "Câmera indisponível");
    facialActive = false;
    
    // Reseta botões em caso de erro
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
          setStatus("yellow", "Identificando aluno...");
        }

        const elapsed = Date.now() - firstFaceAt;
        const progress = Math.min(elapsed / 2600, 1);
        drawProgressBar(x1, y2 + 8, w, progress);

        if (elapsed > 2600 && !scanDone) {
          scanDone = true;
          drawSuccess(x1, y1, w, h);
          setTimeout(() => showIdentified(students[0]), 200);
          return;
        }

      } else {
        firstFaceAt = null;
        CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);
        setStatus("gray", "Posicione o rosto do aluno na câmera");
      }
    } catch (_) { /* frame skip silencioso */ }

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

  const meals = $("ir-meals");
  meals.innerHTML = `
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
  setStatus("gray", "Posicione o rosto do aluno na câmera");
  startDetectionLoop();
});

/* ── INICIALIZAÇÃO ───────────────────────────────────────── */
(function init() {
  const d = formatDate();
  const el1 = $("cz-date");
  const el2 = $("cz-chip-date");
  if (el1) el1.textContent = d;
  if (el2) el2.textContent = new Date().toLocaleDateString("pt-BR", { day:"numeric", month:"short", year:"numeric" });

  syncCozinha();
})();