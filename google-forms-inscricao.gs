// ═══════════════════════════════════════════════════════════════════════════
//  INSCRIÇÕES DO GOOGLE FORMS → SISTEMA DA TESOURARIA (DeMolay RDA 307)
//
//  CÓPIA DE SEGURANÇA da versão instalada no Apps Script da conta
//  trabalho@vecchihumberto.com — projeto "Inscrições Olimpíadas → Tesouraria".
//  Formulário conectado: Olimpíadas da Ordem Demolay - 2026
//
//  O que faz: cada resposta vira um inscrito PAGO no evento (tipo "inscricao",
//  que abre o painel de inscrições no site), com o valor do lote lançado no
//  caixa e categoria (Você é:), capítulo, ID e telefone guardados.
//
//  Para reinstalar: cole no Apps Script e rode "configurar" uma vez.
//  Para importar respostas antigas sem duplicar: rode "importarAntigas".
// ═══════════════════════════════════════════════════════════════════════════

const FORM_ID = '1kD2k6-Aw0tuvfDPIcuU-0fIG3coFEd83pHmnzVkRkEs';
const EVENTO_NOME = '';   // '' = usa o nome do formulário

// Lotes da inscrição (até a data → valor)
const LOTES = [
  { ate: '2026-08-23', valor: 175 },   // 1º lote: 28/07 a 23/08
  { ate: '2026-09-27', valor: 200 },   // 2º lote: 24/08 a 27/09
  { ate: '2026-10-06', valor: 225 },   // 3º lote: 28/09 a 06/10
];

const SUPABASE_URL = 'https://skalkpkolumpgkjggtwy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrYWxrcGtvbHVtcGdramdndHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTkzMDEsImV4cCI6MjA5NjUzNTMwMX0.goxiFpqK8hbmeEglq2z4dJV5iGJbWahbqVXIe2wzBr8';

// ─── Execute UMA VEZ para ligar a automação ─────────────────────────────────
function configurar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('aoEnviarResposta')
    .forForm(FormApp.openById(FORM_ID))
    .onFormSubmit()
    .create();
  const ev = garantirEvento();
  Logger.log('Tudo pronto! As inscrições vão cair no evento: ' + ev.nome);
}

// ─── Valor conforme o lote (pela data da resposta) ──────────────────────────
function valorDoLote(quando) {
  const d = Utilities.formatDate(quando, 'America/Sao_Paulo', 'yyyy-MM-dd');
  for (let i = 0; i < LOTES.length; i++) {
    if (d <= LOTES[i].ate) return LOTES[i].valor;
  }
  return LOTES[LOTES.length - 1].valor;
}

// ─── Roda sozinha a cada resposta ───────────────────────────────────────────
function aoEnviarResposta(e) {
  lancarInscricao(e.response);
}

