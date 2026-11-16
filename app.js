// "?v=..." posto pelo site.py no index.html; repassado aos dados para o cache nunca misturar versões
const VERSAO = new URL(document.currentScript.src).search;
// dados em dados/<nome>.js (window.THEPATH.<nome>), carregados por <script> e não fetch de .json,
// que algumas redes e antivírus bloqueiam
function carregar(nome) {
  return new Promise((ok, falha) => {
    if (window.THEPATH?.[nome]) return ok(window.THEPATH[nome]);
    const s = document.createElement("script");
    s.src = `dados/${nome}.js${VERSAO}`;
    s.onload = () => window.THEPATH?.[nome] ? ok(window.THEPATH[nome]) : falha(new Error(nome));
    s.onerror = () => falha(new Error(nome));
    document.head.append(s);
  });
}
// ThePath — busca no navegador sobre os dados gerados por _scripts/site.py
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

let TEMAS = [], BIBLIA = null, redesenharGrafo = () => {};
const MAX_BIBLIA = 6, MAX_LIVROS = 4, MAX_DEVO = 3;
const PARADAS = new Set(("como para pelo pela pelos pelas sobre quando onde porque porqu quem qual quais muito muita " +
  "minha meus minhas tenho estou esta este essa esse isso aquilo fazer faco posso pode podem devo deve ainda mais menos " +
  "entre depois antes sempre nunca tudo nada algo alguem coisa coisas outra outro voce voces nosso nossa dele dela " +
  "seja sendo foram estar estou sinto sentir lidar biblia livro livros diz dizem fala falam tambem").split(" "));

// ---------- tema claro / escuro ----------
const MODOS = ["auto", "claro", "escuro"], NOMES = {auto: "Automático", claro: "Claro", escuro: "Escuro"};
function aplicarModo(modo) {
  const html = document.documentElement;
  if (modo === "auto") delete html.dataset.theme; else html.dataset.theme = modo === "claro" ? "light" : "dark";
  const b = $("#alternar-tema");
  b.dataset.modo = modo;
  $("#nome-tema").textContent = NOMES[modo];
  b.setAttribute("aria-label", `Tema: ${NOMES[modo]}. Clique para trocar`);
  try { localStorage.setItem("thepath-tema", modo); } catch (e) {}
  redesenharGrafo();
}
let modo = "auto";
try { modo = localStorage.getItem("thepath-tema") || "auto"; } catch (e) {}
aplicarModo(MODOS.includes(modo) ? modo : "auto");
$("#alternar-tema").addEventListener("click", () => {
  aplicarModo(MODOS[(MODOS.indexOf($("#alternar-tema").dataset.modo) + 1) % 3]);
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => redesenharGrafo());

// ---------- busca ----------
function temasDaPergunta(q) {
  const t = semAcento(q);
  return TEMAS.map(tema => ({tema, n: (t.match(tema.rx) || []).length}))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n).map(x => x.tema).slice(0, 3);
}

function intercalar(listas, max, chave) {
  const out = [], vistos = new Set();
  for (let i = 0; out.length < max && listas.some(l => i < l.length); i++)
    for (const l of listas) if (l[i] && out.length < max && !vistos.has(chave(l[i]))) { vistos.add(chave(l[i])); out.push(l[i]); }
  return out;
}

function palavrasChave(q) {
  return [...new Set(semAcento(q).match(/[a-z]{4,}/g) || [])].filter(p => !PARADAS.has(p))
    .map(p => p.slice(0, Math.max(4, p.length - 2)));
}

async function carregarBiblia() {
  if (!BIBLIA) BIBLIA = await carregar("biblia");
  return BIBLIA;
}

async function buscaLivre(q) {
  const chaves = palavrasChave(q);
  if (!chaves.length) return [];
  const biblia = await carregarBiblia(), achados = [];
  for (const [livro, caps] of biblia) caps.forEach((vs, c) => vs.forEach((txt, v) => {
    const t = semAcento(txt), n = chaves.filter(k => t.includes(k)).length;
    if (n) achados.push({n, livro, cap: c + 1, v: v + 1, txt});
  }));
  achados.sort((a, b) => b.n - a.n);
  return achados.slice(0, MAX_BIBLIA).map(a => ({
    ref: `${a.livro} ${a.cap}:${a.v}`, nota: `${a.livro} ${a.cap}`, v1: a.v, v2: a.v, versos: [[a.v, a.txt]],
  }));
}

