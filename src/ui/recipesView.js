(function (root) {
  root.YgoTower = root.YgoTower || {};
  root.YgoTower.Views = root.YgoTower.Views || {};

  let selectedRecipeId = null;

  function stripYdkExt(filename) {
    return String(filename || 'Untitled').replace(/\.ydk$/i, '').trim() || 'Untitled';
  }

  function openRecipeCardModal(card, ownedCount, neededCount) {
    const App = root.YgoTower.App;
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
          </div>
        </div>
      </div>
    `);

    document.getElementById('closeRecipeCardModalBtn').addEventListener('click', () => App.closeModal());
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
        return `<p class="muted" style="margin:8px 0 0;">ยังไม่มี Recipe ที่บันทึกไว้ กดอัปโหลดไฟล์ .ydk เพื่อเริ่มต้น</p>`;
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
            <h3 class="card-title">📜 จัดการ Recipe (.ydk)</h3>
            <p class="muted">
              อัปโหลดไฟล์ <code>.ydk</code> เพื่อบันทึก Deck Recipe ไว้ดูรายการการ์ดที่ต้องการ (สูงสุด ${maxRecipes} Deck)
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
            <span>📜 ${App.escapeHtml(activeRecipe.name)}</span>
            <div class="form-row" style="margin-bottom:0; gap:6px;">
              <button class="btn btn-sm" id="renameRecipeBtn">✏️ เปลี่ยนชื่อ</button>
              <button class="btn btn-sm" id="replaceRecipeYdkBtn">🔄 อัปเดต .ydk</button>
              <input type="file" id="replaceRecipeYdkInput" accept=".ydk" style="display:none;" />
              <button class="btn btn-sm btn-gold" id="exportRecipeYdkBtn">📥 Export .ydk</button>
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

          ${renderZoneGrid('Main Deck', evaluation.main)}
          ${renderZoneGrid('Extra Deck', evaluation.extra)}
          ${renderZoneGrid('Side Deck', evaluation.side)}
        </div>
      `;
    };

    container.innerHTML = `
      <div class="grid-2" style="grid-template-columns: 300px 1fr;">
        <div>
          <div class="card">
            <h3 class="card-title">
              <span>📚 รายการ Recipe</span>
              <span class="badge">${recipes.length} / ${maxRecipes}</span>
            </h3>
            <div style="margin-bottom:12px;">
              <button class="btn btn-primary" id="uploadRecipeYdkBtn" style="width:100%;" ${atLimit ? 'disabled' : ''}>
                📤 อัปโหลด .ydk
              </button>
              <input type="file" id="uploadRecipeYdkInput" accept=".ydk" multiple style="display:none;" />
              ${
                atLimit
                  ? `<div class="muted" style="color:var(--warning); font-size:0.78rem; margin-top:6px;">บันทึกครบ ${maxRecipes} Deck แล้ว กรุณาลบ Deck เดิมก่อนเพิ่มใหม่</div>`
                  : `<div class="muted" style="font-size:0.78rem; margin-top:6px;">รองรับเลือกหลายไฟล์พร้อมกัน (สูงสุด ${maxRecipes} Deck)</div>`
              }
            </div>
            <div class="floor-list" id="recipeList">${renderRecipeList()}</div>
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

      document.getElementById('exportRecipeYdkBtn').addEventListener('click', () => {
        const ydkText = Ydk.generateYdk(activeRecipe);
        const safeName = activeRecipe.name.replace(/[^a-z0-9ก-๙_-]/gi, '_');
        SaveManager.downloadFile(`${safeName}.ydk`, ydkText, 'text/plain');
        App.showToast(`Export ${safeName}.ydk สำเร็จ`);
      });

      document.getElementById('deleteRecipeBtn').addEventListener('click', async () => {
        await DB.deleteRecipe(activeRecipe.id);
        App.showToast(`ลบ Recipe "${activeRecipe.name}" แล้ว`);
        selectedRecipeId = null;
        renderRecipesView(container, state);
      });

      container.querySelectorAll('[data-recipe-card]').forEach((tile) => {
        tile.addEventListener('click', () => {
          const id = Number(tile.dataset.recipeCard);
          const card = cardMap.get(id) || { id, name: `Card #${id}`, image_url: '' };
          const ownedCount = Number(collection[String(id)] || 0);
          const neededCount = neededCounts.get(id) || 1;
          openRecipeCardModal(card, ownedCount, neededCount);
        });
      });
    }
  }

  root.YgoTower.Views.renderRecipesView = renderRecipesView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
