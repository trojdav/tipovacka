const SHEET_URL = "https://opensheet.elk.sh/1H7bh3IUFuem4R_nW24Qp4lwuDwGCGW7eAOC1EBIx5xc";
const API_URL = "https://script.google.com/macros/s/AKfycbw5wrlM7iieq2wBu580j0iVN-1DaFD3q_egBbccap-ryFq_uys28VCRga9TNBMoRtAsEg/exec";
const SCRIPT_URL ="https://script.google.com/macros/s/AKfycbw5wrlM7iieq2wBu580j0iVN-1DaFD3q_egBbccap-ryFq_uys28VCRga9TNBMoRtAsEg/exec";

function getToday() {

  const d = new Date();

  return d.getFullYear() +
    "-" +
    String(d.getMonth()+1).padStart(2,"0") +
    "-" +
    String(d.getDate()).padStart(2,"0");
}

function getTomorrow() {

  const d = new Date();

  d.setDate(d.getDate() + 1);

  return d.getFullYear() +
    "-" +
    String(d.getMonth()+1).padStart(2,"0") +
    "-" +
    String(d.getDate()).padStart(2,"0");
}

let matches = [];
let tips = [];
let players = [];
let predictions = [];
let predictionResults = [];
let groupResults = [];

async function loadData() {
  matches = await fetch(`${SHEET_URL}/matches`).then(r => r.json());
  tips = await fetch(`${SHEET_URL}/tips`).then(r => r.json());
  players = await fetch(`${SHEET_URL}/players`).then(r => r.json());
  predictions = await fetch(`${SHEET_URL}/predictions`).then(r => r.json());
  predictionResults = await fetch(`${SHEET_URL}/tournament_results`).then(r => r.json());
  groupResults = await fetch(`${SHEET_URL}/group_results`).then(r => r.json());

  renderAll();
}

function renderAll() {
  renderMatches();
  renderRanking();
  renderHistory();
  renderPredictions();
 renderDayFilter();
}

loadData();

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric"
  });
}

function normalizeRow(row) {
  const out = {};
  Object.keys(row).forEach(k => {
    out[k.trim()] = row[k];
  });
  return out;
}

document.getElementById("subtitle").innerText =
  `Dnes: ${formatDate(getToday())}`;

function getPredictionPoints(player) {
  const pred = player.prediction || {};

  let points = 0;

  const rules = [
    { key: "champion" },
    { key: "second" },
    { key: "third" },
    { key: "top_scorer" },
    { key: "best_player" },
    { key: "best_young" },
    { key: "best_gk" }
  ];

  rules.forEach(r => {
    const result = predictionResults.find(t => t.category === r.key);

    if (result && pred[r.key] === result.value) {
      points += 15;
    }
  });

  return points;
}

function renderMatches() {
  const el = document.getElementById("matchesList");
  el.innerHTML = "";

  const todayMatches = matches.filter(m => m.date === getToday());
  const tomorrowMatches = matches.filter(m => m.date === getTomorrow());

  // empty state
  if (todayMatches.length === 0 && tomorrowMatches.length === 0) {
    el.innerHTML = `<div class="empty-state">Žádné zápasy</div>`;
    return;
  }

  // DNEŠEK
  if (todayMatches.length > 0) {

    todayMatches.forEach(m => {
      renderMatchCard(m, el, "today");
    });
  }

  // ZÍTŘEK
  if (tomorrowMatches.length > 0) {
    el.innerHTML += `<h2 class="section-title secondary">⏭️ Zítřejší zápasy</h2>`;

    tomorrowMatches.forEach(m => {
      renderMatchCard(m, el, "tomorrow");
    });
  }
}

