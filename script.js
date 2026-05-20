const video = document.getElementById("videoEscola");
const container = document.getElementById("containerVideo");
const painelStatus = document.getElementById("statusCatraca");
const corpoTabela = document.getElementById("corpoTabela");
const btnLigar = document.getElementById("btnLigar");
const btnReset = document.getElementById("btnReset");
const btnExportar = document.getElementById("btnExportar");

// Botões de escolha de refeição
const btnCafe = document.getElementById("btnCafe");
const btnAlmoco = document.getElementById("btnAlmoco");
const btnAmbos = document.getElementById("btnAmbos");

let comparadorDeRostos; 
let catracaLiberada = true; 
const alunosQueJaComeram = new Set(); 
const LISTA_ALUNOS = ["Kaio"]; 

// Variável que guarda o que o aluno escolheu
let refeicaoSelecionada = "";

// Função para marcar o botão clicado
function selecionarOpcao(escolha, botaoClicado) {
    refeicaoSelecionada = escolha;
    
    // Tira a marcação de todos
    btnCafe.classList.remove("ativo");
    btnAlmoco.classList.remove("ativo");
    btnAmbos.classList.remove("ativo");
    
    // Marca só o que foi clicado
    botaoClicado.classList.add("ativo");
    painelStatus.innerText = "OPÇÃO SELECIONADA! OLHE PARA A CÂMERA.";
    painelStatus.className = "status alerta";
}

btnCafe.addEventListener("click", () => selecionarOpcao("Café", btnCafe));
btnAlmoco.addEventListener("click", () => selecionarOpcao("Almoço", btnAlmoco));
btnAmbos.addEventListener("click", () => selecionarOpcao("Café e Almoço", btnAmbos));

function tocarBipe(tipo) {
    const contexto = new (window.AudioContext || window.webkitAudioContext)();
    const osc = contexto.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(tipo === 'erro' ? 220 : 880, contexto.currentTime);
    osc.connect(contexto.destination);
    osc.start();
    osc.stop(contexto.currentTime + 0.2);
}

async function iniciarIA() {
    const URL_MODELOS = 'https://vladmandic.github.io/face-api/model/';
    await faceapi.nets.tinyFaceDetector.loadFromUri(URL_MODELOS);
    await faceapi.nets.faceLandmark68Net.loadFromUri(URL_MODELOS);
    await faceapi.nets.faceRecognitionNet.loadFromUri(URL_MODELOS);

    const descritores = await Promise.all(LISTA_ALUNOS.map(async nome => {
        const img = document.getElementById(nome);
        const detec = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        return new faceapi.LabeledFaceDescriptors(nome, [detec.descriptor]);
    }));

    comparadorDeRostos = new faceapi.FaceMatcher(descritores, 0.45);
    painelStatus.innerText = "SISTEMA PRONTO. ESCOLHA UMA OPÇÃO.";
}

iniciarIA();

btnLigar.addEventListener("click", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
});

btnReset.addEventListener("click", () => {
    alunosQueJaComeram.clear();
    corpoTabela.innerHTML = "";
    refeicaoSelecionada = "";
    btnCafe.classList.remove("ativo");
    btnAlmoco.classList.remove("ativo");
    btnAmbos.classList.remove("ativo");
    alert("Lista zerada para o próximo turno!");
});

// Atualizei a exportação para incluir a coluna de Refeição
btnExportar.addEventListener("click", () => {
    if (alunosQueJaComeram.size === 0) return alert("Nenhum aluno registrou refeição.");
    let csv = "Nome,Refeicao,Horario,Status\n";
    const linhas = corpoTabela.querySelectorAll("tr");
    linhas.forEach(linha => {
        const col = linha.querySelectorAll("td");
        csv += `${col[0].innerText},${col[1].innerText},${col[2].innerText},${col[3].innerText}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = `Relatorio_Merenda_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
    link.click();
});

video.addEventListener("play", () => {
    // 1. Cria o canvas
    const canvas = faceapi.createCanvasFromMedia(video);
    container.append(canvas);

    // 2. Usa videoWidth/Height em vez de width/height para garantir que não seja 0
    const displaySize = { 
        width: video.videoWidth || video.width, 
        height: video.videoHeight || video.height 
    };

    // Só prossegue se as dimensões forem válidas
    if (displaySize.width === 0 || displaySize.height === 0) {
        console.warn("Aguardando dimensões do vídeo...");
        return; 
    }

    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        // Verifica se há dimensões válidas antes de redimensionar
        if (displaySize.width > 0 && displaySize.height > 0) {
            const resized = faceapi.resizeResults(detections, displaySize);
            canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

            resized.forEach(det => {
                const result = comparadorDeRostos.findBestMatch(det.descriptor);
                new faceapi.draw.DrawBox(det.detection.box, { label: result.toString() }).draw(canvas);

                if (result.label !== "unknown" && catracaLiberada) {
                    if (refeicaoSelecionada === "") {
                        painelStatus.className = "status bloqueado";
                        painelStatus.innerText = "CLIQUE NA REFEIÇÃO PRIMEIRO!";
                        return; 
                    }

                    if (alunosQueJaComeram.has(result.label)) {
                        painelStatus.className = "status alerta";
                        painelStatus.innerText = `REFEIÇÃO JÁ REGISTRADA: ${result.label.toUpperCase()}`;
                        tocarBipe('erro');
                    } else {
                        catracaLiberada = false;
                        alunosQueJaComeram.add(result.label);
                        
                        painelStatus.className = "status liberado";
                        painelStatus.innerText = `CONFIRMADO: ${result.label.toUpperCase()} (${refeicaoSelecionada})`;
                        tocarBipe('sucesso');
                        
                        const row = `<tr>
                            <td><strong>${result.label}</strong></td>
                            <td>${refeicaoSelecionada}</td>
                            <td>${new Date().toLocaleTimeString()}</td>
                            <td><span class="tag-sucesso">CONFIRMADO</span></td>
                        </tr>`;
                        corpoTabela.innerHTML = row + corpoTabela.innerHTML;

                        refeicaoSelecionada = "";
                        btnCafe.classList.remove("ativo");
                        btnAlmoco.classList.remove("ativo");
                        btnAmbos.classList.remove("ativo");

                        setTimeout(() => {
                            catracaLiberada = true;
                            painelStatus.className = "status bloqueado";
                            painelStatus.innerText = "PRÓXIMO: ESCOLHA A REFEIÇÃO";
                        }, 4000);
                    }
                }
            });
        }
    }, 100);
});
