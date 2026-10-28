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
  if (!BIBLIA) BIBLIA = await fetch("dados/biblia.json").then(r => r.json());
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
function grafo(G) {
  const cv = $("#grafo"), ctx = cv.getContext("2d"), dica = $("#dica");
  const cor = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const CORES = ["--inicio", "--tema", "--biblia", "--livros", "--devo"];
  const nos = G.n.map(([nome, g]) => ({nome, g, grau: 0})), lig = [];
  for (let i = 0; i < G.e.length; i += 2) {
    lig.push({source: G.e[i], target: G.e[i + 1]});
    nos[G.e[i]].grau++; nos[G.e[i + 1]].grau++;
  }
  nos.forEach(n => n.r = 1.2 + Math.sqrt(n.grau) * 0.55);
  $("#total").textContent = `${nos.length} notas · ${lig.length} ligações`;

  const sim = d3.forceSimulation(nos)
    .force("link", d3.forceLink(lig).distance(14).strength(0.25))
    .force("carga", d3.forceManyBody().strength(-14).distanceMax(260))
    .force("x", d3.forceX().strength(0.04)).force("y", d3.forceY().strength(0.04))
    .alphaDecay(0.02).stop();
  sim.tick(80);

  let W, H, k = 1, ox = 0, oy = 0, foco = null, viz = new Set();
  function medir() {
    const dpr = devicePixelRatio || 1;
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function desenhar() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const n of nos) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); }
    k = Math.min((W - 24) / (x1 - x0), (H - 24) / (y1 - y0));
    ox = W / 2 - k * (x0 + x1) / 2; oy = H / 2 - k * (y0 + y1) / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 0.5; ctx.strokeStyle = foco ? cor("--texto2") : cor("--aresta"); ctx.globalAlpha = foco ? .5 : 1;
    ctx.beginPath();
    for (const l of lig) {
      if (foco && l.source !== foco && l.target !== foco) continue;
      ctx.moveTo(ox + l.source.x * k, oy + l.source.y * k); ctx.lineTo(ox + l.target.x * k, oy + l.target.y * k);
    }
    ctx.stroke();
    const pal = CORES.map(cor);
    for (const n of nos) {
      ctx.globalAlpha = foco && n !== foco && !viz.has(n) ? 0.15 : 1;
      ctx.fillStyle = pal[n.g]; ctx.beginPath();
      ctx.arc(ox + n.x * k, oy + n.y * k, Math.max(1, n.r * Math.sqrt(k)), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  sim.on("tick", desenhar);
  medir(); desenhar(); sim.restart();
  addEventListener("resize", () => { medir(); desenhar(); });
  redesenharGrafo = desenhar;

  cv.addEventListener("mousemove", e => {
    const b = cv.getBoundingClientRect();
    const n = sim.find((e.clientX - b.left - ox) / k, (e.clientY - b.top - oy) / k, 12 / k) || null;
    if (n === foco) return;
    foco = n;
    viz = new Set(foco ? lig.filter(l => l.source === foco || l.target === foco).map(l => l.source === foco ? l.target : l.source) : []);
    if (foco) {
      dica.textContent = foco.nome + (viz.size ? ` · ${viz.size} ligações` : "");
      dica.style.display = "block";
      dica.style.left = Math.min(ox + foco.x * k + 10, W - dica.offsetWidth) + "px";
      dica.style.top = (oy + foco.y * k - 28) + "px";
    } else dica.style.display = "none";
    desenhar();
  });
  cv.addEventListener("mouseleave", () => { foco = null; dica.style.display = "none"; desenhar(); });
}

// ---------- início ----------
fetch("dados/temas.json").then(r => r.json()).then(t => {
  TEMAS = t.map(x => ({...x, rx: new RegExp(x.chave, "gi")}));
  rota();
});
fetch("dados/grafo.json").then(r => r.json()).then(g => { if (window.d3) grafo(g); });