function renderMatchCard(m, el, type) {

  const myTip = getMyTip(m.id);
const hasMyTip = !!myTip;

  const isPlayed =
    m.home_goals !== "" &&
    m.away_goals !== "" &&
    m.home_goals != null &&
    m.away_goals != null;

  el.innerHTML += `
    <div class="match-card ${isPlayed ? "played" : "upcoming"} ${type}"
         onclick="openMatch(${m.id})">

      <div class="match-top">
        <div class="match-time">🕒 ${m.time}</div>
      </div>

      <div class="match-body">

        <div class="team">
          <img src="https://flagcdn.com/28x21/${getFlag(m.home)}.png" />
          <span class="team-name">${m.home}</span>
        </div>

        <div class="score">
          ${isPlayed ? `${m.home_goals} : ${m.away_goals}` : "VS"}
        </div>

        <div class="team away">
          <span class="team-name">${m.away}</span>
          <img src="https://flagcdn.com/28x21/${getFlag(m.away)}.png" />
        </div>

      </div>

      <div class="match-footer tip-indicator ${hasMyTip ? "yes" : "no"}">
        ${isPlayed ? "Zápas ukončen" : "Tipuj výsledek"}
        ${hasMyTip ? " • ✔ máš natipováno" : " • X nemáš natipováno"}
      </div>

    </div>
  `;
}

function getMyGroupPredictions() {
  const user = JSON.parse(localStorage.getItem("tipovacUser"));
  if (!user) return null;

  const my = predictions.find(p => p.player === user.name);
  return my || {};
}

function renderScore(match) {
  const hasScore =
    match.home_goals != null &&
    match.away_goals != null &&
    match.home_goals !== "" &&
    match.away_goals !== "";

  return hasScore
    ? `${match.home_goals} : ${match.away_goals}`
    : "VS";
}

function getPoints(actualH, actualA, tipH, tipA) {

  actualH = Number(actualH);
  actualA = Number(actualA);
  tipH = Number(tipH);
  tipA = Number(tipA);

  const actualDiff = actualH - actualA;
  const tipDiff = tipH - tipA;

  const actualGoals = actualH + actualA;
  const tipGoals = tipH + tipA;

  // 10 bodů - přesný výsledek
  if (actualH === tipH && actualA === tipA) return 10;

  // 6 bodů - přesný rozdíl + vítěz
  if (Math.sign(actualDiff) === Math.sign(tipDiff) && actualDiff === tipDiff) return 6;

  // 6 bodů - správný vítěz + správný počet gólů
  if (Math.sign(actualDiff) === Math.sign(tipDiff) && actualGoals === tipGoals) return 6;

  // 6 bodů - remíza
  if (actualDiff === 0 && tipDiff === 0) return 6;

  // 4 body - jen vítěz
  if (Math.sign(actualDiff) === Math.sign(tipDiff)) return 4;

  // 2 body - jen celkový počet gólů
  if (actualGoals === tipGoals) return 2;

  return 0;
}

function getPredictionPointsFromRow(p) {

  let points = 0;

  const result = (key) =>
    predictionResults.find(r => r.category === key)?.value;

  if (p.champion === result("champion")) points += 15;
  if (p.second === result("second")) points += 15;
  if (p.third === result("third")) points += 15;

  if (p.top_scorer === result("top_scorer")) points += 15;
  if (p.best_player === result("best_player")) points += 15;
  if (p.best_young === result("best_young")) points += 15;
  if (p.best_gk === result("best_gk")) points += 15;

  if (p.best_czech_scorer === result("best_czech_scorer")) {
    points += 10;
  }

  return points;
}

function getGroupPointsFromRow(p) {

  let points = 0;

  const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"];

  groups.forEach(g => {

    const predicted = p[g]; // 👈 přímo sloupec
    const real = groupResults.find(r => r.group === g)?.winner;

    if (predicted && real && predicted === real) {
      points += 5;
    }
  });

  return points;
}


