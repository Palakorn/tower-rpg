(function (root) {
  root.YgoTower = root.YgoTower || {};
  root.YgoTower.Views = root.YgoTower.Views || {};

  let searchQuery = '';

  function isExtraDeckCard(card) {
    const t = (card?.frameType || card?.type || '').toLowerCase();
    return t.includes('fusion') || t.includes('synchro') || t.includes('xyz') || t.includes('link');
  }

  async function renderDeckBuilderView(container, state) {
    const App = root.YgoTower.App;
    const DB = root.YgoTower.DB;
    const Api = root.YgoTower.Api;
    const Ydk = root.YgoTower.Ydk;

    const season = state.activeSeason;
    if (!season) {
      container.innerHTML = `<div class="card">กรุณาเริ่ม Season ใหม่ก่อนใช้งาน Deck Builder</div>`;
      return;
    }

    season.playerDeck = season.playerDeck || { main: [], extra: [], side: [] };
    const collection = season.collection || {};
    const ownedIds = Object.keys(collection)
      .map((k) => Number(k))
      .filter((id) => collection[String(id)] > 0);

    const deck = season.playerDeck;
    const allIds = [...ownedIds, ...deck.main, ...deck.extra, ...deck.side];
    const resolvedMap = await Api.getCardsByIds(allIds);
    const cardMap = new Map();
    for (const id of allIds) {
      if (!cardMap.has(id)) {
        cardMap.set(id, resolvedMap.get(id) || { id, name: `Card #${id}`, type: '', frameType: '', image_url: '' });
      }
    }

    const usedCounts = new Map();
    for (const id of [...deck.main, ...deck.extra, ...deck.side]) {
      usedCounts.set(id, (usedCounts.get(id) || 0) + 1);
    }

    const validation = Ydk.validateDeck(deck, collection, cardMap);

    const buildCollectionHtml = () => {
      const q = searchQuery.toLowerCase();
      const filteredOwned = ownedIds
        .map((id) => ({ id, card: cardMap.get(id), owned: collection[String(id)] }))
        .filter((item) => item.card.name.toLowerCase().includes(q) || String(item.id).includes(searchQuery))
        .slice(0, 60);

      return filteredOwned.length
        ? filteredOwned
            .map(({ id, card, owned }) => {
              const used = usedCounts.get(id) || 0;
              const maxAllowed = Math.min(3, owned);
              const canAdd = used < maxAllowed;
              return `
                <div class="ygo-card-tile">
                  <img src="${App.escapeHtml(card.image_url || '')}" alt="${App.escapeHtml(card.name)}" loading="lazy" />
                  <strong>${App.escapeHtml(card.name)}</strong>
                  <div class="muted">มี ${owned} ใบ • ใช้ ${used}/${maxAllowed}</div>
                  <div style="display:flex; gap:4px; margin-top:auto;">
                    <button class="btn btn-sm btn-primary" data-add-card="auto:${id}" ${canAdd ? '' : 'disabled'}>+ Deck</button>
                    <button class="btn btn-sm" data-add-card="side:${id}" ${canAdd ? '' : 'disabled'}>+ Side</button>
                  </div>
                </div>
              `;
            })
            .join('')
        : `<p class="muted">ไม่พบการ์ดในคลัง (เปิดซองหรือ Import Starter .ydk เพื่อเพิ่มการ์ดเข้าคลัง)</p>`;
    };

    const renderDeckZone = (title, zoneKey, ids) => {
      const counts = new Map();
      for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
      const rows = Array.from(counts.entries())
        .map(([id, cnt]) => {
          const c = cardMap.get(id) || { name: `Card #${id}`, image_url: '' };
          const thumbHtml = c.image_url
            ? `<img class="deck-card-thumb" src="${App.escapeHtml(c.image_url)}" alt="${App.escapeHtml(c.name)}" loading="lazy" />`
            : `<div class="deck-card-thumb" aria-hidden="true"></div>`;
          return `
            <div class="floor-item deck-card-row">
              <span class="deck-card-info" title="${App.escapeHtml(c.name)}">
                ${thumbHtml}
                <span class="deck-card-name"><strong>${cnt}x</strong> ${App.escapeHtml(c.name)}</span>
              </span>
              <button class="btn btn-sm btn-danger" style="flex-shrink:0;" data-remove-card="${zoneKey}:${id}">-</button>
            </div>
          `;
        })
        .join('');
      return `
        <div style="margin-bottom:12px;">
          <strong>${title} (${ids.length})</strong>
          <div style="margin-top:6px;">${rows || '<span class="muted">ว่าง</span>'}</div>
        </div>
      `;
    };

    container.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 340px 1fr;">
        <div>
          <div class="card">
            <h3 class="card-title">
              <span>📦 Deck ปัจจุบัน</span>
              <button class="btn btn-sm btn-gold" id="exportPlayerYdkBtn">📥 Export .ydk</button>
            </h3>
            ${
              validation.errors.length
                ? `<div class="alert-box danger" style="font-size:0.82rem;">${validation.errors.map((e) => `<div>• ${App.escapeHtml(e)}</div>`).join('')}</div>`
                : `<div class="alert-box" style="border-color:var(--success); background:rgba(52,211,153,0.1); font-size:0.82rem;">✅ Deck ถูกต้องตามกติกา พร้อม Export ไป MDPro4</div>`
            }
            ${renderDeckZone('Main Deck (40–60)', 'main', deck.main)}
            ${renderDeckZone('Extra Deck (≤15)', 'extra', deck.extra)}
            ${renderDeckZone('Side Deck (≤15)', 'side', deck.side)}
          </div>
        </div>

        <div>
          <div class="card">
            <h3 class="card-title">
              <span>📚 คลังการ์ดของคุณ (${ownedIds.length} แบบ)</span>
            </h3>
            <input type="text" id="deckCardSearch" value="${App.escapeHtml(searchQuery)}" placeholder="ค้นหาชื่อการ์ดหรือรหัสการ์ดในคลัง..." style="width:100%; margin-bottom:12px;" />
            <div class="cards-grid" id="deckCollectionGrid"></div>
          </div>
        </div>
      </div>
    `;

    const collectionGrid = document.getElementById('deckCollectionGrid');
    const renderCollectionGrid = () => {
      collectionGrid.innerHTML = buildCollectionHtml();
      collectionGrid.querySelectorAll('[data-add-card]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const [mode, idStr] = btn.dataset.addCard.split(':');
          const id = Number(idStr);
          const card = cardMap.get(id);
          const zone = mode === 'side' ? 'side' : isExtraDeckCard(card) ? 'extra' : 'main';
          deck[zone].push(id);
          await DB.saveSeason(season);
          renderDeckBuilderView(container, state);
        });
      });
    };

    renderCollectionGrid();

    document.getElementById('deckCardSearch').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderCollectionGrid();
    });

    document.getElementById('exportPlayerYdkBtn').addEventListener('click', () => {
      const ydkText = Ydk.generateYdk(deck);
      const safeName = season.name.replace(/[^a-z0-9ก-๙_-]/gi, '_');
      root.YgoTower.SaveManager.downloadFile(`${safeName}_deck.ydk`, ydkText, 'text/plain');
    });

    container.querySelectorAll('[data-remove-card]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const [zone, idStr] = btn.dataset.removeCard.split(':');
        const id = Number(idStr);
        const idx = deck[zone].indexOf(id);
        if (idx !== -1) {
          deck[zone].splice(idx, 1);
          await DB.saveSeason(season);
          renderDeckBuilderView(container, state);
        }
      });
    });
  }

  root.YgoTower.Views.renderDeckBuilderView = renderDeckBuilderView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
