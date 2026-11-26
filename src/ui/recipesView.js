(function (root) {
  root.YgoTower = root.YgoTower || {};
  root.YgoTower.Views = root.YgoTower.Views || {};

  let selectedRecipeId = null;

  function stripYdkExt(filename) {
    return String(filename || 'Untitled').replace(/\.ydk$/i, '').trim() || 'Untitled';
  }

  async function copyTextToClipboard(text) {
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
  }

  function openYdkeInputModal({ title, description, showNameInput, defaultName, submitLabel, onSubmit }) {
    const App = root.YgoTower.App;

    const nameFieldHtml = showNameInput
      ? `
        <div style="margin-bottom:10px;">
          <label for="recipeYdkeNameInput" style="display:block; font-size:0.85rem; margin-bottom:4px;">ชื่อ Recipe (เว้นว่างจะตั้งเป็น ${App.escapeHtml(defaultName)})</label>
          <input type="text" id="recipeYdkeNameInput" maxlength="80" placeholder="${App.escapeHtml(defaultName)}" style="width:100%; box-sizing:border-box;" />
        </div>
      `
      : '';

    App.openModal(`
      <h3 class="card-title">${App.escapeHtml(title)}</h3>
      <p class="muted" style="margin-top:0;">${description}</p>
      ${nameFieldHtml}
      <textarea id="recipeYdkeTextarea" rows="4" placeholder="ydke://..." style="width:100%; box-sizing:border-box; font-family:monospace; font-size:0.85rem;"></textarea>
      <div id="recipeYdkeErrorBox"></div>
      <div class="form-row" style="justify-content:flex-end; gap:8px; margin-top:12px;">
        <button type="button" class="btn" id="cancelRecipeYdkeBtn">ยกเลิก</button>
        <button type="button" class="btn btn-primary" id="confirmRecipeYdkeBtn">${App.escapeHtml(submitLabel)}</button>
      </div>
    `);

    const nameInput = showNameInput ? document.getElementById('recipeYdkeNameInput') : null;
    const textarea = document.getElementById('recipeYdkeTextarea');
    const errorBox = document.getElementById('recipeYdkeErrorBox');
    let busy = false;

    if (nameInput) {
      nameInput.focus?.();
    } else if (textarea) {
      textarea.focus?.();
    }

    const showError = (msg) => {
      if (!errorBox) return;
      errorBox.innerHTML = `
        <div class="alert-box danger" style="max-height:200px; overflow-y:auto; font-size:0.85rem; margin-top:10px;">
          <div>• ${App.escapeHtml(msg)}</div>
        </div>
      `;
    };

    document.getElementById('cancelRecipeYdkeBtn').addEventListener('click', () => App.closeModal());
    document.getElementById('confirmRecipeYdkeBtn').addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      if (errorBox) errorBox.innerHTML = '';

      try {
        await onSubmit({
          rawUri: textarea ? textarea.value : '',
          rawName: nameInput ? nameInput.value : '',
          showError,
        });
      } finally {
        busy = false;
      }
    });
  }

  async function openRecipeCardModal(card, ownedCount, neededCount, options = {}) {
    const App = root.YgoTower.App;
    const CardDetailPacks = root.YgoTower.CardDetailPacks;
    const Constants = root.YgoTower.Constants;
    const season = options.season || null;
    const cardMap = options.cardMap || null;

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

    const statusBadge =
      ownedCount >= neededCount
        ? `<span class="badge" style="border-color:var(--success); color:var(--success);">ครบแล้ว (${ownedCount}/${neededCount})</span>`
        : `<span class="badge" style="border-color:var(--warning); color:var(--warning);">มีในคลัง ${ownedCount}/${neededCount} ใบ (ขาด ${neededCount - ownedCount})</span>`;

    const breakdown = CardDetailPacks
      ? await CardDetailPacks.loadCardPackBreakdown(card, {
          season,
          cardMap,
          Constants,
          PackSimulator: root.YgoTower.PackSimulator,
          DB: root.YgoTower.DB,
          Api: root.YgoTower.Api,
        })
      : null;
    const packsHtml =
      CardDetailPacks && breakdown
        ? CardDetailPacks.renderCardPacksSectionHtml(breakdown, App, Constants)
        : '';

    App.openModal(`
      <div class="pack-detail-modal">
        <div class="form-row" style="justify-content:space-between; margin-bottom:12px;">
          <strong class="muted">รายละเอียดการ์ดใน Recipe</strong>
          <button class="btn btn-sm" id="closeRecipeCardModalBtn">ปิด</button>
        </div>
        <div class="card-detail-layout">
          <img class="card-detail-img" src="${App.escapeHtml(card.image_url || '')}" alt="${App.escapeHtml(card.name)}" />
          <div>
            <h3 style="margin:0 0 6px;">${App.escapeHtml(card.name)}</h3>
            <div class="card-detail-meta">
              ${statusBadge}
              <span class="badge">ID: ${card.id}</span>
            </div>
            <div class="card-detail-meta">${statPills.join('')}</div>
            <div class="card-detail-desc">${App.escapeHtml(card.desc || 'ไม่มีคำอธิบาย')}</div>
            ${packsHtml}
          </div>
        </div>
      </div>
    `);

    document.getElementById('closeRecipeCardModalBtn').addEventListener('click', () => App.closeModal());
    if (CardDetailPacks && breakdown) {
      CardDetailPacks.bindCardPacksSectionEvents(document.getElementById('modalContent') || document, breakdown, {
        App,
        Views: root.YgoTower.Views,
        season,
        onBackToCardDetail: () => openRecipeCardModal(card, ownedCount, neededCount, { season, cardMap }),
      });
    }
  }

  function openRenameModal(recipe, onSaved) {
    const App = root.YgoTower.App;
    const DB = root.YgoTower.DB;

    App.openModal(`
      <div>
        <h3 class="card-title">
          <span>✏️ เปลี่ยนชื่อ Recipe</span>
          <button class="btn btn-sm" id="closeRenameModalBtn">ปิด</button>
        </h3>
        <div class="form-row" style="margin-top:12px;">
          <input type="text" id="renameRecipeInput" value="${App.escapeHtml(recipe.name)}" style="flex:1;" maxlength="80" />
          <button class="btn btn-primary" id="confirmRenameRecipeBtn">บันทึก</button>
        </div>
      </div>
    `);

    const input = document.getElementById('renameRecipeInput');
    input.focus();
    input.select();

    const submit = async () => {
      const nextName = input.value.trim();
      if (!nextName) {
        App.showToast('กรุณากรอกชื่อ Recipe');
        return;
      }
      await DB.saveRecipe({ ...recipe, name: nextName });
      App.closeModal();
      App.showToast('เปลี่ยนชื่อ Recipe เรียบร้อยแล้ว');
      onSaved();
    };

    document.getElementById('closeRenameModalBtn').addEventListener('click', () => App.closeModal());
    document.getElementById('confirmRenameRecipeBtn').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  }

  async function renderRecipesView(container, state) {
    const App = root.YgoTower.App;
    const DB = root.YgoTower.DB;
    const Api = root.YgoTower.Api;
    const Ydk = root.YgoTower.Ydk;
    const SaveManager = root.YgoTower.SaveManager;
    const maxRecipes = (root.YgoTower.Constants && root.YgoTower.Constants.MAX_RECIPES) || 20;

    const recipes = await DB.getRecipes();
    if (selectedRecipeId && !recipes.some((r) => r.id === selectedRecipeId)) {
      selectedRecipeId = null;
    }
    if (!selectedRecipeId && recipes.length > 0) {
      selectedRecipeId = recipes[0].id;
    }

    const activeRecipe = recipes.find((r) => r.id === selectedRecipeId) || null;
    const season = state.activeSeason;
    const collection = (season && season.collection) || {};
    const atLimit = recipes.length >= maxRecipes;

    let evaluation = null;
    const cardMap = new Map();
    const neededCounts = new Map();

    if (activeRecipe) {
      evaluation = Ydk.evaluateRecipeAgainstCollection(activeRecipe, collection);
      const allIds = [...activeRecipe.main, ...activeRecipe.extra, ...activeRecipe.side];
      for (const id of allIds) {
        neededCounts.set(id, (neededCounts.get(id) || 0) + 1);
      }
      const resolvedMap = await Api.getCardsByIds(allIds);
      for (const id of allIds) {
        if (!cardMap.has(id)) {
          cardMap.set(
            id,
            resolvedMap.get(id) || { id, name: `Card #${id}`, type: '', frameType: '', desc: '', image_url: '' }
          );
        }
      }
    }

    const renderRecipeList = () => {
      if (!recipes.length) {
        return `<p class="muted" style="margin:8px 0 0;">ยังไม่มี Recipe ที่บันทึกไว้ กดอัปโหลดไฟล์ .ydk หรือเพิ่มจาก YDKE เพื่อเริ่มต้น</p>`;
      }
      return recipes
        .map((r) => {
          const isActive = activeRecipe && r.id === activeRecipe.id;
          return `
            <div class="floor-item recipe-list-item ${isActive ? 'active' : ''}" data-select-recipe="${r.id}">
              <div style="min-width:0; flex:1;">
                <div class="recipe-list-name">${App.escapeHtml(r.name)}</div>
                <div class="muted" style="font-size:0.78rem;">
                  Main ${r.main.length} • Extra ${r.extra.length} • Side ${r.side.length}
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    };

    const renderZoneGrid = (title, items) => {
      if (!items.length) {
        return `
          <div style="margin-bottom:16px;">
            <div class="recipe-zone-header"><strong>${title} (0)</strong></div>
            <div class="muted" style="font-size:0.85rem;">ไม่มีการ์ดในโซนนี้</div>
          </div>
        `;
      }

      const tiles = items
        .map((item) => {
          const card = cardMap.get(item.id) || { id: item.id, name: `Card #${item.id}`, image_url: '' };
          return `
            <div
              class="recipe-card-tile ${item.owned ? 'owned' : 'missing'}"
              style="opacity: ${item.opacity};"
              data-recipe-card="${item.id}"
              title="${App.escapeHtml(card.name)} (${item.owned ? 'มีในคลัง' : 'ยังไม่มีในคลัง'})"
            >
              <img src="${App.escapeHtml(card.image_url || '')}" alt="${App.escapeHtml(card.name)}" loading="lazy" />
              <div class="recipe-card-name">${App.escapeHtml(card.name)}</div>
            </div>
          `;
        })
        .join('');

      return `
        <div style="margin-bottom:18px;">
          <div class="recipe-zone-header"><strong>${title} (${items.length})</strong></div>
          <div class="recipe-cards-grid">${tiles}</div>
        </div>
      `;
    };

    const renderDetailPanel = () => {
      if (!activeRecipe || !evaluation) {
        return `
          <div class="card">
            <h3 class="card-title">📜 จัดการ Recipe (.ydk / YDKE)</h3>
            <p class="muted">
              อัปโหลดไฟล์ <code>.ydk</code> หรือวางลิงก์ <code>ydke://</code> เพื่อบันทึก Deck Recipe ไว้ดูรายการการ์ดที่ต้องการ (สูงสุด ${maxRecipes} Deck)
            </p>
            <p class="muted">
              • การ์ดที่ <strong>มีอยู่ในคลัง</strong> ของ Season ปัจจุบันจะแสดงที่ <code>opacity: 1</code><br />
              • การ์ดที่ <strong>ยังไม่มีในคลัง</strong> จะแสดงที่ <code>opacity: 0.5</code>
            </p>
          </div>
        `;
      }

      const { stats } = evaluation;
      return `
        <div class="card">
          <div class="card-title" style="flex-wrap:wrap;">
            <span style="min-width:0; overflow-wrap:anywhere;">📜 ${App.escapeHtml(activeRecipe.name)}</span>
            <div class="form-row" style="margin-bottom:0; gap:6px; flex-wrap:wrap;">
              <button class="btn btn-sm" id="renameRecipeBtn">✏️ เปลี่ยนชื่อ</button>
              <button class="btn btn-sm" id="replaceRecipeYdkBtn">🔄 อัปเดต .ydk</button>
              <input type="file" id="replaceRecipeYdkInput" accept=".ydk" style="display:none;" />
              <button class="btn btn-sm" id="replaceRecipeYdkeBtn">🔄 อัปเดต YDKE</button>
              <button class="btn btn-sm btn-gold" id="exportRecipeYdkBtn">📥 Export .ydk</button>
              <button class="btn btn-sm btn-gold" id="exportRecipeYdkeBtn">📥 Export YDKE</button>
              <button class="btn btn-sm btn-danger" id="deleteRecipeBtn">🗑️ ลบ</button>
            </div>
          </div>

          ${
            !season
              ? `<div class="alert-box" style="font-size:0.85rem;">ยังไม่มี Season ที่กำลังเล่น — การ์ดทั้งหมดจะแสดงเป็นยังไม่มีในคลัง (opacity 0.5)</div>`
              : ''
          }

          <div class="recipe-summary-box">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <span>
                มีในคลังแล้ว <strong>${stats.ownedCards} / ${stats.totalCards}</strong> ใบ (${stats.completionPct}%)
                ${stats.missingCards > 0 ? `• <span style="color:var(--warning);">ขาดอีก ${stats.missingCards} ใบ</span>` : `• <span style="color:var(--success);">ครบทั้ง Deck แล้ว!</span>`}
              </span>
              <span class="muted" style="font-size:0.8rem;">
                มีในคลัง = opacity 1 • ไม่มี = opacity 0.5
              </span>
            </div>
            <div class="progress-bar-wrap" style="margin-bottom:0;">
              <div class="progress-bar-fill" style="width:${stats.completionPct}%; background:${stats.missingCards === 0 && stats.totalCards > 0 ? 'var(--success)' : 'var(--primary)'};"></div>
            </div>
          </div>

          <div class="recipe-detail-scroll">
            ${renderZoneGrid('Main Deck', evaluation.main)}
            ${renderZoneGrid('Extra Deck', evaluation.extra)}
            ${renderZoneGrid('Side Deck', evaluation.side)}
          </div>
        </div>
      `;
    };

    container.innerHTML = `
      <div class="grid-2 grid-2--recipes">
        <div>
          <div class="card">
            <h3 class="card-title">
              <span>📚 รายการ Recipe</span>
              <span class="badge">${recipes.length} / ${maxRecipes}</span>
            </h3>
            <div style="margin-bottom:12px;">
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn btn-primary" id="uploadRecipeYdkBtn" style="flex:1;" ${atLimit ? 'disabled' : ''}>
                  📤 อัปโหลด .ydk
                </button>
                <button class="btn" id="importRecipeYdkeBtn" style="flex:1;" ${atLimit ? 'disabled' : ''}>
                  📤 เพิ่มจาก YDKE
                </button>
              </div>
              <input type="file" id="uploadRecipeYdkInput" accept=".ydk" multiple style="display:none;" />
              ${
                atLimit
                  ? `<div class="muted" style="color:var(--warning); font-size:0.78rem; margin-top:6px;">บันทึกครบ ${maxRecipes} Deck แล้ว กรุณาลบ Deck เดิมก่อนเพิ่มใหม่</div>`
                  : `<div class="muted" style="font-size:0.78rem; margin-top:6px;">รองรับเลือกหลายไฟล์พร้อมกัน หรือเพิ่มจากลิงก์ YDKE (สูงสุด ${maxRecipes} Deck)</div>`
              }
            </div>
            <div class="floor-list recipe-list-scroll" id="recipeList">${renderRecipeList()}</div>
          </div>
        </div>

        <div>
          ${renderDetailPanel()}
        </div>
      </div>
    `;

    // Upload new .ydk recipe(s)
    const uploadBtn = document.getElementById('uploadRecipeYdkBtn');
    const uploadInput = document.getElementById('uploadRecipeYdkInput');
    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', () => uploadInput.click());
      uploadInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (!files.length) return;

        let currentCount = (await DB.getRecipes()).length;
        let added = 0;
        let skippedLimit = 0;
        let skippedEmpty = 0;
        let lastId = null;

        for (const file of files) {
          if (currentCount >= maxRecipes) {
            skippedLimit += 1;
            continue;
          }
          const text = await file.text();
          const parsed = Ydk.parseYdk(text);
          const total = parsed.main.length + parsed.extra.length + parsed.side.length;
          if (total === 0) {
            skippedEmpty += 1;
            continue;
          }
          lastId = await DB.saveRecipe({
            name: stripYdkExt(file.name),
            main: parsed.main,
            extra: parsed.extra,
            side: parsed.side,
          });
          currentCount += 1;
          added += 1;
        }

        if (lastId) selectedRecipeId = lastId;

        if (added > 0) {
          App.showToast(`บันทึก Recipe สำเร็จ ${added} Deck`);
        }
        if (skippedEmpty > 0) {
          App.showToast(`ข้าม ${skippedEmpty} ไฟล์ที่ไม่พบการ์ดใน .ydk`);
        }
        if (skippedLimit > 0) {
          App.showToast(`บันทึกได้สูงสุด ${maxRecipes} Deck (ข้าม ${skippedLimit} ไฟล์ที่เกิน)`);
        }

        renderRecipesView(container, state);
      });
    }

    const importYdkeBtn = document.getElementById('importRecipeYdkeBtn');
    if (importYdkeBtn) {
      importYdkeBtn.addEventListener('click', async () => {
        const latestCount = (await DB.getRecipes()).length;
        const defaultName = `Recipe #${latestCount + 1}`;
        openYdkeInputModal({
          title: '📤 เพิ่ม Recipe จากลิงก์ YDKE',
          description: 'วางลิงก์รูปแบบ <code>ydke://...</code> เพื่อบันทึกเป็น Recipe ใหม่',
          showNameInput: true,
          defaultName,
          submitLabel: 'บันทึก Recipe',
          onSubmit: async ({ rawUri, rawName, showError }) => {
            const currentCount = (await DB.getRecipes()).length;
            if (currentCount >= maxRecipes) {
              App.showToast(`บันทึกได้สูงสุด ${maxRecipes} Deck`);
              showError(`บันทึกครบ ${maxRecipes} Deck แล้ว กรุณาลบ Deck เดิมก่อนเพิ่มใหม่`);
              return;
            }

            let parsed;
            try {
              parsed = Ydk.parseYdke(rawUri);
            } catch (err) {
              App.showToast('ไม่สามารถเพิ่ม Recipe จาก YDKE ได้');
              showError(err && err.message ? err.message : 'รูปแบบลิงก์ YDKE ไม่ถูกต้อง');
              return;
            }

            if (parsed.main.length + parsed.extra.length + parsed.side.length === 0) {
              App.showToast('ไม่สามารถเพิ่ม Recipe จาก YDKE ได้');
              showError('ไม่พบการ์ดในลิงก์ YDKE นี้');
              return;
            }

            const name = rawName.trim() || defaultName;
            const newId = await DB.saveRecipe({
              name,
              main: parsed.main,
              extra: parsed.extra,
              side: parsed.side,
            });
            selectedRecipeId = newId;
            App.closeModal();
            App.showToast(`บันทึก Recipe "${name}" สำเร็จ`);
            await renderRecipesView(container, state);
          },
        });
      });
    }

    // Select recipe from list
    container.querySelectorAll('[data-select-recipe]').forEach((el) => {
      el.addEventListener('click', () => {
        selectedRecipeId = Number(el.dataset.selectRecipe);
        renderRecipesView(container, state);
      });
    });

    if (activeRecipe) {
      document.getElementById('renameRecipeBtn').addEventListener('click', () => {
        openRenameModal(activeRecipe, () => renderRecipesView(container, state));
      });

      const replaceBtn = document.getElementById('replaceRecipeYdkBtn');
      const replaceInput = document.getElementById('replaceRecipeYdkInput');
      replaceBtn.addEventListener('click', () => replaceInput.click());
      replaceInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const text = await file.text();
        const parsed = Ydk.parseYdk(text);
        if (parsed.main.length + parsed.extra.length + parsed.side.length === 0) {
          App.showToast('ไม่พบการ์ดในไฟล์ .ydk นี้');
          return;
        }
        await DB.saveRecipe({
          ...activeRecipe,
          main: parsed.main,
          extra: parsed.extra,
          side: parsed.side,
        });
        App.showToast(`อัปเดต "${activeRecipe.name}" เรียบร้อยแล้ว`);
        renderRecipesView(container, state);
      });

      document.getElementById('replaceRecipeYdkeBtn').addEventListener('click', () => {
        openYdkeInputModal({
          title: '🔄 อัปเดต Recipe จากลิงก์ YDKE',
          description: `วางลิงก์ <code>ydke://...</code> เพื่ออัปเดตรายการการ์ดของ <strong>${App.escapeHtml(activeRecipe.name)}</strong>`,
          showNameInput: false,
          submitLabel: 'อัปเดต Recipe',
          onSubmit: async ({ rawUri, showError }) => {
            let parsed;
            try {
              parsed = Ydk.parseYdke(rawUri);
            } catch (err) {
              App.showToast('ไม่สามารถอัปเดต Recipe ได้');
              showError(err && err.message ? err.message : 'รูปแบบลิงก์ YDKE ไม่ถูกต้อง');
              return;
            }

            if (parsed.main.length + parsed.extra.length + parsed.side.length === 0) {
              App.showToast('ไม่สามารถอัปเดต Recipe ได้');
              showError('ไม่พบการ์ดในลิงก์ YDKE นี้');
              return;
            }

            await DB.saveRecipe({
              ...activeRecipe,
              main: parsed.main,
              extra: parsed.extra,
              side: parsed.side,
            });
            App.closeModal();
            App.showToast(`อัปเดต "${activeRecipe.name}" เรียบร้อยแล้ว`);
            await renderRecipesView(container, state);
          },
        });
      });

      document.getElementById('exportRecipeYdkBtn').addEventListener('click', () => {
        const ydkText = Ydk.generateYdk(activeRecipe);
        const safeName = activeRecipe.name.replace(/[^a-z0-9ก-๙_-]/gi, '_');
        SaveManager.downloadFile(`${safeName}.ydk`, ydkText, 'text/plain');
        App.showToast(`Export ${safeName}.ydk สำเร็จ`);
      });

      document.getElementById('exportRecipeYdkeBtn').addEventListener('click', async () => {
        let ydkeUri;
        try {
          ydkeUri = Ydk.generateYdke(activeRecipe);
        } catch (err) {
          App.showToast(err && err.message ? err.message : 'ไม่สามารถสร้างลิงก์ YDKE ได้');
          return;
        }

        const copied = await copyTextToClipboard(ydkeUri);
        if (copied) {
          App.showToast(`คัดลอกลิงก์ YDKE ของ "${activeRecipe.name}" สำเร็จ`);
          return;
        }

        App.openModal(`
          <h3 class="card-title">📥 Export ลิงก์ YDKE</h3>
          <p class="muted" style="margin-top:0;">ไม่สามารถคัดลอกลง Clipboard อัตโนมัติได้ กรุณาคัดลอกลิงก์ของ <strong>${App.escapeHtml(activeRecipe.name)}</strong> ด้านล่าง:</p>
          <textarea id="exportRecipeYdkeTextarea" readonly rows="4" style="width:100%; box-sizing:border-box; font-family:monospace; font-size:0.85rem;">${App.escapeHtml(ydkeUri)}</textarea>
          <div class="form-row" style="justify-content:flex-end; gap:8px; margin-top:12px;">
            <button type="button" class="btn" id="copyExportRecipeYdkeFallbackBtn">📋 คัดลอก</button>
            <button type="button" class="btn btn-primary" id="closeExportRecipeYdkeModalBtn">ปิด</button>
          </div>
        `);

        const textarea = document.getElementById('exportRecipeYdkeTextarea');
        if (textarea) {
          textarea.focus?.();
          textarea.select?.();
        }
        document.getElementById('copyExportRecipeYdkeFallbackBtn').addEventListener('click', async () => {
          if (textarea) {
            textarea.focus?.();
            textarea.select?.();
          }
          const ok = await copyTextToClipboard(ydkeUri);
          if (ok) {
            App.showToast(`คัดลอกลิงก์ YDKE ของ "${activeRecipe.name}" สำเร็จ`);
          } else {
            App.showToast('กรุณากด Ctrl+C / Cmd+C เพื่อคัดลอกด้วยตนเอง');
          }
        });
        document.getElementById('closeExportRecipeYdkeModalBtn').addEventListener('click', () => App.closeModal());
      });

      document.getElementById('deleteRecipeBtn').addEventListener('click', async () => {
        await DB.deleteRecipe(activeRecipe.id);
        App.showToast(`ลบ Recipe "${activeRecipe.name}" แล้ว`);
        selectedRecipeId = null;
        renderRecipesView(container, state);
      });

      container.querySelectorAll('[data-recipe-card]').forEach((tile) => {
        tile.addEventListener('click', async () => {
          const id = Number(tile.dataset.recipeCard);
          const card = cardMap.get(id) || { id, name: `Card #${id}`, image_url: '' };
          const ownedCount = Number(collection[String(id)] || 0);
          const neededCount = neededCounts.get(id) || 1;
          await openRecipeCardModal(card, ownedCount, neededCount, { season: state.activeSeason, cardMap });
        });
      });
    }
  }

  root.YgoTower.Views.renderRecipesView = renderRecipesView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