function renderRanking() {

  const table = document.getElementById("rankingTable");

  let scores = {};

  // 1) inicializace hráčů
  players.forEach(p => {
    scores[p.name] = 0;
  });

  // 2) zápasové body
  matches.forEach(m => {

    if (m.home_goals === "" || m.away_goals === "") return;

    tips
      .filter(t => t.match_id == m.id)
      .forEach(t => {

        const points = getPoints(
          m.home_goals,
          m.away_goals,
          t.home,
          t.away
        );

        scores[t.player] += points;
      });
  });

  // 3) turnajové predikce (nový sheet predictions)
predictions
  .filter(p => p.player && p.player.trim() !== "")
  .forEach(p => {
    const player = p.player;

    if (!scores[player]) return;

    scores[player] += getPredictionPointsFromRow(p);
  });

// 4) skupiny – z predictions sheetu
predictions.forEach(p => {

  const player = p.player;
  if (!scores[player]) return;

  const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"];

  let points = 0;

  groups.forEach(g => {

    const predicted = (p[g] || "").trim();
    const real = groupResults.find(r => r.group === g)?.winner;

    if (predicted && real && predicted === real) {
      points += 5;
    }
  });

  scores[player] += points;
});
  // 5) seřazení
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]);
  const leader = sorted[0];

const leaderBox = document.getElementById("leaderBoxHeader");
if (leaderBox) {
  leaderBox.innerHTML = `
    <div class="leader-header">
      🏆 Lídr: ${leader[0]} (${leader[1]} bodů)
    </div>
  `;
}


  // 6) render tabulky
  table.innerHTML = `
    <tr>
      <th>#</th>
      <th>Hráč</th>
      <th>Body</th>
    </tr>
  `;

  sorted.forEach((p, i) => {

    let rowClass = "";

    if (i === 0) rowClass = "first";
    else if (i === 1) rowClass = "second";
    else if (i === 2) rowClass = "third";

    table.innerHTML += `
      <tr class="${rowClass}">
        <td>${i + 1}</td>
        <td>${p[0]}</td>
        <td><b>${p[1]}</b></td>
      </tr>
    `;
  });
}

function renderHistory() {

  const el = document.getElementById("historyList");
  el.innerHTML = "";

  const days = {};

  matches.forEach(m => {

if (selectedDay && selectedDay !== "all" && m.date !== selectedDay) return;
    if (!days[m.date]) {
      days[m.date] = [];
    }

    days[m.date].push(m);
  });

  Object.keys(days)
    .sort()
    .forEach(day => {

      let dayBlock = `
        <h3 class="day-title">
          📅 ${formatFilterDate(day)}
        </h3>
      `;

      days[day].forEach(m => {

        const hasScore =
          m.home_goals !== "" &&
          m.away_goals !== "" &&
          m.home_goals != null &&
          m.away_goals != null;

        const score = hasScore
          ? `${m.home_goals} : ${m.away_goals}`
          : "VS";

        const matchTips = tips
          .filter(t => t.match_id == m.id)
          .map(t => ({
            ...t,
            points: hasScore
              ? getPoints(
                  m.home_goals,
                  m.away_goals,
                  t.home,
                  t.away
                )
              : "-"
          }))
          .sort((a, b) => {
            if (a.points === "-") return 1;
            if (b.points === "-") return -1;
            return b.points - a.points;
          });

        dayBlock += `

          <div class="history-match-card">

            <div class="history-match-header"
                 onclick="toggleHistoryMatch(${m.id})">

              <div class="history-teams">

                <div class="history-team">
                  <img
                    src="https://flagcdn.com/28x21/${getFlag(m.home)}.png">
                  <span>${m.home}</span>
                </div>

                <div class="history-score">
                  ${score}
                </div>

                <div class="history-team">
                  <span>${m.away}</span>
                  <img
                    src="https://flagcdn.com/28x21/${getFlag(m.away)}.png">
                </div>

              </div>

              <div class="history-arrow">
                ▼
              </div>

            </div>

            <div id="historyTips-${m.id}"
                 class="history-tips hidden">

              <div class="tips-table">

                <div class="tips-header-row">
                  <div>Hráč</div>
                  <div>Tip</div>
                  <div>Body</div>
                </div>
        `;

        matchTips.forEach(t => {

          dayBlock += `
            <div class="tip-row">

              <div class="tip-player">
                ${t.player}
              </div>

              <div class="tip-score">
                ${t.home} : ${t.away}
              </div>

              <div class="tip-points">
                ${t.points === "-" ? "-" : t.points + " b"}
              </div>

            </div>
          `;
        });

        dayBlock += `
              </div>
            </div>

          </div>
        `;
      });

      el.innerHTML += dayBlock;
    });
}

