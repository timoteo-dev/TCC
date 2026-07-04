const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ordemPassos = ["escolha", "identidade", "pronto"];

const video = document.getElementById("video");
const canvasVideo = document.getElementById("canvasVideo");
const anel = document.getElementById("anel");
const statusReconhecimento = document.getElementById("statusReconhecimento");

const tituloPin = document.getElementById("tituloPin");
const subtituloPin = document.getElementById("subtituloPin");
const visorPin = document.getElementById("visorPin");
const teclado = document.getElementById("teclado");

let tipoRefeicao = "";
let stream = null;
let cameraRodando = false;
let travadoProcessando = false;
let intervaloDeteccao = null;

let modoPin = "matricula"; // "matricula" | "pin"
let bufferMatricula = "";
let bufferPin = "";

// ---------- Navegação entre telas ----------

function mostrarTela(nome) {
  document.querySelectorAll(".tela").forEach((tela) => {
    tela.hidden = tela.dataset.tela !== nome;
  });
}

function atualizarTrilha(passoAtivo) {
  const idxAtivo = ordemPassos.indexOf(passoAtivo);
  document.querySelectorAll(".passo").forEach((passo) => {
    const idx = ordemPassos.indexOf(passo.dataset.passo);
    passo.classList.remove("ativo", "concluido");
    if (idx < idxAtivo) passo.classList.add("concluido");
    else if (idx === idxAtivo) passo.classList.add("ativo");
  });
}

function reiniciar() {
  tipoRefeicao = "";
  pararCamera();
  modoPin = "matricula";
  bufferMatricula = "";
  bufferPin = "";
  mostrarTela("escolha");
  atualizarTrilha("escolha");
}

// ---------- Escolha da refeição ----------

document.querySelectorAll(".opcao").forEach((botao) => {
  botao.addEventListener("click", () => {
    tipoRefeicao = botao.dataset.tipo;
    atualizarTrilha("identidade");
    mostrarTela("identidade");
    iniciarCamera();
  });
});

// ---------- Reconhecimento facial ----------

const modelosProntos = (async () => {
  await faceapi.nets.tinyFaceDetector.loadFromUri(URL_MODELOS_FACE);
  await faceapi.nets.faceLandmark68Net.loadFromUri(URL_MODELOS_FACE);
  await faceapi.nets.faceRecognitionNet.loadFromUri(URL_MODELOS_FACE);
})();

async function iniciarCamera() {
  anel.className = "anel";
  statusReconhecimento.textContent = "Preparando câmera…";

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    video.srcObject = stream;
  } catch (erro) {
    statusReconhecimento.textContent = "Não consegui acessar a câmera. Use o PIN abaixo.";
    return;
  }

  await modelosProntos;
  if (!stream) return; // aluno já pode ter trocado para o PIN nesse meio tempo

  statusReconhecimento.textContent = "Olhe para a câmera…";
  anel.classList.add("buscando");
  cameraRodando = true;
  video.onplay = iniciarDeteccao;
}

function pararCamera() {
  cameraRodando = false;
  clearInterval(intervaloDeteccao);
  if (stream) {
    stream.getTracks().forEach((faixa) => faixa.stop());
    stream = null;
  }
}

function iniciarDeteccao() {
  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvasVideo, displaySize);

  intervaloDeteccao = setInterval(async () => {
    if (!cameraRodando || travadoProcessando) return;

    const deteccao = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    const ctx = canvasVideo.getContext("2d");
    ctx.clearRect(0, 0, canvasVideo.width, canvasVideo.height);
    if (!deteccao) return;

    travadoProcessando = true;
    statusReconhecimento.textContent = "Confirmando identidade…";

    const descritor = Array.from(deteccao.descriptor);
    const { data, error } = await supabase.rpc("processar_pedido_facial", {
      p_descriptor: descritor,
      p_tipo: tipoRefeicao,
      p_limiar: LIMIAR_RECONHECIMENTO,
    });

    if (error) {
      mostrarErroTecnico(error);
      return;
    }

    const resultado = data && data[0];

    if (!resultado || resultado.status === "nao_reconhecido") {
      anel.className = "anel erro";
      statusReconhecimento.textContent = "Não te reconheci. Tente de novo ou use o PIN.";
      setTimeout(() => {
        travadoProcessando = false;
        anel.className = "anel buscando";
        statusReconhecimento.textContent = "Olhe para a câmera…";
      }, 1300);
      return;
    }

    anel.className = "anel sucesso";
    pararCamera();
    tratarResultado(resultado);
  }, 700);
}

