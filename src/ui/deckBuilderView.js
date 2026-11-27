(function (root) {
  root.YgoTower = root.YgoTower || {};
  root.YgoTower.Views = root.YgoTower.Views || {};

  let searchQuery = '';
  let collectionFilters = null;
  let collectionDisplayLimit = 60;

  function isExtraDeckCard(card) {
    const t = (card?.frameType || card?.type || '').toLowerCase();
    return t.includes('fusion') || t.includes('synchro') || t.includes('xyz') || t.includes('link');
  }

  function buildCardStatPills(card, App) {
    const pills = [];
    if (card.type) pills.push(`<span class="badge">${App.escapeHtml(card.type)}</span>`);
    if (card.attribute) pills.push(`<span class="badge">${App.escapeHtml(card.attribute)}</span>`);
    if (card.race) pills.push(`<span class="badge">${App.escapeHtml(card.race)}</span>`);
    if (card.level !== null && card.level !== undefined) {
      pills.push(`<span class="badge">LV/Rank ${card.level}</span>`);
    }
    if (card.linkval !== null && card.linkval !== undefined) {
      pills.push(`<span class="badge">Link-${card.linkval}</span>`);
    }
    if (card.scale !== null && card.scale !== undefined) {
      pills.push(`<span class="badge">Scale ${card.scale}</span>`);
    }
    if (card.atk !== null && card.atk !== undefined) {
      pills.push(`<span class="badge">ATK ${card.atk}</span>`);
    }
    if (card.def !== null && card.def !== undefined) {
      pills.push(`<span class="badge">DEF ${card.def}</span>`);
    }
    return pills;
  }

  function getCardZoneCounts(deck, id) {
    const countIn = (arr) => arr.reduce((acc, cur) => (cur === id ? acc + 1 : acc), 0);
    const main = countIn(deck.main);
    const extra = countIn(deck.extra);
    const side = countIn(deck.side);
    return { main, extra, side, total: main + extra + side };
  }

  const ZONE_LABELS = {
    main: 'Main Deck',
    extra: 'Extra Deck',
    side: 'Side Deck',
  };

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

    const addCardToDeck = async (id, mode) => {
      const card = cardMap.get(id);
      const owned = collection[String(id)] || 0;
      const used = getCardZoneCounts(deck, id).total;
      if (used >= Math.min(3, owned)) return false;

      const zone = mode === 'side' ? 'side' : isExtraDeckCard(card) ? 'extra' : 'main';
      deck[zone].push(id);
      await DB.saveSeason(season);
      await renderDeckBuilderView(container, state);
      return true;
    };

    const removeCardFromDeck = async (id, zone) => {
      const zoneArr = deck[zone];
      if (!Array.isArray(zoneArr)) return false;
      const idx = zoneArr.indexOf(id);
      if (idx === -1) return false;

      zoneArr.splice(idx, 1);
      await DB.saveSeason(season);
      await renderDeckBuilderView(container, state);
      return true;
    };

    const openDeckCardModal = async (id) => {
      const CardDetailPacks = root.YgoTower.CardDetailPacks;
      const Constants = root.YgoTower.Constants;
      const card = cardMap.get(id) || { id, name: `Card #${id}`, type: '', frameType: '', image_url: '' };
      const statPills = buildCardStatPills(card, App);
      const primaryZone = isExtraDeckCard(card) ? 'extra' : 'main';
      const primaryZoneLabel = ZONE_LABELS[primaryZone];
      const breakdown = CardDetailPacks
        ? await CardDetailPacks.loadCardPackBreakdown(card, {
            season,
            cardMap,
            Constants,
            PackSimulator: root.YgoTower.PackSimulator,
            DB,
            Api,
          })
        : null;
      const packsHtml =
        CardDetailPacks && breakdown
          ? CardDetailPacks.renderCardPacksSectionHtml(breakdown, App, Constants)
          : '';
      let modalBusy = false;

      const renderModal = () => {
        const owned = collection[String(id)] || 0;
        const maxAllowed = Math.min(3, owned);
        const counts = getCardZoneCounts(deck, id);
        const canAdd = counts.total < maxAllowed;

        const zoneBadges = [];
        if (primaryZone === 'extra') {
          zoneBadges.push(`<span class="badge">Extra: ${counts.extra}</span>`);
          if (counts.main > 0) zoneBadges.push(`<span class="badge">Main: ${counts.main}</span>`);
        } else {
          zoneBadges.push(`<span class="badge">Main: ${counts.main}</span>`);
          if (counts.extra > 0) zoneBadges.push(`<span class="badge">Extra: ${counts.extra}</span>`);
        }
        zoneBadges.push(`<span class="badge">Side: ${counts.side}</span>`);

        const removeButtons = ['main', 'extra', 'side']
          .filter((zone) => counts[zone] > 0)
          .map(
            (zone) =>
              `<button class="btn btn-sm btn-danger" data-modal-remove="${zone}">- เอาออกจาก ${ZONE_LABELS[zone]} (${counts[zone]})</button>`
          )
          .join('');

        App.openModal(`
          <div class="pack-detail-modal">
            <div class="form-row" style="justify-content:space-between; margin-bottom:12px;">
              <strong class="muted">รายละเอียดการ์ด</strong>
              <button class="btn btn-sm" id="closeDeckCardModalBtn">ปิด</button>
            </div>
            <div class="card-detail-layout">
              <img class="card-detail-img" src="${App.escapeHtml(card.image_url || '')}" alt="${App.escapeHtml(card.name)}" />
              <div>
                <h3 style="margin:0 0 6px;">${App.escapeHtml(card.name)}</h3>
                <div class="card-detail-meta">
                  <span class="badge">ID: ${card.id}</span>
                  <span class="badge">มีในคลัง: ${owned} ใบ</span>
                  <span class="badge">ใช้ใน Deck: ${counts.total}/${maxAllowed}</span>
                  ${zoneBadges.join('')}
                </div>
                ${statPills.length ? `<div class="card-detail-meta">${statPills.join('')}</div>` : ''}
                <div class="card-detail-desc">${App.escapeHtml(card.desc || 'ไม่มีคำอธิบาย')}</div>
                <div class="deck-card-modal-actions">
                  <button class="btn btn-sm btn-primary" data-modal-add="auto" ${canAdd ? '' : 'disabled'}>+ ${primaryZoneLabel}</button>
                  <button class="btn btn-sm" data-modal-add="side" ${canAdd ? '' : 'disabled'}>+ Side Deck</button>
                  ${removeButtons}
                </div>
                ${packsHtml}
              </div>
            </div>
          </div>
        `);

        document.getElementById('closeDeckCardModalBtn').addEventListener('click', () => App.closeModal());

        if (CardDetailPacks && breakdown) {
          CardDetailPacks.bindCardPacksSectionEvents(document.getElementById('modalContent') || document, breakdown, {
            App,
            Views: root.YgoTower.Views,
            season,
            onBackToCardDetail: () => openDeckCardModal(id),
          });
        }

        document.querySelectorAll('[data-modal-add]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (modalBusy) return;
            modalBusy = true;
            try {
              const changed = await addCardToDeck(id, btn.dataset.modalAdd);
              if (changed) renderModal();
            } finally {
              modalBusy = false;
            }
          });
        });

        document.querySelectorAll('[data-modal-remove]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (modalBusy) return;
            modalBusy = true;
            try {
              const changed = await removeCardFromDeck(id, btn.dataset.modalRemove);
              if (changed) renderModal();
            } finally {
              modalBusy = false;
            }
          });
        });
      };

      renderModal();
    };

    const CardFilter = root.YgoTower.CardFilter;
    if (CardFilter && !collectionFilters) {
      collectionFilters = CardFilter.createEmptyFilters();
    }

    const getFilteredCollectionItems = (filtersOverride = collectionFilters) => {
      const items = ownedIds.map((id) => ({
        id,
        card: cardMap.get(id),
        owned: collection[String(id)],
      }));
      if (CardFilter) {
        return CardFilter.filterCollectionItems(items, filtersOverride, searchQuery);
      }
      const q = searchQuery.toLowerCase();
      return items.filter(
        (item) => item.card.name.toLowerCase().includes(q) || String(item.id).includes(searchQuery)
      );
    };

    const buildCollectionHtml = () => {
      const matchedItems = getFilteredCollectionItems();
      const filteredOwned = matchedItems.slice(0, collectionDisplayLimit);
      const hasFilters = CardFilter ? CardFilter.countActiveFilters(collectionFilters) > 0 : false;

      const html = filteredOwned.length
        ? filteredOwned
            .map(({ id, card, owned }) => {
              const used = usedCounts.get(id) || 0;
              const maxAllowed = Math.min(3, owned);
              const canAdd = used < maxAllowed;
              return `
                <div class="ygo-card-tile clickable" data-inspect-card="${id}" title="คลิกเพื่อดูรายละเอียด ${App.escapeHtml(card.name)}">
                  <img src="${App.escapeHtml(card.image_url || '')}" alt="${App.escapeHtml(card.name)}" loading="lazy" />
                  <strong>${App.escapeHtml(card.name)}</strong>
                  <div class="muted">มี ${owned} ใบ • ใช้ ${used}/${maxAllowed}</div>
                  <div class="deck-tile-actions" data-no-inspect>
                    <button class="btn btn-sm btn-primary" data-add-card="auto:${id}" ${canAdd ? '' : 'disabled'}>+ Deck</button>
                    <button class="btn btn-sm" data-add-card="side:${id}" ${canAdd ? '' : 'disabled'}>+ Side</button>
                  </div>
                </div>
              `;
            })
            .join('')
        : hasFilters || searchQuery.trim()
          ? `<p class="muted">ไม่พบการ์ดที่ตรงกับตัวกรองหรือคำค้นหา</p>`
          : `<p class="muted">ไม่พบการ์ดในคลัง (เปิดซองหรือ Import Starter .ydk เพื่อเพิ่มการ์ดเข้าคลัง)</p>`;

      return {
        html,
        totalMatches: matchedItems.length,
        visibleCount: filteredOwned.length,
      };
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
            <div class="floor-item deck-card-row clickable" data-inspect-card="${id}">
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
      <div class="grid-2 grid-2--deck">
        <div>
          <div class="card">
            <h3 class="card-title" style="flex-wrap:wrap;">
              <span>📦 Deck ปัจจุบัน</span>
              <span style="display:flex; gap:6px; flex-wrap:wrap;">
                <label class="btn btn-sm" style="cursor:pointer;">
                  📤 Import .ydk
                  <input type="file" id="importPlayerYdkInput" accept=".ydk" style="display:none;" />
                </label>
                <button class="btn btn-sm btn-gold" id="exportPlayerYdkBtn">📥 Export .ydk</button>
                <button class="btn btn-sm" id="importPlayerYdkeBtn">📤 Import YDKE</button>
                <button class="btn btn-sm btn-gold" id="exportPlayerYdkeBtn">📥 Export YDKE</button>
                <button class="btn btn-sm" id="importPlayerPlaintextBtn">📤 Import Plaintext</button>
                <button class="btn btn-sm btn-gold" id="exportPlayerPlaintextBtn">📥 Export Plaintext</button>
              </span>
            </h3>
            ${
              validation.errors.length
                ? `<div class="alert-box danger" style="font-size:0.82rem;">${validation.errors.map((e) => `<div>• ${App.escapeHtml(e)}</div>`).join('')}</div>`
                : `<div class="alert-box" style="border-color:var(--success); background:rgba(52,211,153,0.1); font-size:0.82rem;">✅ Deck ถูกต้องตามกติกา พร้อม Export ไป MDPro4</div>`
            }
            <div class="deck-zones-scroll">
              ${renderDeckZone('Main Deck (40–60)', 'main', deck.main)}
              ${renderDeckZone('Extra Deck (≤15)', 'extra', deck.extra)}
              ${renderDeckZone('Side Deck (≤15)', 'side', deck.side)}
            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <h3 class="card-title">
              <span>📚 คลังการ์ดของคุณ (${ownedIds.length} แบบ)</span>
              <button class="btn btn-sm btn-gold" id="exportTrunkBtn" ${ownedIds.length ? '' : 'disabled'}>📥 Export Trunk (.conf)</button>
            </h3>
            <div class="deck-filter-toolbar">
              <input type="text" id="deckCardSearch" value="${App.escapeHtml(searchQuery)}" placeholder="ค้นหาชื่อการ์ดหรือรหัสการ์ดในคลัง..." style="flex:1; min-width:0;" />
              ${
                CardFilter
                  ? `<button type="button" class="btn btn-sm" id="openDeckFilterBtn">🎛️ ตัวกรอง</button>`
                  : ''
              }
            </div>
            <div id="deckFilterSummary" class="deck-filter-summary"></div>
            <div class="cards-grid deck-collection-scroll" id="deckCollectionGrid"></div>
            <div id="deckCollectionMoreWrap" class="deck-collection-more"></div>
          </div>
        </div>
      </div>
    `;

    const collectionGrid = document.getElementById('deckCollectionGrid');
    const filterBtn = document.getElementById('openDeckFilterBtn');
    const filterSummaryEl = document.getElementById('deckFilterSummary');
    const collectionMoreWrap = document.getElementById('deckCollectionMoreWrap');

    const renderCollectionGrid = () => {
      const result = buildCollectionHtml();
      collectionGrid.innerHTML = result.html;

      const activeCount = CardFilter ? CardFilter.countActiveFilters(collectionFilters) : 0;
      if (filterBtn) {
        filterBtn.innerHTML = activeCount > 0 ? `🎛️ ตัวกรอง (${activeCount})` : '🎛️ ตัวกรอง';
        if (activeCount > 0) {
          filterBtn.classList.add('btn-primary');
        } else {
          filterBtn.classList.remove('btn-primary');
        }
      }

      if (filterSummaryEl) {
        const chips = CardFilter ? CardFilter.getActiveFilterChips(collectionFilters) : [];
        if (activeCount > 0 || searchQuery.trim() || result.totalMatches > result.visibleCount) {
          const countText =
            result.totalMatches > result.visibleCount
              ? `พบ ${result.totalMatches} ใบ (แสดง ${result.visibleCount} ใบแรก)`
              : `พบ ${result.totalMatches} ใบ`;
          const chipsHtml = chips.map((c) => `<span class="badge">${App.escapeHtml(c)}</span>`).join('');
          const clearBtnHtml =
            activeCount > 0
              ? `<button type="button" class="btn btn-sm" id="clearDeckFilterBtn">ล้างตัวกรอง</button>`
              : '';
          filterSummaryEl.innerHTML = `<span class="muted">${countText}</span>${chipsHtml}${clearBtnHtml}`;
          const clearBtn = document.getElementById('clearDeckFilterBtn');
          if (clearBtn) {
            clearBtn.addEventListener('click', () => {
              collectionFilters = CardFilter.createEmptyFilters();
              collectionDisplayLimit = 60;
              renderCollectionGrid();
            });
          }
        } else {
          filterSummaryEl.innerHTML = '';
        }
      }

      if (collectionMoreWrap) {
        if (result.totalMatches > result.visibleCount) {
          const remaining = result.totalMatches - result.visibleCount;
          collectionMoreWrap.innerHTML = `<button type="button" class="btn btn-sm" id="loadMoreCollectionBtn">แสดงเพิ่มเติม (+60 • เหลืออีก ${remaining} ใบ)</button>`;
          const moreBtn = document.getElementById('loadMoreCollectionBtn');
          if (moreBtn) {
            moreBtn.addEventListener('click', () => {
              collectionDisplayLimit += 60;
              renderCollectionGrid();
            });
          }
        } else {
          collectionMoreWrap.innerHTML = '';
        }
      }

      collectionGrid.querySelectorAll('[data-add-card]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const [mode, idStr] = btn.dataset.addCard.split(':');
          await addCardToDeck(Number(idStr), mode);
        });
      });

      collectionGrid.querySelectorAll('[data-inspect-card]').forEach((tile) => {
        tile.addEventListener('click', async (e) => {
          if (e.target.closest('button, [data-no-inspect]')) return;
          await openDeckCardModal(Number(tile.dataset.inspectCard));
        });
      });
    };

    const openDeckFilterModal = () => {
      if (!CardFilter) return;
      let draft = CardFilter.cloneFilters(collectionFilters);
      let modalOpen = true;

      const statRowsHtml = CardFilter.STAT_FIELDS.map((field) => {
        const range = draft.stats[field.key] || { min: '', max: '' };
        return `
          <div class="filter-stat-row">
            <div class="filter-stat-label">${App.escapeHtml(field.label)}</div>
            <input type="number" min="0" inputmode="numeric" class="filter-stat-input" data-filter-stat="${field.key}:min" value="${App.escapeHtml(range.min)}" placeholder="Min" />
            <input type="number" min="0" inputmode="numeric" class="filter-stat-input" data-filter-stat="${field.key}:max" value="${App.escapeHtml(range.max)}" placeholder="Max" />
          </div>
        `;
      }).join('');

      const framesHtml = CardFilter.CARD_FRAMES.map((frame) => {
        const isActive = draft.frames.includes(frame.key);
        return `<button type="button" class="filter-frame-btn${isActive ? ' active' : ''}" data-filter-frame="${frame.key}">${App.escapeHtml(frame.label)}</button>`;
      }).join('');

      const initialMatchCount = getFilteredCollectionItems(draft).length;

      App.openModal(`
        <div class="card-filter-modal">
          <div class="form-row" style="justify-content:space-between; margin-bottom:0;">
            <h3 style="margin:0;">🎛️ ตัวกรองการ์ดในคลัง</h3>
            <button type="button" class="btn btn-sm" id="closeDeckFilterModalBtn">ปิด</button>
          </div>
          <div class="card-filter-section">
            <div class="card-filter-section-title">⭐ Stats</div>
            <div class="filter-stats-rows">${statRowsHtml}</div>
          </div>
          <div class="card-filter-section">
            <div class="card-filter-section-title">🃏 Card Frame</div>
            <div class="filter-frames-grid">${framesHtml}</div>
          </div>
          <div class="card-filter-footer">
            <span class="muted" id="deckFilterPreviewCount">ตรงเงื่อนไข <strong>${initialMatchCount}</strong> ใบ</span>
            <div class="form-row" style="margin:0; gap:8px;">
              <button type="button" class="btn btn-sm" id="resetDeckFilterModalBtn">ล้างค่า</button>
              <button type="button" class="btn btn-sm" id="cancelDeckFilterModalBtn">ยกเลิก</button>
              <button type="button" class="btn btn-sm btn-primary" id="applyDeckFilterModalBtn">ตกลง</button>
            </div>
          </div>
        </div>
      `);

      const previewEl = document.getElementById('deckFilterPreviewCount');
      const updatePreviewCount = () => {
        if (!previewEl) return;
        const count = getFilteredCollectionItems(draft).length;
        previewEl.innerHTML = `ตรงเงื่อนไข <strong>${count}</strong> ใบ`;
      };

      const closeFilterModal = () => {
        modalOpen = false;
        App.closeModal();
      };

      document.getElementById('closeDeckFilterModalBtn').addEventListener('click', closeFilterModal);
      document.getElementById('cancelDeckFilterModalBtn').addEventListener('click', closeFilterModal);

      document.querySelectorAll('[data-filter-stat]').forEach((input) => {
        input.addEventListener('input', (e) => {
          const [statKey, bound] = input.dataset.filterStat.split(':');
          draft.stats[statKey][bound] = e.target.value;
          updatePreviewCount();
        });
      });

      document.querySelectorAll('[data-filter-frame]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.filterFrame;
          const idx = draft.frames.indexOf(key);
          if (idx === -1) {
            draft.frames.push(key);
            btn.classList.add('active');
          } else {
            draft.frames.splice(idx, 1);
            btn.classList.remove('active');
          }
          updatePreviewCount();
        });
      });

      document.getElementById('resetDeckFilterModalBtn').addEventListener('click', () => {
        draft = CardFilter.createEmptyFilters();
        document.querySelectorAll('[data-filter-stat]').forEach((input) => {
          input.value = '';
        });
        document.querySelectorAll('[data-filter-frame]').forEach((btn) => {
          btn.classList.remove('active');
        });
        updatePreviewCount();
      });

      document.getElementById('applyDeckFilterModalBtn').addEventListener('click', () => {
        collectionFilters = CardFilter.cloneFilters(draft);
        collectionDisplayLimit = 60;
        closeFilterModal();
        renderCollectionGrid();
      });

      // Lazily backfill linkval / scale for any older cached Link/Pendulum cards in collection
      if (Api && typeof Api.backfillMissingCardStats === 'function') {
        Api.backfillMissingCardStats(ownedIds.map((id) => cardMap.get(id)).filter(Boolean))
          .then((updatedMap) => {
            if (!updatedMap || !updatedMap.size) return;
            for (const [id, enriched] of updatedMap.entries()) {
              cardMap.set(id, enriched);
            }
            if (modalOpen) {
              updatePreviewCount();
            } else {
              renderCollectionGrid();
            }
          })
          .catch(() => {});
      }
    };

    renderCollectionGrid();

    if (filterBtn) {
      filterBtn.addEventListener('click', () => {
        openDeckFilterModal();
      });
    }

    document.getElementById('deckCardSearch').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      collectionDisplayLimit = 60;
      renderCollectionGrid();
    });

    const applyImportedDeck = async (
      importedDeck,
      { emptyMessage, confirmMessage, successMessage, onValidationError, beforeRender }
    ) => {
      const importedIds = [...new Set([...importedDeck.main, ...importedDeck.extra, ...importedDeck.side])];
      const importedCardMap = await Api.getCardsByIds(importedIds);

      const check = Ydk.validateDeckCollection(importedDeck, collection, importedCardMap, { emptyMessage });
      if (!check.valid) {
        onValidationError(check.errors);
        return false;
      }

      const currentCount = deck.main.length + deck.extra.length + deck.side.length;
      if (currentCount > 0 && typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(confirmMessage)) {
        return false;
      }

      season.playerDeck = importedDeck;
      await DB.saveSeason(season);
      if (typeof beforeRender === 'function') {
        beforeRender();
      }
      App.showToast(successMessage);
      await renderDeckBuilderView(container, state);
      return true;
    };

    const copyTextToClipboard = async (text) => {
      const nav = root.navigator || (typeof navigator !== 'undefined' ? navigator : null);
      if (!nav || !nav.clipboard || typeof nav.clipboard.writeText !== 'function') {
        return false;
      }
      try {
        await nav.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    };

    document.getElementById('exportPlayerYdkBtn').addEventListener('click', () => {
      const ydkText = Ydk.generateYdk(deck);
      const safeName = season.name.replace(/[^a-z0-9ก-๙_-]/gi, '_');
      root.YgoTower.SaveManager.downloadFile(`${safeName}_deck.ydk`, ydkText, 'text/plain');
    });

    document.getElementById('importPlayerYdkInput').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;

      const text = await file.text();
      const importedDeck = Ydk.parseYdk(text);

      await applyImportedDeck(importedDeck, {
        emptyMessage: 'ไม่พบการ์ดในไฟล์ .ydk นี้',
        confirmMessage: 'Deck ปัจจุบันมีการ์ดอยู่แล้ว ต้องการนำเข้าไฟล์ .ydk เพื่อแทนที่หรือไม่?',
        successMessage: `Import .ydk สำเร็จ (Main ${importedDeck.main.length}, Extra ${importedDeck.extra.length}, Side ${importedDeck.side.length})`,
        onValidationError: (errors) => {
          App.showToast('ไม่สามารถ Import .ydk ได้');
          App.openModal(`
            <h3 class="card-title">❌ ไม่สามารถ Import ไฟล์ .ydk ได้</h3>
            <p class="muted" style="margin-top:0;">พบการ์ดที่ไม่ผ่านเงื่อนไขคลังการ์ด จึงยังคง Deck เดิมไว้:</p>
            <div class="alert-box danger" style="max-height:280px; overflow-y:auto; font-size:0.86rem;">
              ${errors.map((err) => `<div>• ${App.escapeHtml(err)}</div>`).join('')}
            </div>
            <div class="form-row" style="justify-content:flex-end; margin-top:12px;">
              <button class="btn btn-primary" id="closeImportErrorModalBtn">ปิด</button>
            </div>
          `);
          document.getElementById('closeImportErrorModalBtn').addEventListener('click', () => App.closeModal());
        },
      });
    });

    const exportTextWithFallback = async ({
      text,
      copiedToast,
      modalTitle,
      modalDescription,
      textareaId,
      textareaRows,
      copyBtnId,
      closeBtnId,
      fallbackCopiedToast,
    }) => {
      const copied = await copyTextToClipboard(text);
      if (copied) {
        App.showToast(copiedToast);
        return;
      }

      App.openModal(`
        <h3 class="card-title">${modalTitle}</h3>
        <p class="muted" style="margin-top:0;">${modalDescription}</p>
        <textarea id="${textareaId}" readonly rows="${textareaRows}" style="width:100%; box-sizing:border-box; font-family:monospace; font-size:0.85rem;">${App.escapeHtml(text)}</textarea>
        <div class="form-row" style="justify-content:flex-end; gap:8px; margin-top:12px;">
          <button type="button" class="btn" id="${copyBtnId}">📋 คัดลอก</button>
          <button type="button" class="btn btn-primary" id="${closeBtnId}">ปิด</button>
        </div>
      `);

      const textarea = document.getElementById(textareaId);
      if (textarea) {
        textarea.focus?.();
        textarea.select?.();
      }
      document.getElementById(copyBtnId).addEventListener('click', async () => {
        if (textarea) {
          textarea.focus?.();
          textarea.select?.();
        }
        const ok = await copyTextToClipboard(text);
        if (ok) {
          App.showToast(fallbackCopiedToast);
        } else {
          App.showToast('กรุณากด Ctrl+C / Cmd+C เพื่อคัดลอกด้วยตนเอง');
        }
      });
      document.getElementById(closeBtnId).addEventListener('click', () => App.closeModal());
    };

    const openTextImportModal = ({
      title,
      descriptionHtml,
      textareaId,
      textareaRows,
      placeholder,
      errorBoxId,
      cancelBtnId,
      confirmBtnId,
      failToast,
      emptyMessage,
      confirmMessage,
      getSuccessMessage,
      resolveDeck,
    }) => {
      App.openModal(`
        <h3 class="card-title">${title}</h3>
        <p class="muted" style="margin-top:0;">${descriptionHtml}</p>
        <textarea id="${textareaId}" rows="${textareaRows}" placeholder="${App.escapeHtml(placeholder)}" style="width:100%; box-sizing:border-box; font-family:monospace; font-size:0.85rem;"></textarea>
        <div id="${errorBoxId}"></div>
        <div class="form-row" style="justify-content:flex-end; gap:8px; margin-top:12px;">
          <button type="button" class="btn" id="${cancelBtnId}">ยกเลิก</button>
          <button type="button" class="btn btn-primary" id="${confirmBtnId}">นำเข้า Deck</button>
        </div>
      `);

      const textarea = document.getElementById(textareaId);
      const errorBox = document.getElementById(errorBoxId);
      let importBusy = false;

      if (textarea) {
        textarea.focus?.();
      }

      const showErrorList = (errors) => {
        if (!errorBox) return;
        errorBox.innerHTML = `
          <div class="alert-box danger" style="max-height:200px; overflow-y:auto; font-size:0.85rem; margin-top:10px;">
            ${errors.map((err) => `<div>• ${App.escapeHtml(err)}</div>`).join('')}
          </div>
        `;
      };

      document.getElementById(cancelBtnId).addEventListener('click', () => App.closeModal());
      document.getElementById(confirmBtnId).addEventListener('click', async () => {
        if (importBusy) return;
        importBusy = true;
        if (errorBox) errorBox.innerHTML = '';

        try {
          const result = await resolveDeck(textarea ? textarea.value : '');
          if (result.errors && result.errors.length) {
            App.showToast(failToast);
            showErrorList(result.errors);
            return;
          }

          const importedDeck = result.deck;
          await applyImportedDeck(importedDeck, {
            emptyMessage,
            confirmMessage,
            successMessage: getSuccessMessage(importedDeck),
            beforeRender: () => App.closeModal(),
            onValidationError: (errors) => {
              App.showToast(failToast);
              showErrorList(errors);
            },
          });
        } finally {
          importBusy = false;
        }
      });
    };

    document.getElementById('exportPlayerYdkeBtn').addEventListener('click', async () => {
      let ydkeUri;
      try {
        ydkeUri = Ydk.generateYdke(deck);
      } catch (err) {
        App.showToast(err && err.message ? err.message : 'ไม่สามารถสร้างลิงก์ YDKE ได้');
        return;
      }

      await exportTextWithFallback({
        text: ydkeUri,
        copiedToast: `คัดลอกลิงก์ YDKE สำเร็จ (Main ${deck.main.length}, Extra ${deck.extra.length}, Side ${deck.side.length})`,
        modalTitle: '📥 Export ลิงก์ YDKE',
        modalDescription: 'ไม่สามารถคัดลอกลง Clipboard อัตโนมัติได้ กรุณาคัดลอกลิงก์ด้านล่าง:',
        textareaId: 'exportYdkeTextarea',
        textareaRows: 4,
        copyBtnId: 'copyExportYdkeFallbackBtn',
        closeBtnId: 'closeExportYdkeModalBtn',
        fallbackCopiedToast: 'คัดลอกลิงก์ YDKE สำเร็จ',
      });
    });

    document.getElementById('importPlayerYdkeBtn').addEventListener('click', () => {
      openTextImportModal({
        title: '📤 Import Deck จากลิงก์ YDKE',
        descriptionHtml: 'วางลิงก์รูปแบบ <code>ydke://...</code> เพื่อนำเข้า Deck (ตรวจการ์ดในคลังและจำกัดชื่อละไม่เกิน 3 ใบ)',
        textareaId: 'importYdkeTextarea',
        textareaRows: 4,
        placeholder: 'ydke://...',
        errorBoxId: 'importYdkeErrorBox',
        cancelBtnId: 'cancelImportYdkeBtn',
        confirmBtnId: 'confirmImportYdkeBtn',
        failToast: 'ไม่สามารถ Import YDKE ได้',
        emptyMessage: 'ไม่พบการ์ดในลิงก์ YDKE นี้',
        confirmMessage: 'Deck ปัจจุบันมีการ์ดอยู่แล้ว ต้องการนำเข้า YDKE เพื่อแทนที่หรือไม่?',
        getSuccessMessage: (importedDeck) =>
          `Import YDKE สำเร็จ (Main ${importedDeck.main.length}, Extra ${importedDeck.extra.length}, Side ${importedDeck.side.length})`,
        resolveDeck: async (rawValue) => {
          try {
            return { deck: Ydk.parseYdke(rawValue), errors: [] };
          } catch (err) {
            return { deck: null, errors: [err && err.message ? err.message : 'รูปแบบลิงก์ YDKE ไม่ถูกต้อง'] };
          }
        },
      });
    });

    document.getElementById('exportPlayerPlaintextBtn').addEventListener('click', async () => {
      const plaintext = Ydk.generatePlaintextDeck(deck, cardMap);
      await exportTextWithFallback({
        text: plaintext,
        copiedToast: `คัดลอก Deck Plaintext สำเร็จ (Main ${deck.main.length}, Extra ${deck.extra.length}, Side ${deck.side.length})`,
        modalTitle: '📥 Export Deck Plaintext',
        modalDescription: 'ไม่สามารถคัดลอกลง Clipboard อัตโนมัติได้ กรุณาคัดลอกรายชื่อการ์ดด้านล่าง:',
        textareaId: 'exportPlaintextTextarea',
        textareaRows: 10,
        copyBtnId: 'copyExportPlaintextFallbackBtn',
        closeBtnId: 'closeExportPlaintextModalBtn',
        fallbackCopiedToast: 'คัดลอก Deck Plaintext สำเร็จ',
      });
    });

    document.getElementById('importPlayerPlaintextBtn').addEventListener('click', () => {
      openTextImportModal({
        title: '📤 Import Deck จาก Plaintext',
        descriptionHtml:
          'วางรายชื่อการ์ดรูปแบบ <code>จำนวน ชื่อการ์ด</code> แยกตามโซน <code>Main Deck:</code>, <code>Extra Deck:</code>, <code>Side Deck:</code>',
        textareaId: 'importPlaintextTextarea',
        textareaRows: 10,
        placeholder: 'Main Deck:\n2 Dark Magician\n\nExtra Deck:\n1 Road Warrior\n\nSide Deck:\n3 Nitro Warrior',
        errorBoxId: 'importPlaintextErrorBox',
        cancelBtnId: 'cancelImportPlaintextBtn',
        confirmBtnId: 'confirmImportPlaintextBtn',
        failToast: 'ไม่สามารถ Import Plaintext ได้',
        emptyMessage: 'ไม่พบการ์ดในข้อความนี้',
        confirmMessage: 'Deck ปัจจุบันมีการ์ดอยู่แล้ว ต้องการนำเข้า Plaintext เพื่อแทนที่หรือไม่?',
        getSuccessMessage: (importedDeck) =>
          `Import Plaintext สำเร็จ (Main ${importedDeck.main.length}, Extra ${importedDeck.extra.length}, Side ${importedDeck.side.length})`,
        resolveDeck: async (rawValue) => {
          let parsed;
          try {
            parsed = Ydk.parsePlaintextDeck(rawValue);
          } catch (err) {
            return { deck: null, errors: [err && err.message ? err.message : 'รูปแบบ Plaintext ไม่ถูกต้อง'] };
          }

          if (parsed.main.length + parsed.extra.length + parsed.side.length === 0) {
            return { deck: null, errors: ['ไม่พบการ์ดในข้อความนี้'] };
          }

          const cardsByName = new Map();
          const ownedCards = [];
          for (const id of ownedIds) {
            const c = cardMap.get(id);
            if (c && c.name) {
              ownedCards.push(c);
              const key = String(c.name).trim().replace(/\s+/g, ' ').toLowerCase();
              if (!cardsByName.has(key)) cardsByName.set(key, c);
            }
          }

          const requestedNames = [...parsed.main, ...parsed.extra, ...parsed.side].map((e) => e.name);
          const uncachedNames = requestedNames.filter(
            (name) => !cardsByName.has(String(name).trim().replace(/\s+/g, ' ').toLowerCase())
          );

          if (uncachedNames.length > 0 && Api && typeof Api.getCardsByNames === 'function') {
            const fetchedByName = await Api.getCardsByNames(uncachedNames);
            if (fetchedByName) {
              for (const [key, card] of fetchedByName.entries()) {
                cardsByName.set(key, card);
              }
            }
          }

          const resolved = Ydk.resolvePlaintextDeck(parsed, { cardsByName, ownedCards, collection });
          if (resolved.missingNames.length > 0) {
            return {
              deck: null,
              errors: resolved.missingNames.map((name) => `ไม่พบการ์ดชื่อ "${name}" ในฐานข้อมูล`),
            };
          }

          return { deck: resolved.deck, errors: [] };
        },
      });
    });

    document.getElementById('exportTrunkBtn').addEventListener('click', () => {
      const trunkText = Ydk.generateTrunk(collection);
      root.YgoTower.SaveManager.downloadFile('edison.lflist.conf', trunkText, 'text/plain;charset=utf-8');
      App.showToast(`Export edison.lflist.conf สำเร็จ (${ownedIds.length} แบบ)`);
    });

    container.querySelectorAll('[data-remove-card]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const [zone, idStr] = btn.dataset.removeCard.split(':');
        await removeCardFromDeck(Number(idStr), zone);
      });
    });

    container.querySelectorAll('.deck-card-row[data-inspect-card]').forEach((row) => {
      row.addEventListener('click', async (e) => {
        if (e.target.closest('button')) return;
        await openDeckCardModal(Number(row.dataset.inspectCard));
      });
    });
  }

  root.YgoTower.Views.renderDeckBuilderView = renderDeckBuilderView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