function toggleHistoryMatch(matchId) {

  const el = document.getElementById(
    `historyTips-${matchId}`
  );

  el.classList.toggle("hidden");
}



function renderPredictions() {
  const el = document.getElementById("predictionsList");
  el.innerHTML = "";

const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"];

  let html = `
    <div class="predictions-wrapper">

      <div class="pred-header">PREDIKCE</div>

      <!-- ===================== -->
      <!-- HLAVNÍ TABULKA -->
      <!-- ===================== -->
      <div class="pred-table pred-table-main">

        <div class="pred-row pred-head pred-main-head">
          <div>Hráč</div>
          <div>🏆</div>
          <div>🥈</div>
          <div>🥉</div>
          <div>⚽</div>
          <div>⭐</div>
          <div>🧒</div>
          <div>🧤</div>
          <div>🇨🇿</div>
          <div>BODY</div>
        </div>
  `;

  predictions.forEach(p => {
    const pts = getPredictionPointsFromRow(p);

    const result = (key) =>
      predictionResults.find(r => r.category === key)?.value;

    const isCorrect = (a, b) => a && b && a === b;

    html += `
      <div class="pred-row pred-main-row">
        <div class="pred-name">${p.player}</div>

        <div class="${isCorrect(p.champion, result("champion")) ? "correct" : ""}">
          ${p.champion || "-"}
        </div>

        <div class="${isCorrect(p.second, result("second")) ? "correct" : ""}">
          ${p.second || "-"}
        </div>

        <div class="${isCorrect(p.third, result("third")) ? "correct" : ""}">
          ${p.third || "-"}
        </div>

        <div class="${isCorrect(p.top_scorer, result("top_scorer")) ? "correct" : ""}">
          ${p.top_scorer || "-"}
        </div>

        <div class="${isCorrect(p.best_player, result("best_player")) ? "correct" : ""}">
          ${p.best_player || "-"}
        </div>

        <div class="${isCorrect(p.best_young, result("best_young")) ? "correct" : ""}">
          ${p.best_young || "-"}
        </div>

        <div class="${isCorrect(p.best_gk, result("best_gk")) ? "correct" : ""}">
          ${p.best_gk || "-"}
        </div>

        <div class="${isCorrect(p.best_czech_scorer, result("best_czech_scorer")) ? "correct" : ""}">
          ${p.best_czech_scorer || "-"}
        </div>

        <div class="pred-points">${pts}</div>
      </div>
    `;
  });

  // =====================
  // REALITA – HLAVNÍ TABULKA
  // =====================

  html += `
      <div class="pred-row real-row real-main-row">
        <div class="pred-name">REALITA</div>
        <div>${predictionResults.find(r => r.category === "champion")?.value || "-"}</div>
        <div>${predictionResults.find(r => r.category === "second")?.value || "-"}</div>
        <div>${predictionResults.find(r => r.category === "third")?.value || "-"}</div>
        <div>${predictionResults.find(r => r.category === "top_scorer")?.value || "-"}</div>
        <div>${predictionResults.find(r => r.category === "best_player")?.value || "-"}</div>
        <div>${predictionResults.find(r => r.category === "best_young")?.value || "-"}</div>
        <div>${predictionResults.find(r => r.category === "best_gk")?.value || "-"}</div>
        <div>${predictionResults.find(r => r.category === "best_czech_scorer")?.value || "-"}</div>
        <div>—</div>
      </div>
    </div>

    <!-- ===================== -->
    <!-- DRUHÁ TABULKA -->
    <!-- ===================== -->

    <div class="pred-header" style="margin-top:20px;">
      VÍTĚZOVÉ SKUPIN
    </div>

    <div class="pred-table pred-table-groups">

      <div class="pred-row pred-head pred-groups-head">
        <div>Hráč</div>
`;

  groups.forEach(g => {
    html += `<div>${g}</div>`;
  });

  html += `<div>BODY</div></div>`;

predictions
  .filter(p => p.player && p.player.trim() !== "")
  .forEach(p => {

  const pts = getGroupPointsFromRow(p);

  html += `
    <div class="pred-row pred-groups-row">
      <div class="pred-name">${p.player}</div>
  `;

  groups.forEach(g => {

const val = (p[g] ?? "").toString().trim() || "-";
const real = groupResults.find(r => r.group === g)?.winner;
const isCorrect = val && real && val === real;

    html += `
      <div class="${isCorrect ? "correct" : ""}">
        ${val || "-"}
      </div>
    `;
  });

  html += `
      <div class="pred-points">${pts}</div>
    </div>
  `;
});

  // REALITA – SKUPINY
// REALITA – SKUPINY
html += `
  <div class="pred-row pred-groups-real">
    <div class="pred-name">REALITA</div>
`;

groups.forEach(g => {
  const real = groupResults.find(r => r.group === g)?.winner || "-";
  html += `<div class="real-cell">${real}</div>`;
});

html += `
    <div class="pred-points">—</div>
  </div>
</div>
</div>
`;

  el.innerHTML = html;
}