// ---------- PIN (alternativa à câmera) ----------

function montarTeclado() {
  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "apagar", "0", "confirmar"];
  teclado.innerHTML = "";
  teclas.forEach((tecla) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className =
      "tecla" + (tecla === "apagar" ? " especial" : "") + (tecla === "confirmar" ? " confirmar" : "");
    botao.textContent = tecla === "apagar" ? "⌫" : tecla === "confirmar" ? "OK" : tecla;
    botao.addEventListener("click", () => tratarTecla(tecla));
    teclado.appendChild(botao);
  });
}

function atualizarVisor() {
  visorPin.textContent = modoPin === "matricula" ? bufferMatricula : "•".repeat(bufferPin.length);
}

function tratarTecla(tecla) {
  if (tecla === "apagar") {
    if (modoPin === "matricula") bufferMatricula = bufferMatricula.slice(0, -1);
    else bufferPin = bufferPin.slice(0, -1);
  } else if (tecla === "confirmar") {
    if (modoPin === "matricula") {
      if (bufferMatricula.length === 0) return;
      modoPin = "pin";
      bufferPin = "";
      tituloPin.textContent = "Digite seu PIN";
      subtituloPin.textContent = "De 4 a 6 dígitos";
    } else {
      if (bufferPin.length < 4) return;
      confirmarPin();
      return;
    }
  } else {
    if (modoPin === "matricula" && bufferMatricula.length < 10) bufferMatricula += tecla;
    if (modoPin === "pin" && bufferPin.length < 6) bufferPin += tecla;
  }
  atualizarVisor();
}

async function confirmarPin() {
  teclado.querySelectorAll(".tecla").forEach((botao) => (botao.disabled = true));
  subtituloPin.textContent = "Confirmando…";

  const { data, error } = await supabase.rpc("processar_pedido_pin", {
    p_matricula: bufferMatricula,
    p_pin: bufferPin,
    p_tipo: tipoRefeicao,
  });

  teclado.querySelectorAll(".tecla").forEach((botao) => (botao.disabled = false));

  if (error) {
    mostrarErroTecnico(error);
    return;
  }

  const resultado = data && data[0];

  if (!resultado || resultado.status === "nao_encontrado") {
    subtituloPin.textContent = "Matrícula ou PIN incorretos. Tente de novo.";
    modoPin = "matricula";
    bufferMatricula = "";
    bufferPin = "";
    tituloPin.textContent = "Digite sua matrícula";
    atualizarVisor();
    return;
  }

  tratarResultado(resultado);
}

document.getElementById("btnUsarPin").addEventListener("click", () => {
  pararCamera();
  modoPin = "matricula";
  bufferMatricula = "";
  bufferPin = "";
  tituloPin.textContent = "Digite sua matrícula";
  subtituloPin.textContent = "Use o teclado abaixo";
  atualizarVisor();
  mostrarTela("pin");
});

document.getElementById("btnUsarCamera").addEventListener("click", () => {
  mostrarTela("identidade");
  iniciarCamera();
});

// ---------- Resultado final ----------

function tratarResultado(resultado) {
  mostrarTela("resultado");
  atualizarTrilha("pronto");

  const el = document.getElementById("resultadoConteudo");

  if (resultado.status === "confirmado") {
    el.className = "resultado confirmado";
    el.innerHTML = `
      <div class="resultado-icone">🎉</div>
      <p class="resultado-titulo">Prontinho, ${resultado.nome}!</p>
      <p class="resultado-subtitulo">Sua refeição foi registrada. Bom apetite!</p>`;
  } else if (resultado.status === "ja_registrado") {
    el.className = "resultado aviso";
    el.innerHTML = `
      <div class="resultado-icone">🤔</div>
      <p class="resultado-titulo">Oi, ${resultado.nome}!</p>
      <p class="resultado-subtitulo">Você já registrou sua refeição hoje.</p>`;
  }

  setTimeout(reiniciar, 4500);
}

function mostrarErroTecnico(error) {
  console.error(error);
  travadoProcessando = false;
  pararCamera();
  mostrarTela("resultado");
  const el = document.getElementById("resultadoConteudo");
  el.className = "resultado erro";
  el.innerHTML = `
    <div class="resultado-icone">⚠️</div>
    <p class="resultado-titulo">Ops, algo travou</p>
    <p class="resultado-subtitulo">Chame a coordenação, por favor.</p>`;
  setTimeout(reiniciar, 4500);
}

// ---------- Inicialização ----------

montarTeclado();
atualizarTrilha("escolha");