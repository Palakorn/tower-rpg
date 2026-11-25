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

  const RARITY_GROUPS = [
    { key: 'secret', shortLabel: 'Secret', label: 'Secret / Starlight / Prismatic' },
    { key: 'ultra', shortLabel: 'Ultra', label: 'Ultra / Ultimate / Ghost / Gold' },
    { key: 'super', shortLabel: 'Super', label: 'Super Rare' },
    { key: 'rare', shortLabel: 'Rare', label: 'Rare' },
    { key: 'common', shortLabel: 'Common', label: 'Common' },
  ];

  function renderCardDetailView(setMeta, item, bucket, season, onBackToPack) {
    const App = root.YgoTower.App;
    const { card, setEntry } = item;
    const owned = (season.collection && season.collection[String(card.id)]) || 0;

    const statPills = [];
    if (card.type) statPills.push(`<span class="badge">${App.escapeHtml(card.type)}</span>`);
    if (card.attribute) statPills.push(`<span class="badge">${App.escapeHtml(card.attribute)}</span>`);
    if (card.race) statPills.push(`<span class="badge">${App.escapeHtml(card.race)}</span>`);
    if (card.level !== null && card.level !== undefined) {
      statPills.push(`<span class="badge">LV/Rank ${card.level}</span>`);
    }
    if (card.atk !== null && card.atk !== undefined) {
      statPills.push(`<span class="badge">ATK ${card.atk}</span>`);
    }
    if (card.def !== null && card.def !== undefined) {
      statPills.push(`<span class="badge">DEF ${card.def}</span>`);
    }

    App.openModal(`
      <div class="pack-detail-modal">
        <div class="form-row" style="justify-content:space-between; margin-bottom:12px;">
          <button class="btn btn-sm" id="backToPackListBtn">← กลับไปรายการการ์ดในซอง</button>
          <button class="btn btn-sm" id="closeCardDetailBtn">ปิด</button>
        </div>
        <div class="card-detail-layout">
          <img class="card-detail-img" src="${App.escapeHtml(card.image_url || '')}" alt="${App.escapeHtml(card.name)}" />
          <div>
            <h3 style="margin:0 0 6px;">${App.escapeHtml(card.name)}</h3>
            <div class="card-detail-meta">
              <span class="badge badge-${bucket}">${App.escapeHtml(setEntry?.set_rarity || bucket)}</span>
              ${setEntry?.set_code ? `<span class="badge">${App.escapeHtml(setEntry.set_code)}</span>` : ''}
              <span class="badge">มีในคลัง: ${owned} ใบ</span>
            </div>
            <div class="card-detail-meta">${statPills.join('')}</div>
            <div class="card-detail-desc">${App.escapeHtml(card.desc || 'ไม่มีคำอธิบาย')}</div>
          </div>
        </div>
      </div>
    `);

    document.getElementById('backToPackListBtn').addEventListener('click', onBackToPack);
    document.getElementById('closeCardDetailBtn').addEventListener('click', () => App.closeModal());
  }

  async function showPackDetailsModal(setMeta, season, onBack = null) {
    const App = root.YgoTower.App;
    const Constants = root.YgoTower.Constants;
    const Api = root.YgoTower.Api;
    const PackSim = root.YgoTower.PackSimulator;

    const setCards = await Api.getCardsInSet(setMeta.set_name);
    if (!setCards.length) {
      App.showToast('ไม่พบข้อมูลการ์ดของซองนี้ในแคช');
      return;
    }

    const buckets = PackSim.groupByRarity(setCards);
    let activeRarity = 'all';
    let searchQuery = '';

    const renderPackContents = () => {
      const q = searchQuery.trim().toLowerCase();
      const visibleGroups = RARITY_GROUPS.filter((g) => activeRarity === 'all' || activeRarity === g.key);

      const sectionsHtml = visibleGroups
        .map((g) => {
          const items = (buckets[g.key] || [])
            .filter((item) => !q || item.card.name.toLowerCase().includes(q))
            .slice()
            .sort((a, b) => a.card.name.localeCompare(b.card.name));

          if (!items.length) return '';

          const tilesHtml = items
            .map((item) => {
              const owned = (season.collection && season.collection[String(item.card.id)]) || 0;
              return `
                <div class="ygo-card-tile clickable" data-card-id="${item.card.id}" data-bucket="${g.key}">
                  <img src="${App.escapeHtml(item.card.image_url || '')}" alt="${App.escapeHtml(item.card.name)}" loading="lazy" />
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:4px; flex-wrap:wrap;">
                    <span class="badge badge-${g.key}">${App.escapeHtml(item.setEntry?.set_rarity || g.shortLabel)}</span>
                    ${owned > 0 ? `<span class="muted">x${owned}</span>` : ''}
                  </div>
                  <strong>${App.escapeHtml(item.card.name)}</strong>
                  ${item.setEntry?.set_code ? `<span class="muted">${App.escapeHtml(item.setEntry.set_code)}</span>` : ''}
                </div>
              `;
            })
            .join('');

          return `
            <div class="rarity-section">
              <div class="rarity-section-header">
                <span class="badge badge-${g.key}">${App.escapeHtml(g.label)}</span>
                <span class="muted">${items.length} ใบ</span>
              </div>
              <div class="cards-grid">${tilesHtml}</div>
            </div>
          `;
        })
        .join('');

      const tabsHtml = [
        `<button class="btn btn-sm ${activeRarity === 'all' ? 'btn-primary' : ''}" data-rarity-tab="all">ทั้งหมด (${setCards.length})</button>`,
        ...RARITY_GROUPS.map((g) => {
          const count = (buckets[g.key] || []).length;
          return `
            <button class="btn btn-sm ${activeRarity === g.key ? 'btn-primary' : ''}" data-rarity-tab="${g.key}" ${count === 0 ? 'disabled' : ''}>
              ${g.shortLabel} (${count})
            </button>
          `;
        }),
      ].join('');

      App.openModal(`
        <div class="pack-detail-modal">
          <div class="pack-detail-header">
            <img class="pack-thumb-sm" src="${App.escapeHtml(Constants.getPackImageUrl(setMeta))}" alt="${App.escapeHtml(setMeta.set_name)}" />
            <div style="min-width:0; flex:1;">
              <h3 style="margin:0;">📦 ${App.escapeHtml(setMeta.set_name)}</h3>
              <div class="muted">${App.escapeHtml(setMeta.set_code || '')} • ${setCards.length} ใบ • คลิกที่การ์ดเพื่อดูรายละเอียด</div>
            </div>
            ${onBack ? `<button class="btn btn-sm" id="packDetailBackBtn">← กลับ</button>` : ''}
            <button class="btn btn-sm" id="closePackDetailBtn">ปิด</button>
          </div>
          <div class="form-row" style="margin-bottom:10px;">${tabsHtml}</div>
          <input type="text" id="packCardSearchInput" value="${App.escapeHtml(searchQuery)}" placeholder="ค้นหาชื่อการ์ดในซอง..." style="width:100%; margin-bottom:12px;" />
          <div class="pack-detail-scroll" id="packDetailScroll">
            ${sectionsHtml || '<p class="muted">ไม่พบการ์ดที่ตรงกับเงื่อนไข</p>'}
          </div>
        </div>
      `);

      document.getElementById('closePackDetailBtn').addEventListener('click', () => App.closeModal());
      const backBtn = document.getElementById('packDetailBackBtn');
      if (backBtn && onBack) {
        backBtn.addEventListener('click', onBack);
      }

      document.querySelectorAll('[data-rarity-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeRarity = btn.dataset.rarityTab;
          renderPackContents();
        });
      });

      const searchInput = document.getElementById('packCardSearchInput');
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        const pos = e.target.selectionStart;
        renderPackContents();
        const nextInput = document.getElementById('packCardSearchInput');
        if (nextInput) {
          nextInput.focus();
          if (typeof pos === 'number') nextInput.setSelectionRange(pos, pos);
        }
      });

      document.querySelectorAll('#packDetailScroll [data-card-id]').forEach((tile) => {
        tile.addEventListener('click', () => {
          const cardId = Number(tile.dataset.cardId);
          const bucket = tile.dataset.bucket;
          const item = (buckets[bucket] || []).find((entry) => entry.card.id === cardId);
          if (!item) return;
          renderCardDetailView(setMeta, item, bucket, season, renderPackContents);
        });
      });
    };

    renderPackContents();
  }

  function showPackResultModal(setName, pulledItems, setMeta) {
    const App = root.YgoTower.App;
    const Constants = root.YgoTower.Constants;
    const PackEffects = root.YgoTower.PackEffects;

    if (PackEffects) {
      App.closeModal();
      PackEffects.show({
        setName,
        packImageUrl: setMeta ? Constants.getPackImageUrl(setMeta) : '',
        pulledItems,
        onDone: () => App.renderCurrentView(),
      });
      return;
    }

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
    const Constants = root.YgoTower.Constants;
    const DB = root.YgoTower.DB;
    const Api = root.YgoTower.Api;
    const PackSim = root.YgoTower.PackSimulator;
    const db = DB.getDB();

    const ev = season.pendingEvents[eventIndex];
    const eventCfg = Constants.getEventConfig(settings);
    const allSets = await db.sets.toArray();
    const eligibleSets = PackSim.getEventEligibleSets(allSets, ev.floor, ev.type);

    if (ev.type === 'free_pack') {
      const sortedEligible = eligibleSets
        .slice()
        .sort((a, b) => (a.tcg_date || '').localeCompare(b.tcg_date || ''));
      const renderSetOptions = (filterText = '') => {
        const q = filterText.toLowerCase();
        return sortedEligible
          .filter((s) => s.set_name.toLowerCase().includes(q) || s.set_code.toLowerCase().includes(q))
          .slice(0, 100)
          .map(
            (s) => `
            <div class="floor-item" style="margin-bottom:6px; gap:10px;">
              <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                <img class="pack-thumb-sm" src="${App.escapeHtml(Constants.getPackImageUrl(s))}" alt="${App.escapeHtml(s.set_name)}" loading="lazy" />
                <div style="min-width:0;">
                  <strong>${App.escapeHtml(s.set_name)}</strong>
                  <div class="muted">${App.escapeHtml(s.set_code)} • ชั้น ${s.assignedFloor} • ${(s.templateType || 'tcg').toUpperCase()}</div>
                </div>
              </div>
              <div style="display:flex; gap:6px; flex-shrink:0;">
                <button class="btn btn-sm" data-inspect-free-pack="${App.escapeHtml(s.set_name)}">ดูการ์ด</button>
                <button class="btn btn-sm btn-gold" data-pick-free-pack="${App.escapeHtml(s.set_name)}">เปิดฟรี</button>
              </div>
            </div>
          `
          )
          .join('');
      };

      App.openModal(`
        <h3 class="card-title">🎁 รางวัลครบ ${ev.threshold || eventCfg.packThreshold} EvP: เปิดซองฟรี 1 ซอง</h3>
        <p class="muted">เลือกซองจาก Pool ชั้น ${ev.floor} (ไม่เกินชั้น ${Math.min(7, ev.floor + 1)})</p>
        <input type="text" id="eventPackSearch" placeholder="ค้นหาชื่อซอง..." style="width:100%; margin-bottom:10px;" />
        <div id="eventPackList" style="max-height:360px; overflow-y:auto;">${renderSetOptions()}</div>
      `);

      const listEl = document.getElementById('eventPackList');
      const bindButtons = () => {
        listEl.querySelectorAll('[data-inspect-free-pack]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const setMeta = eligibleSets.find((s) => s.set_name === btn.dataset.inspectFreePack);
            if (!setMeta) return;
            showPackDetailsModal(setMeta, season, () => openEventModal(eventIndex, season, settings));
          });
        });

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
            showPackResultModal(setName, pulled, setMeta);
          });
        });
      };
      bindButtons();

      document.getElementById('eventPackSearch').addEventListener('input', (e) => {
        listEl.innerHTML = renderSetOptions(e.target.value);
        bindButtons();
      });
    } else if (ev.type === 'pick_card') {
      const allCards = await db.cards.toArray();
      const ownedByName = PackSim.getOwnedCountsByName(allCards, season.collection);
      const totalPoolCount = PackSim.getPickCardEligibleCards(eligibleSets, allCards).length;

      let selectedFloor = 'all';
      let selectedSet = 'all';
      let searchQuery = '';

      const getFilteredSets = () =>
        eligibleSets
          .filter((s) => selectedFloor === 'all' || Number(s.assignedFloor) === Number(selectedFloor))
          .slice()
          .sort((a, b) => {
            const floorDiff = Number(a.assignedFloor || 0) - Number(b.assignedFloor || 0);
            if (floorDiff !== 0) return floorDiff;
            const dateDiff = (a.tcg_date || '').localeCompare(b.tcg_date || '');
            if (dateDiff !== 0) return dateDiff;
            return (a.set_name || '').localeCompare(b.set_name || '');
          });

      const renderFloorOptions = () => [
        `<option value="all"${selectedFloor === 'all' ? ' selected' : ''}>ทุกชั้น (1–7)</option>`,
        ...((Constants && Constants.FLOORS) || []).map(
          (f) =>
            `<option value="${f.floor}"${String(selectedFloor) === String(f.floor) ? ' selected' : ''}>ชั้น ${f.floor}: ${App.escapeHtml(f.name)}</option>`
        ),
      ].join('');

      const renderPackOptions = () => {
        const setsForFloor = getFilteredSets();
        if (selectedSet !== 'all' && !setsForFloor.some((s) => s.set_name === selectedSet)) {
          selectedSet = 'all';
        }
        return [
          `<option value="all"${selectedSet === 'all' ? ' selected' : ''}>ทุกซอง (${setsForFloor.length} ซอง)</option>`,
          ...setsForFloor.map(
            (s) =>
              `<option value="${App.escapeHtml(s.set_name)}"${selectedSet === s.set_name ? ' selected' : ''}>[ชั้น ${s.assignedFloor}] ${App.escapeHtml(s.set_name)} (${App.escapeHtml(s.set_code)})</option>`
          ),
        ].join('');
      };

      const renderCardChoices = () => {
        const matches = PackSim.getPickCardEligibleCards(eligibleSets, allCards, {
          floor: selectedFloor,
          setName: selectedSet,
          query: searchQuery,
        });
        const maxRender = selectedSet !== 'all' ? 120 : 48;
        const visible = matches.slice(0, maxRender);
        const summaryText =
          matches.length > visible.length
            ? `พบ ${matches.length} ใบ (แสดง ${visible.length} ใบแรก — พิมพ์ค้นหาหรือเลือกซองเพื่อดูเจาะจง)`
            : `พบ ${matches.length} ใบ (จากทั้งหมด ${totalPoolCount} ใบในระบบ — รวมซองเสริม/Deck/Promo)`;

        const cardsHtml = !visible.length
          ? `<p class="muted">ไม่พบการ์ดที่ค้นหา</p>`
          : visible
              .map((c) => {
                const owned = PackSim.getCardOwnedCount(c, ownedByName, season.collection);
                const isMaxed = owned >= 3;
                const badgeText = isMaxed ? `ครบ 3/3 ใบแล้ว` : owned > 0 ? `มีในคลัง x${owned}` : `ยังไม่มี (0/3)`;
                return `
                  <div class="ygo-card-tile">
                    <img src="${App.escapeHtml(c.image_url || '')}" alt="${App.escapeHtml(c.name)}" loading="lazy" />
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:4px; flex-wrap:wrap;">
                      <span class="badge">${App.escapeHtml(badgeText)}</span>
                    </div>
                    <strong>${App.escapeHtml(c.name)}</strong>
                    <button class="btn btn-sm btn-gold" data-pick-card-id="${c.id}" ${isMaxed ? 'disabled' : ''}>
                      ${isMaxed ? 'ครบ 3 ใบแล้ว' : 'เลือกใบนี้'}
                    </button>
                  </div>
                `;
              })
              .join('');

        return { summaryText, cardsHtml };
      };

      const initialPackOptions = renderPackOptions();
      const initialView = renderCardChoices();

      App.openModal(`
        <h3 class="card-title">🌟 รางวัลครบ ${ev.threshold || eventCfg.pickCardThreshold} EvP: เลือกการ์ดที่ต้องการ 1 ใบ</h3>
        <p class="muted" id="eventPickSummary">เลือกการ์ดจากซองใด ชั้นใดก็ได้ หรือการ์ดนอกซองหอคอย (ไม่จำเป็นต้องปลดล็อค) • ${App.escapeHtml(initialView.summaryText)}</p>
        <div class="form-row" style="gap:8px; margin-bottom:10px;">
          <select id="eventCardFloorFilter" style="flex:1; min-width:150px;">${renderFloorOptions()}</select>
          <select id="eventCardPackFilter" style="flex:2; min-width:200px;">${initialPackOptions}</select>
        </div>
        <input type="text" id="eventCardSearch" placeholder="พิมพ์ชื่อการ์ด..." style="width:100%; margin-bottom:10px;" />
        <div id="eventCardGrid" class="cards-grid" style="max-height:380px; overflow-y:auto;">${initialView.cardsHtml}</div>
      `);

      const gridEl = document.getElementById('eventCardGrid');
      const summaryEl = document.getElementById('eventPickSummary');
      const floorSelect = document.getElementById('eventCardFloorFilter');
      const packSelect = document.getElementById('eventCardPackFilter');
      const searchInput = document.getElementById('eventCardSearch');

      const bindCardButtons = () => {
        gridEl.querySelectorAll('[data-pick-card-id]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const cardId = btn.dataset.pickCardId;
            const pickedCard = allCards.find((c) => String(c.id) === String(cardId));
            if (!pickedCard) return;
            if (PackSim.getCardOwnedCount(pickedCard, ownedByName, season.collection) >= 3) {
              App.showToast('การ์ดใบนี้มีในคลังครบ 3 ใบแล้ว');
              return;
            }
            season.collection = season.collection || {};
            season.collection[cardId] = (season.collection[cardId] || 0) + 1;
            season.pendingEvents.splice(eventIndex, 1);
            await DB.saveSeason(season);
            App.closeModal();

            const PackEffects = root.YgoTower.PackEffects;
            if (PackEffects && typeof PackEffects.showCardPick === 'function') {
              PackEffects.showCardPick({
                card: pickedCard,
                threshold: ev.threshold || eventCfg.pickCardThreshold,
                onDone: () => {
                  App.showToast('เพิ่มการ์ดรางวัลเข้าคลังเรียบร้อย!');
                  App.renderCurrentView();
                },
              });
            } else {
              App.showToast('เพิ่มการ์ดรางวัลเข้าคลังเรียบร้อย!');
              App.renderCurrentView();
            }
          });
        });
      };

      const refreshPickGrid = () => {
        const nextView = renderCardChoices();
        if (summaryEl) {
          summaryEl.textContent = `เลือกการ์ดจากซองใด ชั้นใดก็ได้ หรือการ์ดนอกซองหอคอย (ไม่จำเป็นต้องปลดล็อค) • ${nextView.summaryText}`;
        }
        gridEl.innerHTML = nextView.cardsHtml;
        bindCardButtons();
      };

      bindCardButtons();

      floorSelect.addEventListener('change', (e) => {
        selectedFloor = e.target.value;
        selectedSet = 'all';
        packSelect.innerHTML = renderPackOptions();
        packSelect.value = selectedSet;
        refreshPickGrid();
      });

      packSelect.addEventListener('change', (e) => {
        selectedSet = e.target.value;
        refreshPickGrid();
      });

      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        refreshPickGrid();
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

    const eventCfg = Constants.getEventConfig(settings);
    const pendingEventsHtml = (season.pendingEvents || []).length
      ? `
        <div class="card" style="border-color:var(--gold);">
          <h3 class="card-title">🎁 รางวัล Event ที่รอรับ</h3>
          <div class="form-row" style="margin:0;">
            ${season.pendingEvents
              .map(
                (ev, idx) => `
              <button class="btn btn-gold" data-claim-event="${idx}">
                ${
                  ev.type === 'free_pack'
                    ? `เปิดซองฟรี (ครบ ${ev.threshold || eventCfg.packThreshold} EvP • ชั้น ${ev.floor})`
                    : `เลือกการ์ดฟรี 1 ใบ (ครบ ${ev.threshold || eventCfg.pickCardThreshold} EvP • ทุกชั้น/ทุกซอง)`
                }
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
    const floorMeta = Constants.FLOORS.find((f) => f.floor === selectedShopFloor);
    const floorSets = allSets
      .filter((s) => Number(s.assignedFloor) === selectedShopFloor)
      .sort((a, b) => (a.tcg_date || '').localeCompare(b.tcg_date || ''));

    const setsHtml = floorSets.length
      ? floorSets
          .map(
            (s) => `
          <div class="opponent-card pack-card">
            <img
              class="pack-thumb"
              src="${App.escapeHtml(Constants.getPackImageUrl(s))}"
              alt="${App.escapeHtml(s.set_name)}"
              loading="lazy"
            />
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="badge">${(s.templateType || 'tcg').toUpperCase()}</span>
              <span class="muted">${App.escapeHtml(s.tcg_date || '-')}</span>
            </div>
            <strong>${App.escapeHtml(s.set_name)}</strong>
            <div class="muted">รหัส: ${App.escapeHtml(s.set_code)} • ราคา ${eco.packPrice} DP</div>
            <div class="pack-actions">
              <button
                class="btn btn-sm"
                data-view-pack="${App.escapeHtml(s.set_name)}"
              >
                🔍 ดูการ์ด
              </button>
              <button
                class="btn btn-sm btn-gold"
                data-buy-pack="${App.escapeHtml(s.set_name)}"
                ${isUnlocked && season.dp >= eco.packPrice ? '' : 'disabled'}
              >
                ${isUnlocked ? `ซื้อ (${eco.packPrice} DP)` : '🔒 ล็อก'}
              </button>
            </div>
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
          ชั้น ${selectedShopFloor}${floorMeta ? ` (${App.escapeHtml(floorMeta.era)})` : ''}:
          ${floorSets.length} ซอง • ราคาซองละ <strong>${eco.packPrice} DP</strong> •
          สถานะ: ${isUnlocked ? '<span style="color:var(--success)">ปลดล็อกแล้ว</span>' : '<span style="color:var(--danger)">ล็อกอยู่</span>'}
        </p>
        <div class="opponent-grid">${setsHtml}</div>
      </div>
    `;

    container.querySelectorAll('[data-claim-event]').forEach((btn) => {
      btn.addEventListener('click', () =>
        openEventModal(Number(btn.dataset.claimEvent), season, settings)
      );
    });

    container.querySelectorAll('[data-shop-floor]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedShopFloor = Number(btn.dataset.shopFloor);
        renderShopView(container, state);
      });
    });

    container.querySelectorAll('[data-view-pack]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const setMeta = floorSets.find((s) => s.set_name === btn.dataset.viewPack);
        if (!setMeta) return;
        showPackDetailsModal(setMeta, season);
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
        showPackResultModal(setName, pulled, setMeta);
      });
    });
  }

  root.YgoTower.Views.renderShopView = renderShopView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