function renderDayFilter() {
  const el = document.getElementById("dayFilter");

  const days = new Set();

  matches
    .filter(m => m.date)
    .forEach(m => days.add(m.date));

  const sortedDays = Array.from(days).sort();

  let html = "";

  sortedDays.forEach(day => {
    html += `
      <button
        class="filter"
        data-day="${day}"
        onclick="setDayFilter('${day}')">
        ${formatFilterDate(day)}
      </button>
    `;
  });

  el.innerHTML = html;

  // default = dnes
if (!selectedDay || !sortedDays.includes(selectedDay)) {
  selectedDay = getToday();
}

  updateFilterUI();
}

function formatFilterDate(date) {

  const d = new Date(date);

  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

let selectedDay = null;

function setDayFilter(day) {
  selectedDay = day;

  // refresh UI
  renderHistory();
  updateFilterUI();
}

function updateFilterUI() {
  document.querySelectorAll(".filter").forEach(btn => {
    btn.classList.remove("active");

    if (btn.dataset.day === selectedDay) {
      btn.classList.add("active");
    }
  });
}

function getFlag(team) {

  const map = {

    ARG: "ar",
    ALG: "dz",
    AUS: "au",
    AUT: "at",

    BEL: "be",
    BIH: "ba",
    BRA: "br",

    CAN: "ca",
    CIV: "ci",
    COL: "co",
    DRC: "cd",
    CPV: "cv",
    CRO: "hr",
    CZE: "cz",
    CUW: "cw",

    ECU: "ec",
    EGY: "eg",
    ENG: "gb-eng",
    ESP: "es",

    FRA: "fr",

    GER: "de",
    GHA: "gh",

    HAI: "ht",

    IRN: "ir",
    IRQ: "iq",

    JPN: "jp",
    JOR: "jo",

    KOR: "kr",

    MAR: "ma",
    MEX: "mx",

    NED: "nl",
    NOR: "no",
    NZL: "nz",

    PAN: "pa",
    PAR: "py",
    POR: "pt",

    QAT: "qa",

    RSA: "za",

    SAU: "sa",
    SCO: "gb-sct",
    SEN: "sn",
    SUI: "ch",
    SWE: "se",

    TUN: "tn",
    TUR: "tr",

    URU: "uy",
    USA: "us",
    UZB: "uz"
  };

  return map[team] || "un";
}

const GROUP_TEAMS = {
  A: ["CZE","RSA","MEX","KOR"],
  B: ["CAN","BIH","QAT","SUI"],
  C: ["BRA","MAR","HAI","SCO"],
  D: ["USA","PAR","AUS","TUR"],
  E: ["GER","CUW","CIV","ECU"],
  F: ["NED","JPN","SWE","TUN"],
  G: ["BEL","EGY","IRN","NZL"],
  H: ["ESP","CPV","SAU","URU"],
  I: ["FRA","SEN","IRQ","NOR"],
  J: ["ARG","ALG","AUT","JOR"],
  K: ["POR","DRC","UZB","COL"],
  L: ["ENG","CRO","GHA","PAN"]
};

function openMatch(matchId) {
  const match = matches.find(m => m.id == matchId);
  const currentUser = JSON.parse(
  localStorage.getItem("tipovacUser")
);
const kickoff = new Date(`${match.date}T${match.time}`);
const canTip = new Date() < kickoff;
  if (!match) return;

  document.getElementById("matchModal").classList.remove("hidden");

  const body = document.getElementById("modalBody");

  const hasScore =
    match.home_goals != null &&
    match.away_goals != null &&
    match.home_goals !== "" &&
    match.away_goals !== "";

  const score = hasScore
    ? `${match.home_goals} : ${match.away_goals}`
    : "VS";

  const time = match.time || "⏳ čas neuveden";

  document.getElementById("modalTitle").innerHTML = `
  <div class="modal-header">

    <div class="modal-teams">

      <div class="team-block">
        <img class="team-flag" src="https://flagcdn.com/28x21/${getFlag(match.home)}.png" />
        <div class="team-name">${match.home}</div>
      </div>

      <div class="modal-score">
        ${score}
      </div>

      <div class="team-block">
        <img class="team-flag" src="https://flagcdn.com/28x21/${getFlag(match.away)}.png" />
        <div class="team-name">${match.away}</div>
      </div>

    </div>

    <div class="modal-meta">
      🕒 ${time}
    </div>

  </div>
`;

  const matchTips = tips
    .filter(t => t.match_id == matchId)
    .map(t => ({
      ...t,
      points: getPoints(
        match.home_goals,
        match.away_goals,
        t.home,
        t.away
      )
    }))
    .sort((a, b) => b.points - a.points);

  // 🔥 KLÍČOVÁ OPRAVA
  body.innerHTML = `
    <div id="myTipForm"></div>
    <div class="tips-table">
      <div class="tips-header-row">
        <div>Hráč</div>
        <div>Tip</div>
        <div>Body</div>
      </div>

      <div id="tipsList"></div>
    </div>
  `;

  const list = document.getElementById("tipsList");

  if (currentUser) {

  const myTip = tips.find(t =>
    t.match_id == matchId &&
    t.player === currentUser.name
  );

  if (canTip) {

    document.getElementById("myTipForm").innerHTML = `
      <div class="my-tip-box">

        <h3>Můj tip</h3>

        <div class="my-tip-inputs">

          <input
            type="number"
            id="myHomeTip"
            value="${myTip?.home ?? ""}"
          >

          <span>:</span>

          <input
            type="number"
            id="myAwayTip"
            value="${myTip?.away ?? ""}"
          >

        </div>

        <button class="login-btn" onclick="saveMatchTip(${matchId})">
          Uložit tip
        </button>

      </div>
    `;

  } else {

    document.getElementById("myTipForm").innerHTML = `
      <div class="tip-locked">
        🔒 Tipování uzavřeno
      </div>
    `;

  }
}

  matchTips.forEach(t => {
    list.innerHTML += `
      <div class="tip-row">
        <div class="tip-player">${t.player}</div>
        <div class="tip-score">${t.home} : ${t.away}</div>
        <div class="tip-points">${t.points} b</div>
      </div>
    `;
  });
}

function closeModal() {
  document.getElementById("matchModal").classList.add("hidden");
}

document.getElementById("matchModal").addEventListener("click", (e) => {
  if (e.target.id === "matchModal") {
    closeModal();
  }
});

function getTodayMatches() {

  return matches.filter(m => m.date === getToday());
}

function getPointsClass(points) {
  if (points === 10) return "pts-10";
  if (points === 6) return "pts-6";
  if (points === 4) return "pts-4";
  if (points === 2) return "pts-2";
  return "pts-0";
}

function openTipsModal(matchId) {
  const match = matches.find(m => m.id == matchId);
  if (!match) return;

  document.getElementById("tipsModal").classList.remove("hidden");

  document.getElementById("tipsModalBody").innerHTML = `
    <div>
      <strong>${match.home} vs ${match.away}</strong>
      <p>Zadej svůj tip:</p>

      <input id="tipHome" type="number" placeholder="Domácí">
      <input id="tipAway" type="number" placeholder="Hosté">

      <button class="login-btn" onclick="saveTip(${match.id})">Uložit tip</button>
    </div>
  `;
}

function closeTipsModal() {
  document.getElementById("tipsModal").classList.add("hidden");
}

function openLoginModal() {
  document
    .getElementById("loginModal")
    .classList.remove("hidden");
    document.getElementById("loginModal").addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginUser();
});
}

