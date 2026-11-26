(function (root, factory) {
  const exported = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  } else {
    root.YgoTower = root.YgoTower || {};
    root.YgoTower.CardDetailPacks = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  function normalizeName(Constants, name) {
    if (Constants && typeof Constants.normalizeSetName === 'function') {
      return Constants.normalizeSetName(name);
    }
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  function normalizeRarity(PackSim, setRarity) {
    if (PackSim && typeof PackSim.normalizeRarity === 'function') {
      return PackSim.normalizeRarity(setRarity);
    }
    const r = String(setRarity || '').toLowerCase();
    if (r.includes('secret') || r.includes('starlight') || r.includes('quarter century') || r.includes('prismatic')) {
      return 'secret';
    }
    if (r.includes('ultra') || r.includes('ultimate') || r.includes('ghost') || r.includes('gold')) {
      return 'ultra';
    }
    if (r.includes('super')) return 'super';
    if (r.includes('rare') && !r.includes('common')) return 'rare';
    return 'common';
  }

  function getPackImageUrl(Constants, setMeta) {
    if (Constants && typeof Constants.getPackImageUrl === 'function') {
      return Constants.getPackImageUrl(setMeta);
    }
    if (setMeta && setMeta.set_image) return setMeta.set_image;
    if (setMeta && setMeta.set_code) return `https://images.ygoprodeck.com/images/sets/${setMeta.set_code}.jpg`;
    return '';
  }

  function isFloorUnlocked(floor, season) {
    if (!season) return null;
    const f = Number(floor);
    if (f <= Number(season.currentFloor || 1)) return true;
    return Array.isArray(season.unlockedFloors) && season.unlockedFloors.includes(f);
  }

  /**
   * Build grouped and sorted Tower Packs + non-tower sets for a card.
   */
  function buildCardPackBreakdown(card, allSets = [], options = {}) {
    const Constants = options.Constants || (root.YgoTower && root.YgoTower.Constants) || null;
    const PackSim = options.PackSimulator || (root.YgoTower && root.YgoTower.PackSimulator) || null;
    const season = options.season || null;
    const canonicalCard = options.canonicalCard || null;

    const rawSets =
      Array.isArray(card && card.card_sets) && card.card_sets.length > 0
        ? card.card_sets
        : Array.isArray(canonicalCard && canonicalCard.card_sets)
          ? canonicalCard.card_sets
          : [];

    const effectiveSets =
      Array.isArray(allSets) && allSets.length > 0
        ? allSets
        : (Constants && Array.isArray(Constants.CURATED_PACKS)
            ? Constants.CURATED_PACKS.map((p) => ({
                set_code: p.set_code,
                set_name: p.set_name,
                tcg_date: p.tcg_date || '',
                set_image: getPackImageUrl(Constants, p),
                assignedFloor: p.floor,
                templateType: 'tcg',
              }))
            : []);

    const towerSetByExactName = new Map();
    const towerSetByNormName = new Map();
    for (const s of effectiveSets) {
      if (!s || !s.set_name) continue;
      towerSetByExactName.set(s.set_name, s);
      towerSetByNormName.set(normalizeName(Constants, s.set_name), s);
    }

    const towerGroupMap = new Map();
    const otherGroupMap = new Map();

    for (const cs of rawSets) {
      if (!cs || !cs.set_name) continue;
      const setMeta =
        towerSetByExactName.get(cs.set_name) ||
        towerSetByNormName.get(normalizeName(Constants, cs.set_name)) ||
        null;

      const rarityText = cs.set_rarity || 'Common';
      const bucket = normalizeRarity(PackSim, rarityText);
      const cardSetCode = cs.set_code || '';

      if (setMeta) {
        const key = setMeta.set_name;
        if (!towerGroupMap.has(key)) {
          const floor = Number(setMeta.assignedFloor ?? setMeta.floor ?? 1);
          towerGroupMap.set(key, {
            setMeta: {
              ...setMeta,
              assignedFloor: floor,
              set_image: setMeta.set_image || getPackImageUrl(Constants, setMeta),
            },
            floor,
            unlocked: isFloorUnlocked(floor, season),
            entries: [],
            _seenEntryKeys: new Set(),
          });
        }
        const group = towerGroupMap.get(key);
        const entryKey = `${rarityText}::${cardSetCode}`;
        if (!group._seenEntryKeys.has(entryKey)) {
          group._seenEntryKeys.add(entryKey);
          group.entries.push({
            set_rarity: rarityText,
            bucket,
            set_code: cardSetCode,
          });
        }
      } else {
        const key = cs.set_name;
        if (!otherGroupMap.has(key)) {
          otherGroupMap.set(key, {
            set_name: cs.set_name,
            entries: [],
            _seenEntryKeys: new Set(),
          });
        }
        const group = otherGroupMap.get(key);
        const entryKey = `${rarityText}::${cardSetCode}`;
        if (!group._seenEntryKeys.has(entryKey)) {
          group._seenEntryKeys.add(entryKey);
          group.entries.push({
            set_rarity: rarityText,
            bucket,
            set_code: cardSetCode,
          });
        }
      }
    }

    const towerPacks = Array.from(towerGroupMap.values())
      .map(({ _seenEntryKeys, ...rest }) => rest)
      .sort((a, b) => {
        if (a.floor !== b.floor) return a.floor - b.floor;
        const dateCmp = String(a.setMeta.tcg_date || '').localeCompare(String(b.setMeta.tcg_date || ''));
        if (dateCmp !== 0) return dateCmp;
        return String(a.setMeta.set_name || '').localeCompare(String(b.setMeta.set_name || ''));
      });

    const otherSets = Array.from(otherGroupMap.values())
      .map(({ _seenEntryKeys, ...rest }) => rest)
      .sort((a, b) => String(a.set_name || '').localeCompare(String(b.set_name || '')));

    return {
      hasAnySetData: rawSets.length > 0,
      towerPacks,
      otherSets,
    };
  }

  /**
   * Resolve cached sets and canonical card (for alternate-art cards) asynchronously.
   */
  async function loadCardPackBreakdown(card, options = {}) {
    const DB = options.DB || (root.YgoTower && root.YgoTower.DB) || null;
    const Api = options.Api || (root.YgoTower && root.YgoTower.Api) || null;
    const Constants = options.Constants || (root.YgoTower && root.YgoTower.Constants) || null;
    const cardMap = options.cardMap || null;

    let allSets = Array.isArray(options.allSets) ? options.allSets : [];
    if (!allSets.length && DB && typeof DB.getDB === 'function') {
      try {
        const db = DB.getDB();
        if (db && db.sets && typeof db.sets.toArray === 'function') {
          allSets = await db.sets.toArray();
        }
      } catch (err) {
        console.warn('Failed to load sets for card detail:', err);
      }
    }

    let canonicalCard = null;
    const hasOwnSets = Array.isArray(card && card.card_sets) && card.card_sets.length > 0;
    const canonicalId = card && card.canonicalId ? Number(card.canonicalId) : null;
    if (!hasOwnSets && canonicalId && canonicalId !== Number(card.id)) {
      if (cardMap && typeof cardMap.get === 'function' && cardMap.has(canonicalId)) {
        canonicalCard = cardMap.get(canonicalId);
      } else if (Api && typeof Api.getCardsByIds === 'function') {
        try {
          const fetched = await Api.getCardsByIds([canonicalId]);
          canonicalCard = fetched ? fetched.get(canonicalId) || null : null;
        } catch (err) {
          console.warn('Failed to load canonical card sets:', err);
        }
      }
    }

    return buildCardPackBreakdown(card, allSets, {
      Constants,
      PackSimulator: options.PackSimulator,
      season: options.season || null,
      canonicalCard,
    });
  }

  function renderCardPacksSectionHtml(breakdown, App, Constants) {
    if (!breakdown) return '';

    const { hasAnySetData, towerPacks, otherSets } = breakdown;

    const towerListHtml = towerPacks.length
      ? `<div class="card-pack-list">
          ${towerPacks
            .map((pack) => {
              const s = pack.setMeta;
              const thumbUrl = getPackImageUrl(Constants, s);
              const rarityBadges = pack.entries
                .map(
                  (e) =>
                    `<span class="badge badge-${App.escapeHtml(e.bucket)}">${App.escapeHtml(e.set_rarity)}${e.set_code ? ` (${App.escapeHtml(e.set_code)})` : ''}</span>`
                )
                .join('');

              const lockBadge =
                pack.unlocked === true
                  ? `<span class="badge badge-unlocked">ปลดล็อกแล้ว</span>`
                  : pack.unlocked === false
                    ? `<span class="badge badge-locked">🔒 ล็อกอยู่</span>`
                    : '';

              return `
                <div class="card-pack-row clickable" data-open-pack-detail="${App.escapeHtml(s.set_name)}" title="คลิกเพื่อดูรายการการ์ดในซอง ${App.escapeHtml(s.set_name)}">
                  <img class="pack-thumb-sm" src="${App.escapeHtml(thumbUrl)}" alt="${App.escapeHtml(s.set_name)}" loading="lazy" />
                  <div class="card-pack-info">
                    <div class="card-pack-title-row">
                      <strong>${App.escapeHtml(s.set_name)}</strong>
                      ${s.set_code ? `<span class="muted">(${App.escapeHtml(s.set_code)})</span>` : ''}
                    </div>
                    <div class="card-pack-badges">
                      <span class="badge">ชั้น ${pack.floor}</span>
                      ${lockBadge}
                      ${rarityBadges}
                    </div>
                  </div>
                  <div class="card-pack-actions" data-no-pack-open>
                    <button type="button" class="btn btn-sm" data-go-shop-floor="${pack.floor}">ไปร้านค้า</button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>`
      : hasAnySetData
        ? `<p class="muted card-pack-empty">ไม่อยู่ในซองหอคอย (หาได้จากรางวัลเลือกการ์ด 8 EvP)</p>`
        : `<p class="muted card-pack-empty">ไม่พบข้อมูลซองการ์ดในแคช</p>`;

    const otherHtml = otherSets.length
      ? `
        <details class="card-other-sets">
          <summary>ชุดอื่น ๆ นอกหอคอย (${otherSets.length} ชุด)</summary>
          <div class="card-other-sets-list">
            ${otherSets
              .map((os) => {
                const badges = os.entries
                  .map(
                    (e) =>
                      `<span class="badge badge-${App.escapeHtml(e.bucket)}">${App.escapeHtml(e.set_rarity)}${e.set_code ? ` (${App.escapeHtml(e.set_code)})` : ''}</span>`
                  )
                  .join('');
                return `
                  <div class="card-other-set-row">
                    <strong>${App.escapeHtml(os.set_name)}</strong>
                    <div class="card-pack-badges">${badges}</div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </details>
      `
      : '';

    return `
      <div class="card-detail-packs">
        <div class="card-detail-packs-header">
          <strong>📦 ซองที่มีการ์ดใบนี้</strong>
          <span class="muted">ในหอคอย ${towerPacks.length} ซอง</span>
        </div>
        ${towerListHtml}
        ${otherHtml}
      </div>
    `;
  }

  function bindCardPacksSectionEvents(rootEl, breakdown, options = {}) {
    if (!rootEl || !breakdown || !breakdown.towerPacks.length) return;
    const App = options.App || (root.YgoTower && root.YgoTower.App) || null;
    const Views = options.Views || (root.YgoTower && root.YgoTower.Views) || null;
    const season = options.season || null;
    const onBackToCardDetail = typeof options.onBackToCardDetail === 'function' ? options.onBackToCardDetail : null;

    const packByName = new Map(breakdown.towerPacks.map((p) => [p.setMeta.set_name, p.setMeta]));

    rootEl.querySelectorAll('[data-go-shop-floor]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const floor = Number(btn.dataset.goShopFloor);
        if (Views && typeof Views.setShopFloor === 'function') {
          Views.setShopFloor(floor);
        }
        if (App && typeof App.closeModal === 'function') {
          App.closeModal();
        }
        if (App && typeof App.switchTab === 'function') {
          App.switchTab('shop');
        }
      });
    });

    rootEl.querySelectorAll('[data-open-pack-detail]').forEach((row) => {
      row.addEventListener('click', async (e) => {
        if (e && e.target && typeof e.target.closest === 'function' && e.target.closest('[data-no-pack-open]')) {
          return;
        }
        const setMeta = packByName.get(row.dataset.openPackDetail);
        if (!setMeta) return;
        if (Views && typeof Views.openPackDetailsModal === 'function') {
          await Views.openPackDetailsModal(setMeta, season, onBackToCardDetail);
        }
      });
    });
  }

  return {
    buildCardPackBreakdown,
    loadCardPackBreakdown,
    renderCardPacksSectionHtml,
    bindCardPacksSectionEvents,
  };
});