// ---------- resposta ----------
function blocoPassagem(p) {
  const texto = p.versos.map(([v, t]) => (p.versos.length > 1 ? `<sup>${v}</sup>` : "") + esc(t)).join(" ");
  return `<div class="card"><blockquote>"${texto}"</blockquote>
    <a class="ref" href="#" data-nota="${esc(p.nota)}" data-v1="${p.v1}" data-v2="${p.v2}">${esc(p.ref)} · ver capítulo</a></div>`;
}

function blocoLivro(l) {
  const tipo = l.livro === "O Conhecimento de Deus" ? ` · <span class="resumo">${l.resumo ? "resumo" : "frase do livro"}</span>` : "";
  return `<div class="card"><p class="trecho">"${esc(l.texto)}"</p>
    <div class="meta">${esc(l.autor)} · ${esc(l.livro)} · "${esc(l.cap)}" · p. ${l.pagina}${tipo}</div></div>`;
}

function blocoDevo(d) {
  return `<div class="card"><p class="trecho">"${esc(d.texto)}"</p>
    <div class="meta">Orando em Família 2021 · "${esc(d.titulo)}" · ${esc(d.data)} · leitura: ${esc(d.leitura)}</div></div>`;
}

function chips(temas, atual) {
  const rel = [...new Set(temas.flatMap(t => t.rel))].filter(r => !temas.some(t => t.nome === r)).slice(0, 4);
  return `<div class="temas">Temas:
    ${temas.map(t => `<a class="chip${t === atual ? " atual" : ""}" href="#tema=${encodeURIComponent(t.nome)}">${esc(t.nome)}</a>`).join("")}
    ${rel.map(r => `<a class="chip rel" href="#tema=${encodeURIComponent(r)}">+ ${esc(r)}</a>`).join("")}</div>`;
}

function listaFontes(passagens, livros, devos, temas) {
  const itens = [
    ...[...new Set(passagens.map(p => p.nota))].map(n => `<a href="#" data-nota="${esc(n)}">${esc(n)}</a> — Bíblia Sagrada (Almeida)`),
    ...[...new Map(livros.map(l => [l.livro + l.cap, l])).values()].map(l => `${esc(l.autor)}, <i>${esc(l.livro)}</i>, cap. "${esc(l.cap)}"`),
    ...devos.map(d => `<i>Orando em Família 2021</i>, "${esc(d.titulo)}" (${esc(d.data)})`),
    ...temas.map(t => `Tema do vault: <a href="#tema=${encodeURIComponent(t.nome)}">${esc(t.nome)}</a>`),
  ];
  return `<h2><i style="background:var(--texto2)"></i>Fontes</h2><ol class="fontes">${itens.map(i => `<li>${i}</li>`).join("")}</ol>`;
}

function mostrarTemas(temas, principal) {
  const ordem = [principal, ...temas.filter(t => t !== principal)];
  const passagens = intercalar(ordem.map(t => t.passagens), MAX_BIBLIA, p => p.ref);
  const porLivro = Object.values(principal.livros.reduce((m, l) => ((m[l.livro] ||= []).push(l), m), {}));
  const livros = intercalar(porLivro, MAX_LIVROS, l => l.texto);
  const devos = intercalar(ordem.map(t => t.devocional), MAX_DEVO, d => d.titulo);
  const outros = ordem.slice(1).map(t => t.nome);
  const intro = esc(principal.desc) + (outros.length ? ` Sua pergunta também toca em ${esc(outros.join(" e "))}.` : "")
    + " Veja o que a Bíblia e os livros dizem.";

  $("#resposta").innerHTML = chips(ordem, principal)
    + `<div class="card"><p class="intro">${intro}</p></div>`
    + `<h2><i style="background:var(--biblia)"></i>Na Bíblia</h2>${passagens.map(blocoPassagem).join("")}`
    + (livros.length ? `<h2><i style="background:var(--livros)"></i>Nos livros</h2>${livros.map(blocoLivro).join("")}` : "")
    + (devos.length ? `<h2><i style="background:var(--devo)"></i>No devocional</h2>${devos.map(blocoDevo).join("")}` : "")
    + listaFontes(passagens, livros, devos, ordem);
}