function closeLoginModal() {
  document
    .getElementById("loginModal")
    .classList.add("hidden");
}

const loginModal = document.getElementById("loginModal");

loginModal.addEventListener("click", (e) => {
  if (e.target === loginModal) {
    closeLoginModal();
  }
});

let activeTab = "general";

function setPredTab(tab) {
  activeTab = tab;

  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.remove("active");
    if (b.dataset.tab === tab) b.classList.add("active");
  });

  document.querySelectorAll(".tab-content").forEach(c => {
    c.style.display = "none";
  });

  document.getElementById("tab-" + tab).style.display = "block";
}

function openPredictionsModal() {
  const my = getMyPredictions() || {};
  const myGroups = getMyGroupPredictions() || {};
  const user = JSON.parse(
  localStorage.getItem("tipovacUser")
);

  document.getElementById("predictionsModal").classList.remove("hidden");

  const el = document.getElementById("predictionsModalBody");

  const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"];

  let html = `
<div class="pred-form">

  <div class="tab-bar">
    <button class="tab-btn active" data-tab="general" onclick="setPredTab('general')">
      🏆 Turnaj
    </button>

    <button class="tab-btn" data-tab="individual" onclick="setPredTab('individual')">
      ⭐ Individuální
    </button>

    <button class="tab-btn" data-tab="groups" onclick="setPredTab('groups')">
      🏁 Skupiny
    </button>
  </div>

  <!-- ================= -->
  <!-- TAB 1 -->
  <!-- ================= -->
  <div id="tab-general" class="tab-content">
    <div class="pred-section">

<label>Jméno</label>
<input id="pred-player"
  value="${user?.name || ""}"
  disabled
        placeholder="Nejdřív se prihlaš" />

    </div>

  <div class="pred-section">
  <h3>🏆 Celkové pořadí</h3>

  <label>Vítěz turnaje</label>
  <input id="pred-champion" value="${my.champion || ""}" />

  <label>2. místo</label>
  <input id="pred-second" value="${my.second || ""}" />

  <label>3. místo</label>
  <input id="pred-third" value="${my.third || ""}" />
</div>
  </div>
    <div id="tab-individual" class="tab-content" style="display:none">

  <div class="pred-section">
  <h3>⭐ Individuální ceny</h3>

  <label>Nejlepší střelec</label>
  <input id="pred-topscorer" value="${my.top_scorer || ""}" />

  <label>Nejlepší hráč</label>
  <input id="pred-bestplayer" value="${my.best_player || ""}" />

  <label>Nejlepší mladý hráč</label>
  <input id="pred-bestyoung" value="${my.best_young || ""}" />

  <label>Nejlepší gólman</label>
  <input id="pred-bestgk" value="${my.best_gk || ""}" />

  <label>Nejlepší český střelec</label>
  <input id="pred-czech" value="${my.best_czech_scorer || ""}" />
</div>

  </div>
    <div id="tab-groups" class="tab-content" style="display:none">

  <div class="pred-section">
    <h3>🏁 Vítězové skupin</h3>

    <div class="groups-grid">
      ${groups.map(g => `
        <div class="group-select">
          <label>Skupina ${g}</label>

          <select id="group-${g}">
            <option value="">Vyber vítěze</option>

            ${GROUP_TEAMS[g].map(team => `
              <option value="${team}" ${myGroups[g] === team ? "selected" : ""}>
                ${team}
              </option>
            `).join("")}

          </select>
        </div>
      `).join("")}
    </div>

  </div>
</div>
    <div class="pred-section">
    <button class="login-btn" onclick="savePredictions()">
      Uložit predikce
    </button>
  </div>

</div>
`;


  el.innerHTML = html;
  setTimeout(() => setPredTab("general"), 0);
}
document.getElementById("predictionsModal").addEventListener("click", (e) => {
  if (e.target.id === "predictionsModal") {
    closePredictionsModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closePredictionsModal();
    closeLoginModal();
    closeTipsModal();
  }
});

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

