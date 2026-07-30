// ═══════════════════════════════════════════════════════════════════════════
//  INSCRIÇÕES DO GOOGLE FORMS → SISTEMA DA TESOURARIA (DeMolay RDA 307)
//
//  O que faz: toda vez que alguém responde o formulário, a pessoa aparece
//  automaticamente como inscrita no evento, na aba PGTO → Eventos do site.
//
//  COMO INSTALAR (uma vez só):
//  1. Abra o seu formulário no Google Forms (modo de edição)
//  2. Clique nos 3 pontinhos (⋮) no canto superior direito → "Editor de script"
//  3. Apague tudo que aparecer lá e cole ESTE arquivo inteiro
//  4. Clique no disquete (Salvar)
//  5. No menu de cima, onde diz "aoEnviarResposta", escolha "configurar"
//     e clique em "Executar" (▶). O Google vai pedir permissão — autorize.
//  6. Pronto! Faça um teste respondendo o formulário.
//
//  O evento é criado sozinho no sistema com o MESMO NOME do formulário
//  (tipo "Lista de pedidos"). Se quiser outro nome, preencha EVENTO_NOME abaixo.
// ═══════════════════════════════════════════════════════════════════════════

// Deixe '' para usar o nome do formulário como nome do evento
const EVENTO_NOME = '';

// Conexão com o banco do site (não precisa mexer)
const SUPABASE_URL = 'https://skalkpkolumpgkjggtwy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrYWxrcGtvbHVtcGdramdndHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTkzMDEsImV4cCI6MjA5NjUzNTMwMX0.goxiFpqK8hbmeEglq2z4dJV5iGJbWahbqVXIe2wzBr8';

// ─── Execute esta função UMA VEZ para ligar a automação ─────────────────────
function configurar() {
  // remove gatilhos antigos deste script (evita duplicar)
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  // liga o gatilho: a cada resposta enviada, roda aoEnviarResposta
  ScriptApp.newTrigger('aoEnviarResposta')
    .forForm(FormApp.getActiveForm())
    .onFormSubmit()
    .create();
  // garante que o evento já existe no sistema
  const ev = garantirEvento();
  Logger.log('Tudo pronto! As inscrições vão cair no evento: ' + ev.nome);
}

// ─── Roda sozinha a cada resposta do formulário ─────────────────────────────
function aoEnviarResposta(e) {
  const respostas = e.response.getItemResponses();

  let nome = '';
  let telefone = '';
  const outras = [];

  respostas.forEach(function (r) {
    const pergunta = String(r.getItem().getTitle()).toLowerCase();
    const valor = String(r.getResponse());
    if (!valor) return;
    if (!nome && pergunta.indexOf('nome') !== -1) {
      nome = valor;
    } else if (!telefone && (pergunta.indexOf('telefone') !== -1 || pergunta.indexOf('celular') !== -1 || pergunta.indexOf('whats') !== -1 || pergunta.indexOf('contato') !== -1)) {
      telefone = valor;
    } else {
      outras.push(valor);
    }
  });

  // se o formulário não tem pergunta com "nome", usa a primeira resposta
  if (!nome) nome = outras.shift() || 'Inscrito sem nome';

  const evento = garantirEvento();

  supabase('POST', '/rest/v1/evento_pedidos', [{
    evento_id: evento.id,
    nome: nome.toUpperCase(),
    membro_id: null,
    item_id: null,
    item_nome: null,
    qtd: 1,
    valor: 0,
    numero: telefone || null,   // telefone aparece no site como "Nº ..."
    pago: false,
    retirado: false,
  }]);
}

// ─── Busca o evento no sistema; se não existir, cria (tipo lista) ───────────
function garantirEvento() {
  const nomeEvento = EVENTO_NOME || FormApp.getActiveForm().getTitle() || 'Inscrições';

  // já procurado antes? usa o que está guardado
  const props = PropertiesService.getScriptProperties();
  const salvo = props.getProperty('evento_' + nomeEvento);
  if (salvo) return JSON.parse(salvo);

  let lista = supabase('GET', '/rest/v1/pagamentos_eventos?select=id,nome&tipo=eq.lista&nome=eq.' + encodeURIComponent(nomeEvento));
  let evento = lista && lista.length ? lista[0] : null;

  if (!evento) {
    const hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
    const criado = supabase('POST', '/rest/v1/pagamentos_eventos', [{
      nome: nomeEvento, data: hoje, valor: 0, descricao: 'Inscrições via Google Forms',
      status: 'pendente', tipo: 'lista', qtd_ingressos: 1,
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