function todosOsTemas() {
  return `<div class="temas">Ou escolha um tema:
    ${TEMAS.map(t => `<a class="chip" href="#tema=${encodeURIComponent(t.nome)}">${esc(t.nome)}</a>`).join("")}</div>`;
}

async function responder(q) {
  const temas = temasDaPergunta(q);
  if (temas.length) return mostrarTemas(temas, temas[0]);
  $("#resposta").innerHTML = `<p class="aviso">Procurando na Bíblia…</p>`;
  const passagens = await buscaLivre(q);
  $("#resposta").innerHTML = `<div class="card"><p class="intro">Não encontrei um tema do vault para essa pergunta.
      ${passagens.length ? "Estes versículos usam palavras da sua pergunta:" : "Tente outras palavras ou escolha um tema abaixo."}</p></div>`
    + (passagens.length ? `<h2><i style="background:var(--biblia)"></i>Na Bíblia</h2>${passagens.map(blocoPassagem).join("")}`
      + listaFontes(passagens, [], [], []) : "")
    + todosOsTemas();
}

function rota() {
  const h = new URLSearchParams(location.hash.slice(1));
  const q = h.get("q"), nome = h.get("tema");
  $("#erro").hidden = true;
  if (q) { $("#pergunta").value = q; responder(q); }
  else if (nome && TEMAS.find(t => t.nome === nome)) {
    const t = TEMAS.find(t => t.nome === nome);
    if (!$("#pergunta").value) $("#pergunta").value = "";
    const atuais = temasDaPergunta($("#pergunta").value);
    mostrarTemas(atuais.includes(t) ? atuais : [t], t);
  } else { $("#pergunta").value = ""; $("#resposta").innerHTML = todosOsTemas(); }
}

$("#form").addEventListener("submit", e => {
  e.preventDefault();
  const q = $("#pergunta").value.trim();
  if (!q) { $("#erro").hidden = false; $("#pergunta").focus(); return; }
  location.hash = "q=" + encodeURIComponent(q);
});
$("#pergunta").addEventListener("input", () => { $("#erro").hidden = true; });
addEventListener("hashchange", rota);

// ---------- capítulo da Bíblia ----------
document.addEventListener("click", async e => {
  const a = e.target.closest("[data-nota]");
  if (!a) return;
  e.preventDefault();
  const [, livro, cap] = a.dataset.nota.match(/^(.+) (\d+)$/);
  const v1 = +a.dataset.v1 || 0, v2 = +a.dataset.v2 || 0;
  $("#cap-titulo").textContent = a.dataset.nota;
  $("#cap-texto").innerHTML = `<p class="aviso">Carregando…</p>`;
  $("#capitulo").showModal();
  const biblia = await carregarBiblia();
  const versos = biblia.find(([n]) => n === livro)[1][cap - 1];
  $("#cap-texto").innerHTML = versos.map((t, i) =>
    `<p id="v${i + 1}" class="${i + 1 >= v1 && i + 1 <= v2 ? "marcado" : ""}"><sup>${i + 1}</sup>${esc(t)}</p>`).join("");
  if (v1) $("#v" + v1).scrollIntoView({block: "center"});
});
$("#fechar").addEventListener("click", () => $("#capitulo").close());
$("#capitulo").addEventListener("click", e => { if (e.target === $("#capitulo")) $("#capitulo").close(); });