function closePredictionsModal() {
  document.getElementById("predictionsModal").classList.add("hidden");
}

async function savePredictions() {

  const payload = {
    player: document.getElementById("pred-player").value,

    champion: document.getElementById("pred-champion").value,
    second: document.getElementById("pred-second").value,
    third: document.getElementById("pred-third").value,

    top_scorer: document.getElementById("pred-topscorer").value,
    best_player: document.getElementById("pred-bestplayer").value,
    best_young: document.getElementById("pred-bestyoung").value,
    best_gk: document.getElementById("pred-bestgk").value,
    best_czech_scorer: document.getElementById("pred-czech").value
  };

  const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"];

  groups.forEach(g => {
    payload[g] = document.getElementById(`group-${g}`).value;
  });

  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    body: new URLSearchParams({
      sheet: "predictions",
      payload: JSON.stringify(payload)
    })
  });

  if (!res.ok) throw new Error("Server error");

  showToast("Predikce uloženy");
  closePredictionsModal();
  loadData();
}

async function loginUser() {

  const name = document.getElementById("loginName").value.trim();
  const pin = document.getElementById("loginPin").value.trim();

  if (!name || !pin) {
    showToast("Vyplň jméno i PIN.");
    return;
  }

  const players = await fetch(SHEET_URL + "/players").then(r => r.json());

  const user = players.find(p => p.name === name && p.pin == pin);

  if (!user) {
    showToast("Špatné jméno nebo PIN.");
    return;
  }

  localStorage.setItem("tipovacUser", JSON.stringify({
    name: user.name
  }));

  closeLoginModal();
  updateUserButton();
}

