(function (root) {
  root.YgoTower = root.YgoTower || {};
  root.YgoTower.Views = root.YgoTower.Views || {};

  let selectedShopFloor = 1;

  function addCardsToCollection(season, pulledItems) {
    season.collection = season.collection || {};
    for (const item of pulledItems) {
      const key = String(item.card.id);
      season.collection[key] = (season.collection[key] || 0) + 1;
    }
  }

  function showPackResultModal(setName, pulledItems) {
    const App = root.YgoTower.App;
    const cardsHtml = pulledItems
      .map(
        (p) => `
      <div class="ygo-card-tile">
        <img src="${App.escapeHtml(p.card.image_url || '')}" alt="${App.escapeHtml(p.card.name)}" loading="lazy" />
        <span class="badge badge-${p.bucket}">${App.escapeHtml(p.rarity)}</span>
        <strong>${App.escapeHtml(p.card.name)}</strong>
      </div>
    `
      )
      .join('');

    App.openModal(`
      <h3 class="card-title">✨ เปิดซอง: ${App.escapeHtml(setName)}</h3>
      <div class="cards-grid">${cardsHtml}</div>
      <div class="form-row" style="justify-content:flex-end; margin-top:16px;">
        <button class="btn btn-primary" id="closePackModalBtn">เก็บเข้าคลัง</button>
      </div>
    `);
    document.getElementById('closePackModalBtn').addEventListener('click', () => {
      App.closeModal();
      App.renderCurrentView();
    });
  }

  async function openEventModal(eventIndex, season, settings) {
    const App = root.YgoTower.App;
    const DB = root.YgoTower.DB;
    const Api = root.YgoTower.Api;
    const PackSim = root.YgoTower.PackSimulator;
    const db = DB.getDB();

    const ev = season.pendingEvents[eventIndex];
    const allSets = await db.sets.toArray();
    const eligibleSets = PackSim.getEventEligibleSets(allSets, ev.floor);

    if (ev.type === 'free_pack') {
      const renderSetOptions = (filterText = '') => {
        const q = filterText.toLowerCase();
        return eligibleSets
          .filter((s) => s.set_name.toLowerCase().includes(q) || s.set_code.toLowerCase().includes(q))
          .slice(0, 40)
          .map(
            (s) => `
            <div class="floor-item" style="margin-bottom:6px;">
              <div>
                <strong>${App.escapeHtml(s.set_name)}</strong>
                <div class="muted">ชั้น ${s.assignedFloor} • ${(s.templateType || 'tcg').toUpperCase()}</div>
              </div>
              <button class="btn btn-sm btn-gold" data-pick-free-pack="${App.escapeHtml(s.set_name)}">เปิดฟรี</button>
            </div>
          `
          )
          .join('');
      };

      App.openModal(`
        <h3 class="card-title">🎁 รางวัลชนะ 4 ครั้ง: เปิดซองฟรี 1 ซอง</h3>
        <p class="muted">เลือกซองจาก Pool ชั้น ${ev.floor} (ไม่เกินชั้น ${Math.min(7, ev.floor + 1)})</p>
        <input type="text" id="eventPackSearch" placeholder="ค้นหาชื่อซอง..." style="width:100%; margin-bottom:10px;" />
        <div id="eventPackList" style="max-height:360px; overflow-y:auto;">${renderSetOptions()}</div>
      `);

      const listEl = document.getElementById('eventPackList');
      const bindButtons = () => {
        listEl.querySelectorAll('[data-pick-free-pack]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const setName = btn.dataset.pickFreePack;
            const setMeta = eligibleSets.find((s) => s.set_name === setName);
            const setCards = await Api.getCardsInSet(setName);
            if (!setCards.length) {
              App.showToast('ซองนี้ยังไม่มีข้อมูลการ์ดในแคช กรุณาเลือกซองอื่น');
              return;
            }
            const pulled = PackSim.openPack(setCards, setMeta?.templateType || 'tcg', settings);
            addCardsToCollection(season, pulled);
            season.pendingEvents.splice(eventIndex, 1);
            await DB.saveSeason(season);
            showPackResultModal(setName, pulled);
          });
        });
      };
      bindButtons();

      document.getElementById('eventPackSearch').addEventListener('input', (e) => {
        listEl.innerHTML = renderSetOptions(e.target.value);
        bindButtons();
      });
    } else if (ev.type === 'pick_card') {
      const eligibleSetNames = new Set(eligibleSets.map((s) => s.set_name));
      const allCards = await db.cards.toArray();
      const eligibleCards = allCards.filter(
        (c) => c.card_sets && c.card_sets.some((cs) => eligibleSetNames.has(cs.set_name))
      );

      const renderCardChoices = (filterText = '') => {
        const q = filterText.toLowerCase();
        const matches = eligibleCards.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 24);
        if (!matches.length) return `<p class="muted">ไม่พบการ์ดที่ค้นหา</p>`;
        return matches
          .map(
            (c) => `
          <div class="ygo-card-tile">
            <img src="${App.escapeHtml(c.image_url || '')}" alt="${App.escapeHtml(c.name)}" loading="lazy" />
            <strong>${App.escapeHtml(c.name)}</strong>
            <button class="btn btn-sm btn-gold" data-pick-card-id="${c.id}">เลือกใบนี้</button>
          </div>
        `
          )
          .join('');
      };

      App.openModal(`
        <h3 class="card-title">🌟 รางวัลชนะ 8 ครั้ง: เลือกการ์ดที่ต้องการ 1 ใบ</h3>
        <p class="muted">เลือกการ์ดจาก Pool ชั้น ${ev.floor} (ไม่เกินชั้น ${Math.min(7, ev.floor + 1)}) — พบ ${eligibleCards.length} ใบ</p>
        <input type="text" id="eventCardSearch" placeholder="พิมพ์ชื่อการ์ด..." style="width:100%; margin-bottom:10px;" />
        <div id="eventCardGrid" class="cards-grid" style="max-height:400px; overflow-y:auto;">${renderCardChoices()}</div>
      `);

      const gridEl = document.getElementById('eventCardGrid');
      const bindCardButtons = () => {
        gridEl.querySelectorAll('[data-pick-card-id]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const cardId = btn.dataset.pickCardId;
            season.collection = season.collection || {};
            season.collection[cardId] = (season.collection[cardId] || 0) + 1;
            season.pendingEvents.splice(eventIndex, 1);
            await DB.saveSeason(season);
            App.closeModal();
            App.showToast('เพิ่มการ์ดรางวัลเข้าคลังเรียบร้อย!');
            App.renderCurrentView();
          });
        });
      };
      bindCardButtons();

      document.getElementById('eventCardSearch').addEventListener('input', (e) => {
        gridEl.innerHTML = renderCardChoices(e.target.value);
        bindCardButtons();
      });
    }
  }

  async function renderShopView(container, state) {
    const App = root.YgoTower.App;
    const Constants = root.YgoTower.Constants;
    const DB = root.YgoTower.DB;
    const Api = root.YgoTower.Api;
    const Tower = root.YgoTower.Tower;
    const PackSim = root.YgoTower.PackSimulator;
    const db = DB.getDB();

    const season = state.activeSeason;
    const settings = state.settings;

    if (!season) {
      container.innerHTML = `<div class="card">กรุณาเริ่ม Season ใหม่ในหน้า หอคอย 7 ชั้น ก่อนใช้งานร้านค้า</div>`;
      return;
    }

    const allSets = await db.sets.toArray();
    if (!allSets.length) {
      container.innerHTML = `
        <div class="card">
          <h3>ยังไม่มีข้อมูลซองการ์ด</h3>
          <p class="muted">กรุณาไปที่หน้า ⚙️ ตั้งค่า &amp; Save เพื่อซิงค์ข้อมูลการ์ดและซองจาก YGOPRODeck API ก่อน</p>
          <button class="btn btn-primary" id="shopGoSyncBtn">ไปหน้าซิงค์ข้อมูล</button>
        </div>
      `;
      document.getElementById('shopGoSyncBtn').addEventListener('click', () => App.switchTab('settings'));
      return;
    }

    const pendingEventsHtml = (season.pendingEvents || []).length
      ? `
        <div class="card" style="border-color:var(--gold);">
          <h3 class="card-title">🎁 รางวัล Event ที่รอรับ</h3>
          <div class="form-row" style="margin:0;">
            ${season.pendingEvents
              .map(
                (ev, idx) => `
              <button class="btn btn-gold" data-claim-event="${idx}">
                ${ev.type === 'free_pack' ? `เปิดซองฟรี (Event 4 ชนะ • ชั้น ${ev.floor})` : `เลือกการ์ดฟรี 1 ใบ (Event 8 ชนะ • ชั้น ${ev.floor})`}
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      `
      : '';

    const floorTabsHtml = Constants.FLOORS.map(
      (f) => `
      <button class="btn btn-sm ${selectedShopFloor === f.floor ? 'btn-primary' : ''}" data-shop-floor="${f.floor}">
        ชั้น ${f.floor} (${f.era.split(' ')[0]})
      </button>
    `
    ).join('');

    const isUnlocked =
      selectedShopFloor <= season.currentFloor || (season.unlockedFloors || []).includes(selectedShopFloor);
    const eco = Tower.getFloorEconomy(selectedShopFloor, settings);
    const floorSets = allSets.filter((s) => Number(s.assignedFloor) === selectedShopFloor);

    const setsHtml = floorSets.length
      ? floorSets
          .map(
            (s) => `
          <div class="opponent-card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="badge">${(s.templateType || 'tcg').toUpperCase()}</span>
              <span class="muted">${App.escapeHtml(s.tcg_date || '-')}</span>
            </div>
            <strong>${App.escapeHtml(s.set_name)}</strong>
            <div class="muted">รหัส: ${App.escapeHtml(s.set_code)} • ราคา ${eco.packPrice} DP</div>
            <button
              class="btn btn-sm btn-gold"
              data-buy-pack="${App.escapeHtml(s.set_name)}"
              ${isUnlocked && season.dp >= eco.packPrice ? '' : 'disabled'}
            >
              ${isUnlocked ? `ซื้อ &amp; เปิด (${eco.packPrice} DP)` : '🔒 ยังไม่ปลดล็อก'}
            </button>
          </div>
        `
          )
          .join('')
      : `<p class="muted">ยังไม่มีซองในชั้นนี้ (สามารถจัดกลุ่มซองเพิ่มเติมได้ในหน้า ตั้งค่า)</p>`;

    container.innerHTML = `
      ${pendingEventsHtml}
      <div class="card">
        <h3 class="card-title">
          <span>🛒 ร้านค้าซองการ์ด</span>
          <span class="pill">DP คงเหลือ: <strong>${season.dp}</strong></span>
        </h3>
        <div class="form-row">${floorTabsHtml}</div>
        <p class="muted">
          ชั้น ${selectedShopFloor}: ราคาซองละ <strong>${eco.packPrice} DP</strong> •
          สถานะ: ${isUnlocked ? '<span style="color:var(--success)">ปลดล็อกแล้ว</span>' : '<span style="color:var(--danger)">ล็อกอยู่</span>'}
        </p>
        <div class="opponent-grid">${setsHtml}</div>
      </div>
    `;

    container.querySelectorAll('[data-claim-event]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openEventModal(Number(btn.dataset.claimEvent), season, settings);
      });
    });

    container.querySelectorAll('[data-shop-floor]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedShopFloor = Number(btn.dataset.shopFloor);
        renderShopView(container, state);
      });
    });

    container.querySelectorAll('[data-buy-pack]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const setName = btn.dataset.buyPack;
        if (season.dp < eco.packPrice) {
          App.showToast('DP ไม่พอ!');
          return;
        }
        const setMeta = floorSets.find((s) => s.set_name === setName);
        const setCards = await Api.getCardsInSet(setName);
        if (!setCards.length) {
          App.showToast('ไม่พบข้อมูลการ์ดของซองนี้ในแคช');
          return;
        }
        season.dp -= eco.packPrice;
        const pulled = PackSim.openPack(setCards, setMeta?.templateType || 'tcg', settings);
        addCardsToCollection(season, pulled);
        await DB.saveSeason(season);
        showPackResultModal(setName, pulled);
      });
    });
  }

  root.YgoTower.Views.renderShopView = renderShopView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