// ---------- grafo do vault (só para ver as ligações) ----------
// Duas visões: "rede" (posições de força, calculadas no build) e "órbitas" (anéis por tipo de nota,
// em ordem: livros bíblicos e capítulos, meses e dias, livros e capítulos). Os grupos podem ser ligados/desligados.
const ORBITAS = [ // grupo, raio interno, raio externo, sub-anéis, rótulo
  {g: 1, r0: 20, r1: 20, sub: 1, nome: "TEMAS"},
  {g: 3, r0: 50, r1: 50, sub: 1, nome: "LIVROS"},
  {g: 4, r0: 59, r1: 65, sub: 2, nome: "DEVOCIONAL"},
  {g: 2, r0: 74, r1: 96, sub: 5, nome: "BÍBLIA"},
];
function grafo(G) {
  const cv = $("#grafo"), ctx = cv.getContext("2d"), dica = $("#dica"), caixa = cv.parentElement;
  const cor = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const CORES = ["--inicio", "--tema", "--biblia", "--livros", "--devo"];
  // posições "rede" já calculadas no build (site.py → layout_grafo.js)
  const nos = G.n.map(([nome, g], i) => ({nome, g, grau: 0, seg: G.o[2 * i], pos: G.o[2 * i + 1],
    ax: G.p[2 * i], ay: G.p[2 * i + 1]})), lig = [];
  for (let i = 0; i < G.e.length; i += 2) {
    lig.push({source: nos[G.e[i]], target: nos[G.e[i + 1]]});
    nos[G.e[i]].grau++; nos[G.e[i + 1]].grau++;
  }
  nos.forEach(n => n.r = 1.2 + Math.sqrt(n.grau) * 0.55);
  $("#total").textContent = `${nos.length} notas · ${lig.length} ligações`;

  // ----- posições "órbitas" -----
  const ABERTURA = 0.30; // fresta no topo (radianos) para os rótulos dos anéis
  for (const o of ORBITAS) {
    const grupo = nos.filter(n => n.g === o.g)
      .sort((a, b) => a.seg - b.seg || a.pos - b.pos || a.nome.localeCompare(b.nome));
    const segs = [...new Set(grupo.map(n => n.seg))];
    const VAO = o.sub > 1 ? 1.6 : 0.8; // espaço entre segmentos (livro bíblico, mês, livro)
    const colunas = segs.map(s => Math.ceil(grupo.filter(n => n.seg === s).length / o.sub));
    const total = colunas.reduce((a, c) => a + c, 0) + VAO * segs.length;
    let col = VAO / 2;
    segs.forEach((s, si) => {
      grupo.filter(n => n.seg === s).forEach((n, j) => {
        const ang = -Math.PI / 2 + ABERTURA / 2 + (2 * Math.PI - ABERTURA) * (col + Math.floor(j / o.sub) + .5) / total;
        const r = o.sub > 1 ? o.r0 + (o.r1 - o.r0) * (j % o.sub) / (o.sub - 1) : o.r0;
        n.bx = r * Math.cos(ang); n.by = r * Math.sin(ang); n.ang = ang;
      });
      col += colunas[si] + VAO;
    });
  }
  nos.filter(n => n.g === 0).forEach(n => { n.bx = 0; n.by = 0; });

  // ----- estado da visão -----
  let visao = "rede", ocultos = new Set();
  try {
    visao = localStorage.getItem("thepath-visao") === "orbitas" ? "orbitas" : "rede";
    ocultos = new Set(JSON.parse(localStorage.getItem("thepath-ocultos") || "[]"));
  } catch (e) {}
  let t = visao === "orbitas" ? 1 : 0, anim = null;
  const suave = x => x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  function posicionar() {
    const e = suave(t);
    for (const n of nos) { n.x = n.ax + (n.bx - n.ax) * e; n.y = n.ay + (n.by - n.ay) * e; }
  }
  posicionar();
  const visivel = n => !ocultos.has(n.g);

  // enquadramento de cada visão (fixo, para ligar/desligar grupos não mexer no zoom)
  const quadroRede = (() => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const n of nos) { x0 = Math.min(x0, n.ax); x1 = Math.max(x1, n.ax); y0 = Math.min(y0, n.ay); y1 = Math.max(y1, n.ay); }
    return {x0, x1, y0, y1};
  })();
  const quadroOrb = {x0: -100, x1: 100, y0: -104, y1: 100};

  function maisPerto(x, y, raio) {
    let melhor = null, d2 = raio * raio;
    for (const n of nos) { if (!visivel(n)) continue; const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < d2) { d2 = d; melhor = n; } }
    return melhor;
  }

  let W, H, k = 1, ox = 0, oy = 0, foco = null, viz = new Set();
  function medir() {
    const dpr = devicePixelRatio || 1;
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function desenhar() {
    const e = suave(t), mix = (a, b) => a + (b - a) * e;
    const q = Object.fromEntries(["x0", "x1", "y0", "y1"].map(c => [c, mix(quadroRede[c], quadroOrb[c])]));
    k = Math.min((W - 24) / (q.x1 - q.x0), (H - 24) / (q.y1 - q.y0));
    ox = W / 2 - k * (q.x0 + q.x1) / 2; oy = H / 2 - k * (q.y0 + q.y1) / 2;
    const X = n => ox + n.x * k, Y = n => oy + n.y * k;
    ctx.clearRect(0, 0, W, H);
    const pal = CORES.map(cor);

    // anéis e rótulos (só na visão órbitas)
    if (e > 0.01) {
      ctx.globalAlpha = e;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const o of ORBITAS) {
        if (ocultos.has(o.g)) continue;
        const rm = (o.r0 + o.r1) / 2;
        ctx.strokeStyle = pal[o.g]; ctx.lineWidth = Math.max(1, (o.r1 - o.r0 + 5) * k);
        ctx.globalAlpha = e * .07;
        ctx.beginPath(); ctx.arc(ox, oy, rm * k, 0, 7); ctx.stroke();
        ctx.globalAlpha = e * .35; ctx.lineWidth = .7;
        ctx.beginPath(); ctx.arc(ox, oy, (o.r1 + 3.5) * k, 0, 7); ctx.stroke();
        ctx.globalAlpha = e * .9; ctx.fillStyle = pal[o.g];
        ctx.font = `600 ${Math.max(9, Math.min(12, 3.4 * k))}px Inter, sans-serif`;
        ctx.letterSpacing = "2px";
        if (o.g !== 1) ctx.fillText(o.nome, ox, oy - rm * k); // os temas já têm nome
      }
      ctx.letterSpacing = "0px";
    }

    // ligações: retas na rede, curvas puxadas para o centro nas órbitas
    ctx.lineWidth = 0.5; ctx.strokeStyle = foco ? cor("--texto2") : cor("--aresta");
    ctx.globalAlpha = foco ? .55 : 1;
    ctx.beginPath();
    for (const l of lig) {
      if (!visivel(l.source) || !visivel(l.target)) continue;
      if (foco && l.source !== foco && l.target !== foco) continue;
      const mx = (l.source.x + l.target.x) / 2 * (1 - .55 * e), my = (l.source.y + l.target.y) / 2 * (1 - .55 * e);
      ctx.moveTo(X(l.source), Y(l.source)); ctx.quadraticCurveTo(ox + mx * k, oy + my * k, X(l.target), Y(l.target));
    }
    ctx.stroke();

    for (const n of nos) {
      if (!visivel(n)) continue;
      ctx.globalAlpha = foco && n !== foco && !viz.has(n) ? 0.15 : 1;
      const rb = n.g === 0 ? 7 : n.g === 1 ? Math.min(6, Math.max(4, n.r * Math.sqrt(k) * .62)) : Math.min(4.5, Math.max(1, n.r * Math.sqrt(k) * .62));
      const r = mix(Math.max(1, n.r * Math.sqrt(k)), rb);
      ctx.fillStyle = pal[n.g]; ctx.beginPath();
      ctx.arc(X(n), Y(n), r, 0, 7); ctx.fill();
      if (n.g <= 1 && e > .01) { // halo nos temas e no início
        ctx.globalAlpha *= e * .35; ctx.strokeStyle = pal[n.g]; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(X(n), Y(n), r + 3, 0, 7); ctx.stroke();
      }
    }

    // nomes dos temas e do início (órbitas)
    if (e > .3 && W > 420) {
      ctx.globalAlpha = (e - .3) / .7;
      ctx.fillStyle = cor("--texto"); ctx.font = `500 ${Math.max(9, Math.min(11, 2.8 * k))}px Inter, sans-serif`;
      for (const n of nos) {
        if (!visivel(n) || n.g > 1) continue;
        if (n.g === 0) { ctx.textAlign = "center"; ctx.fillText("INÍCIO", X(n), Y(n) + 16); continue; }
        if (foco && n !== foco && !viz.has(n)) continue;
        // rótulo radial, para fora do anel dos temas; no lado esquerdo vira para não ficar de cabeça para baixo
        const esq = Math.cos(n.ang) < 0;
        ctx.save(); ctx.translate(X(n), Y(n)); ctx.rotate(esq ? n.ang + Math.PI : n.ang);
        ctx.textAlign = esq ? "right" : "left";
        ctx.fillText(n.nome.toUpperCase(), esq ? -10 : 10, 0);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
  function ajustarCaixa() { caixa.classList.toggle("orbitas", visao === "orbitas"); medir(); }
  ajustarCaixa(); desenhar();
  addEventListener("resize", () => { medir(); desenhar(); });
  redesenharGrafo = desenhar;

  // ----- controles: visão e filtros -----
  function atualizarControles() {
    document.querySelectorAll("[data-visao]").forEach(b => b.setAttribute("aria-pressed", b.dataset.visao === visao));
    document.querySelectorAll("[data-grupo]").forEach(b => b.setAttribute("aria-pressed", !ocultos.has(+b.dataset.grupo)));
    try {
      localStorage.setItem("thepath-visao", visao);
      localStorage.setItem("thepath-ocultos", JSON.stringify([...ocultos]));
    } catch (e) {}
  }
  function mudarVisao(v) {
    if (v === visao) return;
    visao = v; atualizarControles(); ajustarCaixa();
    const de = t, para = v === "orbitas" ? 1 : 0, t0 = performance.now();
    const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
    cancelAnimationFrame(anim);
    (function passo(agora) {
      const p = reduzir ? 1 : Math.min(1, (agora - t0) / 900);
      t = de + (para - de) * p; posicionar(); desenhar();
      if (p < 1) anim = requestAnimationFrame(passo);
    })(t0);
  }
  document.querySelectorAll("[data-visao]").forEach(b => b.addEventListener("click", () => mudarVisao(b.dataset.visao)));
  document.querySelectorAll("[data-grupo]").forEach(b => b.addEventListener("click", () => {
    const g = +b.dataset.grupo;
    ocultos.has(g) ? ocultos.delete(g) : ocultos.add(g);
    if (foco && !visivel(foco)) { foco = null; dica.style.display = "none"; }
    atualizarControles(); desenhar();
  }));
  atualizarControles();

  cv.addEventListener("mousemove", e => {
    const b = cv.getBoundingClientRect();
    const n = maisPerto((e.clientX - b.left - ox) / k, (e.clientY - b.top - oy) / k, 12 / k) || null;
    if (n === foco) return;
    foco = n;
    viz = new Set(foco ? lig.filter(l => (l.source === foco || l.target === foco) && visivel(l.source) && visivel(l.target))
      .map(l => l.source === foco ? l.target : l.source) : []);
    if (foco) {
      dica.textContent = foco.nome + (viz.size ? ` · ${viz.size} ligações` : "");
      dica.style.display = "block";
      dica.style.left = Math.max(0, Math.min(ox + foco.x * k + 10, W - dica.offsetWidth)) + "px";
      dica.style.top = (oy + foco.y * k - 28) + "px";
    } else dica.style.display = "none";
    desenhar();
  });
  cv.addEventListener("mouseleave", () => { foco = null; dica.style.display = "none"; desenhar(); });
}

// ---------- início ----------
carregar("temas").then(t => {
  TEMAS = t.map(x => ({...x, rx: new RegExp(x.chave, "gi")}));
  rota();
});
carregar("grafo").then(grafo)
  .catch(() => { $("#total").textContent = "não foi possível carregar o grafo nesta rede"; });