function updateUserButton() {

  const user = JSON.parse(localStorage.getItem("tipovacUser"));

  const el = document.getElementById("userBadge");

  if (!user) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = `
    <div class="user-badge">
      👤 ${user.name}
    </div>
  `;
}

function getMyTip(matchId) {
  const user = JSON.parse(localStorage.getItem("tipovacUser"));
  if (!user) return null;

  return tips.find(t =>
    t.match_id == matchId &&
    t.player === user.name
  );
}

function getMyPredictions() {
  const user = JSON.parse(localStorage.getItem("tipovacUser"));
  if (!user) return null;

  return predictions.find(p => p.player === user.name);
}

async function saveMatchTip(matchId) {

  const user = JSON.parse(
    localStorage.getItem("tipovacUser")
  );

  if (!user) {
    showToast("Nejprve se přihlas.");
    return;
  }

  const home =
    document.getElementById("myHomeTip").value;

  const away =
    document.getElementById("myAwayTip").value;

  if (home === "" || away === "") {
    showToast("Vyplň výsledek.");
    return;
  }

  const payload = {
    match_id: matchId,
    player: user.name,
    home: home,
    away: away
  };

  const formData = new URLSearchParams();

  formData.append("sheet", "tips");
  formData.append(
    "payload",
    JSON.stringify(payload)
  );

  try {

    await fetch(SCRIPT_URL, {
      method: "POST",
      body: formData
    });

    showToast("Tip uložen.");

setTimeout(() => {
  loadData();
}, 3000);
    closeModal();

  } catch(err) {

    console.error(err);

    showToast("Nepodařilo se uložit tip.");

  }
}

function startAutoRefresh() {
  setInterval(() => {
    loadData();
  }, 5000);
}

loadData();
startAutoRefresh();
updateUserButton();
async function saveTestTip() {
  const formData = new FormData();

  formData.append("sheet", "tips");
  formData.append("payload", JSON.stringify({
    match_id: 1,
    player: "David",
    home: 2,
    away: 1
  }));

  await fetch(API_URL, {
    method: "POST",
    body: formData
  });

  console.log("odesláno");
}