// ─── Lança uma resposta: inscrito pago + entrada no caixa ───────────────────
function lancarInscricao(resp) {
  let nome = '', telefone = '', categoria = '', idDm = '', capitulo = '';
  const outras = [];

  resp.getItemResponses().forEach(function (r) {
    const pergunta = String(r.getItem().getTitle()).toLowerCase();
    const valor = String(r.getResponse());
    if (!valor) return;
    if (!categoria && pergunta.indexOf('você é') !== -1) categoria = valor;
    else if (!capitulo && (pergunta.indexOf('capítulo') !== -1 || pergunta.indexOf('capitulo') !== -1)) capitulo = valor;
    else if (!idDm && pergunta.indexOf('seu id') !== -1) idDm = valor;
    else if (!telefone && (pergunta.indexOf('telefone') !== -1 || pergunta.indexOf('celular') !== -1 || pergunta.indexOf('whats') !== -1 || pergunta.indexOf('contato') !== -1)) telefone = valor;
    else if (!nome && pergunta.indexOf('nome') !== -1) nome = valor;
    else outras.push(valor);
  });

  if (!nome) nome = outras.shift() || 'Inscrito sem nome';
  nome = nome.toUpperCase();

  const evento = garantirEvento();
  const quando = resp.getTimestamp() || new Date();
  const valor = valorDoLote(quando);
  const dataStr = Utilities.formatDate(quando, 'America/Sao_Paulo', 'yyyy-MM-dd');

  // 1) entrada no caixa (líquida: taxa de 0,71% sobre receitas)
  const tx = supabase('POST', '/rest/v1/transacoes', [{
    tipo: 'entrada', valor: Math.round(valor * (1 - 0.0071) * 100) / 100, data: dataStr, categoria: 'Evento',
    descricao: evento.nome + ' — ' + nome + ' (inscrição)',
  }]);

  // 2) inscrito pago, com categoria/capítulo/ID/telefone
  supabase('POST', '/rest/v1/evento_pedidos', [{
    evento_id: evento.id, nome: nome, membro_id: null, item_id: null,
    item_nome: categoria ? categoria.toUpperCase() : null,   // categoria (Você é:)
    qtd: 1, valor: valor,
    numero: telefone || null,                                 // telefone
    tamanho: idDm || null,                                    // ID DeMolay
    nome_camisa: capitulo || null,                            // capítulo
    pago: true, retirado: false, transacao_id: tx && tx[0] ? tx[0].id : null,
  }]);
}

// ─── Importa respostas antigas (não duplica) ────────────────────────────────
function importarAntigas() {
  const form = FormApp.openById(FORM_ID);
  const evento = garantirEvento();
  let importadas = 0, puladas = 0;

  form.getResponses().forEach(function (resp) {
    let nome = '';
    resp.getItemResponses().forEach(function (r) {
      const pergunta = String(r.getItem().getTitle()).toLowerCase();
      const valor = String(r.getResponse());
      if (!nome && valor && pergunta.indexOf('capítulo') === -1 && pergunta.indexOf('capitulo') === -1 && pergunta.indexOf('nome') !== -1) nome = valor;
    });
    if (!nome) return;
    nome = nome.toUpperCase();

    const existe = supabase('GET', '/rest/v1/evento_pedidos?select=id&evento_id=eq.' + evento.id + '&nome=eq.' + encodeURIComponent(nome));
    if (existe && existe.length) { puladas++; return; }

    lancarInscricao(resp);
    importadas++;
  });

  Logger.log('Importadas: ' + importadas + ' | já existiam: ' + puladas);
}

// ─── Evento no sistema (tipo "inscricao" = painel de inscrições no site) ────
function garantirEvento() {
  const nomeEvento = EVENTO_NOME || FormApp.openById(FORM_ID).getTitle() || 'Inscrições';

  const props = PropertiesService.getScriptProperties();
  const salvo = props.getProperty('evento_' + nomeEvento);
  if (salvo) return JSON.parse(salvo);

  let lista = supabase('GET', '/rest/v1/pagamentos_eventos?select=id,nome&nome=eq.' + encodeURIComponent(nomeEvento));
  let evento = lista && lista.length ? lista[0] : null;

  if (!evento) {
    const hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
    const criado = supabase('POST', '/rest/v1/pagamentos_eventos', [{
      nome: nomeEvento, data: hoje, valor: 0, descricao: 'Inscrições via Google Forms',
      status: 'pendente', tipo: 'inscricao', qtd_ingressos: 1,
    }]);
    evento = criado[0];
  }

  props.setProperty('evento_' + nomeEvento, JSON.stringify(evento));
  return evento;
}

// ─── Comunicação com o banco ────────────────────────────────────────────────
function supabase(metodo, caminho, corpo) {
  const resp = UrlFetchApp.fetch(SUPABASE_URL + caminho, {
    method: metodo.toLowerCase(),
    contentType: 'application/json',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      Prefer: 'return=representation',
    },
    payload: corpo ? JSON.stringify(corpo) : undefined,
    muteHttpExceptions: true,
  });
  const texto = resp.getContentText();
  if (resp.getResponseCode() >= 300) throw new Error('Erro no sistema: ' + texto);
  return texto ? JSON.parse(texto) : null;
}
