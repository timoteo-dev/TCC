/**
 * Script de Migração: Supabase -> Firebase Firestore
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Procura o arquivo de credenciais do Firebase
const saCandidates = [
  process.env.FIREBASE_SERVICE_ACCOUNT,
  path.join(__dirname, 'firebase-service-account.json'),
  path.join(__dirname, 'backend', 'firebase-service-account.json')
];
const saPath = saCandidates.find(p => p && fs.existsSync(p));

if (!saPath) {
  console.error('❌ Arquivo de credenciais do Firebase não encontrado. Defina FIREBASE_SERVICE_ACCOUNT ou mantenha firebase-service-account.json localmente.');
  process.exit(1);
}

const serviceAccount = require(saPath);

// Inicializa Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});
const firestore = getFirestore();

// Configurações do Supabase lidas com segurança do ambiente (.env)
let rawSupabaseUrl = process.env.SUPABASE_URL || '';
if (rawSupabaseUrl && !rawSupabaseUrl.endsWith('/rest/v1/')) {
  rawSupabaseUrl = rawSupabaseUrl.replace(/\/+$/, '') + '/rest/v1/';
}
const SUPABASE_REST_URL = rawSupabaseUrl;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_REST_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos no arquivo .env.');
  process.exit(1);
}

async function fetchFromSupabase(table) {
  const url = `${SUPABASE_REST_URL}${table}?select=*`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!res.ok) {
    throw new Error(`Erro ao buscar dados da tabela ${table}: ${res.statusText}`);
  }
  return await res.json();
}

async function migrar() {
  console.log('🚀 Iniciando migração Supabase -> Firebase Firestore...\n');

  // 1. TURMAS
  console.log('📦 Migrando turmas...');
  const turmas = await fetchFromSupabase('turmas');
  const batchTurmas = firestore.batch();
  for (const t of turmas) {
    const ref = firestore.collection('turmas').doc(t.id);
    batchTurmas.set(ref, {
      id: t.id,
      nome: t.nome,
      created_at: t.created_at || new Date().toISOString()
    });
  }
  await batchTurmas.commit();
  console.log(`✅ ${turmas.length} turmas migradas com sucesso!\n`);

  // 2. PERFIS
  console.log('📦 Migrando perfis...');
  const perfis = await fetchFromSupabase('perfis');
  const batchPerfis = firestore.batch();
  for (const p of perfis) {
    const ref = firestore.collection('perfis').doc(p.id);
    batchPerfis.set(ref, {
      id: p.id,
      nome: p.nome,
      papel: p.papel,
      created_at: p.created_at || new Date().toISOString()
    });
  }
  await batchPerfis.commit();
  console.log(`✅ ${perfis.length} perfis migrados com sucesso!\n`);

  // 3. ALUNOS
  console.log('📦 Migrando alunos...');
  const alunos = await fetchFromSupabase('alunos');
  const batchAlunos = firestore.batch();
  for (const a of alunos) {
    let embeddingArr = null;
    if (a.embedding) {
      try {
        embeddingArr = typeof a.embedding === 'string' ? JSON.parse(a.embedding) : a.embedding;
      } catch (e) {
        console.warn(`Aviso: Falha ao converter embedding do aluno ${a.nome}:`, e.message);
      }
    }

    const alunoData = {
      id: a.id,
      turma_id: a.turma_id || null,
      nome: a.nome,
      matricula: a.matricula,
      pin_hash: a.pin_hash || null,
      foto_url: a.foto_url || null,
      ativo: a.ativo !== undefined ? a.ativo : true,
      consentimento_lgpd: a.consentimento_lgpd !== undefined ? a.consentimento_lgpd : true,
      tentativas_pin: a.tentativas_pin || 0,
      bloqueado_ate: a.bloqueado_ate || null,
      model_version: a.model_version || null,
      created_at: a.created_at || new Date().toISOString()
    };

    if (embeddingArr && Array.isArray(embeddingArr)) {
      alunoData.embedding = embeddingArr;
    }

    const ref = firestore.collection('alunos').doc(a.id);
    batchAlunos.set(ref, alunoData);
  }
  await batchAlunos.commit();
  console.log(`✅ ${alunos.length} alunos migrados com sucesso!\n`);

  // 4. PEDIDOS (se houver)
  console.log('📦 Verificando pedidos...');
  const pedidos = await fetchFromSupabase('pedidos');
  if (pedidos.length > 0) {
    const batchPedidos = firestore.batch();
    for (const ped of pedidos) {
      const ref = firestore.collection('pedidos').doc(ped.id);
      batchPedidos.set(ref, ped);
    }
    await batchPedidos.commit();
    console.log(`✅ ${pedidos.length} pedidos migrados com sucesso!\n`);
  } else {
    console.log('ℹ️ Nenhum pedido para migrar no momento.\n');
  }

  // 5. LOGS AUDITORIA (se houver)
  console.log('📦 Verificando logs_auditoria...');
  const logs = await fetchFromSupabase('logs_auditoria');
  if (logs.length > 0) {
    const batchLogs = firestore.batch();
    for (const log of logs) {
      const ref = firestore.collection('logs_auditoria').doc(log.id);
      batchLogs.set(ref, log);
    }
    await batchLogs.commit();
    console.log(`✅ ${logs.length} logs migrados com sucesso!\n`);
  } else {
    console.log('ℹ️ Nenhum log de auditoria para migrar no momento.\n');
  }

  console.log('🎉 Migração concluída com 100% de sucesso!');
}

migrar().catch(err => {
  console.error('❌ Erro durante a migração:', err);
  process.exit(1);
});
