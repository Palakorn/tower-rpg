(function (root) {
  root.YgoTower = root.YgoTower || {};
  root.YgoTower.Views = root.YgoTower.Views || {};

  const PULL_RATE_ROWS = {
    tcg: [
      { key: 'super', label: 'Super Rare' },
      { key: 'ultra', label: 'Ultra Rare' },
      { key: 'secret', label: 'Secret Rare' },
    ],
    ocg: [
      { key: 'common', label: 'Common' },
      { key: 'rare', label: 'Rare' },
      { key: 'super', label: 'Super Rare' },
      { key: 'ultra', label: 'Ultra Rare' },
      { key: 'secret', label: 'Secret Rare' },
    ],
  };

  function renderPullRateRows(template, weights) {
    return PULL_RATE_ROWS[template]
      .map(
        ({ key, label }) => `
        <div class="pull-rate-row">
          <span class="badge badge-${key}">${label}</span>
          <input
            type="number"
            min="0"
            step="any"
            data-pull-weight="${template}:${key}"
            value="${weights[key]}"
            class="pull-rate-input"
          />
          <span class="muted pull-rate-pct" data-pull-pct="${template}:${key}">0.0%</span>
        </div>
      `
      )
      .join('');
  }

  function weightsEqual(a, b) {
    const keys = Object.keys(b);
    return keys.every((k) => Math.abs(Number(a[k]) - Number(b[k])) < 1e-9);
  }

  async function renderSettingsView(container, state) {
    const App = root.YgoTower.App;
    const Constants = root.YgoTower.Constants;
    const DB = root.YgoTower.DB;
    const Api = root.YgoTower.Api;
    const SaveManager = root.YgoTower.SaveManager;
    const db = DB.getDB();

    const settings = state.settings;
    const eventCfg = Constants.getEventConfig(settings);
    const pullRates = Constants.getPullRatesConfig(settings);
    const presets = Constants.PULL_RATE_PRESETS || {};
    const cacheStats = await Api.getCacheStats();
    const allSets = await db.sets.toArray();

    const presetButtonsHtml = Object.values(presets)
      .map(
        (p) => `
        <button type="button" class="btn btn-sm" data-pull-preset="${App.escapeHtml(p.id)}">
          ${App.escapeHtml(p.label)}
        </button>
      `
      )
      .join('');

    const ecoRows = settings.floorEconomy
      .map(
        (eco) => `
      <tr>
        <td><strong>ชั้น ${eco.floor}</strong></td>
        <td><input type="number" data-eco="${eco.floor}:packPrice" value="${eco.packPrice}" style="width:90px" /></td>
        <td><input type="number" data-eco="${eco.floor}:winDp" value="${eco.winDp}" style="width:90px" /></td>
        <td><input type="number" data-eco="${eco.floor}:lossDp" value="${eco.lossDp}" style="width:90px" /></td>
        <td><input type="number" data-eco="${eco.floor}:guardCount" value="${eco.guardCount}" min="1" max="6" style="width:70px" /></td>
      </tr>
    `
      )
      .join('');

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title">🌐 ข้อมูลการ์ดและซองจาก YGOPRODeck API (Offline Cache)</h3>
        <p class="muted">
          สถานะแคชปัจจุบันใน IndexedDB: <strong>${cacheStats.cardsCount}</strong> การ์ด • <strong>${cacheStats.setsCount}</strong> ซอง
        </p>
        <div id="syncProgressWrap" style="display:none;">
          <div class="muted" id="syncStatusText">กำลังซิงค์...</div>
          <div class="progress-bar-wrap"><div class="progress-bar-fill" id="syncProgressBar"></div></div>
        </div>
        <button class="btn btn-primary" id="syncApiBtn">🔄 ซิงค์ข้อมูลการ์ด &amp; ซองจาก YGOPRODeck</button>
      </div>

      <div class="card">
        <h3 class="card-title">💾 สำรองข้อมูล Save (.json)</h3>
        <p class="muted">ส่งออกข้อมูล Season, คลังการ์ด, Roster, Settings และ Hall of Fame เป็นไฟล์ .json</p>
        <div class="form-row" style="margin:0;">
          <button class="btn btn-gold" id="exportSaveBtn">📥 Export Save (.json)</button>
          <label class="btn" style="cursor:pointer;">
            📤 Import Save (.json)
            <input type="file" id="importSaveInput" accept=".json" style="display:none;" />
          </label>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">⚖️ ตั้งค่าเศรษฐกิจ, Rematch &amp; Event (EvP)</h3>
        <div class="form-row">
          <label>ตัวคูณค่า Rematch มินิบอส (เทียบราคาซอง):</label>
          <input type="number" step="0.1" id="minibossRatioInput" value="${settings.minibossRematchRatio}" style="width:80px" />
          <label>ตัวคูณค่า Rematch บอส:</label>
          <input type="number" step="0.1" id="bossRatioInput" value="${settings.bossRematchRatio}" style="width:80px" />
        </div>
        <div class="form-row">
          <label>EvP ชนะ:</label>
          <input type="number" min="0" step="1" id="winEvpInput" value="${eventCfg.winEvp}" style="width:70px" />
          <label>EvP แพ้:</label>
          <input type="number" min="0" step="1" id="lossEvpInput" value="${eventCfg.lossEvp}" style="width:70px" />
          <label>เกณฑ์เปิดซองฟรี:</label>
          <input type="number" min="1" step="1" id="packEvpThresholdInput" value="${eventCfg.packThreshold}" style="width:70px" />
          <label>เกณฑ์เลือกการ์ด:</label>
          <input type="number" min="2" step="1" id="pickCardEvpThresholdInput" value="${eventCfg.pickCardThreshold}" style="width:70px" />
        </div>
        <table>
          <thead>
            <tr>
              <th>ชั้น</th>
              <th>ราคาซอง (DP)</th>
              <th>DP ชนะ</th>
              <th>DP แพ้</th>
              <th>จำนวนทหารยาม</th>
            </tr>
          </thead>
          <tbody>${ecoRows}</tbody>
        </table>
        <div class="form-row" style="margin-top:12px; justify-content:flex-end;">
          <button class="btn btn-primary" id="saveSettingsBtn">💾 บันทึกการตั้งค่า</button>
        </div>
      </div>

      <div class="card" id="pullRatesCard">
        <h3 class="card-title">
          <span>🎲 ตั้งค่าเรตเปิดซอง (Pull Rates)</span>
          <span class="muted" style="font-size:0.84rem;">กรอกเป็นค่าน้ำหนัก (ไม่ต้องรวมได้ 100 ระบบคำนวณ % ให้อัตโนมัติ)</span>
        </h3>
        <div class="form-row">
          <span class="muted">Preset:</span>
          ${presetButtonsHtml}
        </div>
        <div class="pull-rates-grid">
          <div class="pull-rate-box">
            <div class="pull-rate-box-header">
              <strong>ซอง TCG (${pullRates.tcg.cardsPerPack} ใบ/ซอง)</strong>
              <span class="muted" id="tcgPullTotal">รวมน้ำหนัก: 100</span>
            </div>
            <div class="muted" style="font-size:0.84rem;">
              การันตี Common ${pullRates.tcg.commonSlots} ใบ + Rare ${pullRates.tcg.rareSlots} ใบ + ช่อง Foil 1 ใบ (สุ่มตามเรตด้านล่าง)
            </div>
            ${renderPullRateRows('tcg', pullRates.tcg.foilWeights)}
          </div>
          <div class="pull-rate-box">
            <div class="pull-rate-box-header">
              <strong>ซอง OCG (${pullRates.ocg.cardsPerPack} ใบ/ซอง)</strong>
              <span class="muted" id="ocgPullTotal">รวมน้ำหนัก: 100</span>
            </div>
            <div class="muted" style="font-size:0.84rem;">
              สุ่มอิสระทั้ง ${pullRates.ocg.cardsPerPack} ใบ/ซอง ตามน้ำหนักด้านล่าง
            </div>
            ${renderPullRateRows('ocg', pullRates.ocg.weights)}
          </div>
        </div>
        <div class="form-row" style="margin-top:12px; justify-content:flex-end;">
          <button class="btn btn-primary" id="savePullRatesBtn">💾 บันทึกเรตเปิดซอง</button>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">🗂️ จัดการซองประจำชั้น (${allSets.length} ซอง)</h3>
        <input type="text" id="setFilterInput" placeholder="ค้นหาชื่อซองหรือรหัสซองเพื่อย้ายชั้น/สลับ OCG-TCG..." style="width:100%; margin-bottom:10px;" />
        <div id="setManagerList"></div>
      </div>
    `;

    document.getElementById('syncApiBtn').addEventListener('click', async () => {
      const btn = document.getElementById('syncApiBtn');
      const wrap = document.getElementById('syncProgressWrap');
      const textEl = document.getElementById('syncStatusText');
      const barEl = document.getElementById('syncProgressBar');

      btn.disabled = true;
      wrap.style.display = 'block';
      try {
        const res = await Api.syncFromApi((msg, pct) => {
          textEl.textContent = msg;
          barEl.style.width = `${pct}%`;
        });
        App.showToast(`ซิงค์สำเร็จ: ${res.cardsCount} การ์ด, ${res.setsCount} ซอง`);
        App.renderCurrentView();
      } catch (err) {
        App.showToast(`ซิงค์ล้มเหลว: ${err.message}`);
        btn.disabled = false;
      }
    });

    document.getElementById('exportSaveBtn').addEventListener('click', async () => {
      const json = await SaveManager.exportSaveJson();
      SaveManager.downloadFile(`ygo_tower_save_${new Date().toISOString().slice(0, 10)}.json`, json);
      App.showToast('ส่งออกไฟล์ Save เรียบร้อย');
    });

    document.getElementById('importSaveInput').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const res = await SaveManager.importSaveJson(await file.text());
        App.showToast(`กู้คืน Save สำเร็จ (${res.seasonsCount} Season, ${res.rosterCount} ตัวละคร)`);
        App.renderCurrentView();
      } catch (err) {
        App.showToast(`นำเข้า Save ล้มเหลว: ${err.message}`);
      }
    });

    const readTemplateWeights = (template) => {
      const result = {};
      for (const { key, label } of PULL_RATE_ROWS[template]) {
        const input = container.querySelector(`[data-pull-weight="${template}:${key}"]`);
        const rawText = input ? String(input.value).trim() : '';
        const val = rawText === '' ? NaN : Number(rawText);
        if (!Number.isFinite(val) || val < 0) {
          return {
            ok: false,
            error: `น้ำหนัก ${label} (${template.toUpperCase()}) ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`,
          };
        }
        result[key] = val;
      }
      const total = Object.values(result).reduce((sum, n) => sum + n, 0);
      if (total <= 0) {
        return {
          ok: false,
          error: `ผลรวมน้ำหนักของซอง ${template.toUpperCase()} ต้องมากกว่า 0`,
        };
      }
      return { ok: true, weights: result, total };
    };

    const readPullRatesFromForm = () => {
      const tcgRes = readTemplateWeights('tcg');
      if (!tcgRes.ok) return tcgRes;
      const ocgRes = readTemplateWeights('ocg');
      if (!ocgRes.ok) return ocgRes;

      return {
        ok: true,
        pullRates: Constants.getPullRatesConfig({
          pullRates: {
            ocg: {
              cardsPerPack: pullRates.ocg.cardsPerPack,
              weights: ocgRes.weights,
            },
            tcg: {
              cardsPerPack: pullRates.tcg.cardsPerPack,
              commonSlots: pullRates.tcg.commonSlots,
              rareSlots: pullRates.tcg.rareSlots,
              foilWeights: tcgRes.weights,
            },
          },
        }),
      };
    };

    const refreshPullRatePreview = () => {
      const current = {};
      for (const template of ['tcg', 'ocg']) {
        const map = {};
        let total = 0;
        for (const { key } of PULL_RATE_ROWS[template]) {
          const input = container.querySelector(`[data-pull-weight="${template}:${key}"]`);
          const n = Number(input ? input.value : 0);
          const val = Number.isFinite(n) && n >= 0 ? n : 0;
          map[key] = val;
          total += val;
        }
        current[template] = map;

        for (const { key } of PULL_RATE_ROWS[template]) {
          const pctEl = container.querySelector(`[data-pull-pct="${template}:${key}"]`);
          if (pctEl) {
            const pct = total > 0 ? (map[key] / total) * 100 : 0;
            pctEl.textContent = `${pct.toFixed(1)}%`;
          }
        }
        const totalEl = document.getElementById(template === 'tcg' ? 'tcgPullTotal' : 'ocgPullTotal');
        if (totalEl) {
          const formattedTotal = Number.isInteger(total) ? total : Number(total.toFixed(2));
          totalEl.textContent = `รวมน้ำหนัก: ${formattedTotal}`;
        }
      }

      container.querySelectorAll('[data-pull-preset]').forEach((btn) => {
        const preset = presets[btn.dataset.pullPreset];
        const isMatch =
          preset &&
          weightsEqual(current.tcg, preset.tcgFoilWeights) &&
          weightsEqual(current.ocg, preset.ocgWeights);
        btn.classList.toggle('btn-gold', Boolean(isMatch));
      });
    };

    refreshPullRatePreview();

    container.querySelectorAll('[data-pull-weight]').forEach((input) => {
      input.addEventListener('input', refreshPullRatePreview);
    });

    container.querySelectorAll('[data-pull-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = presets[btn.dataset.pullPreset];
        if (!preset) return;
        for (const { key } of PULL_RATE_ROWS.tcg) {
          const input = container.querySelector(`[data-pull-weight="tcg:${key}"]`);
          if (input) input.value = String(preset.tcgFoilWeights[key]);
        }
        for (const { key } of PULL_RATE_ROWS.ocg) {
          const input = container.querySelector(`[data-pull-weight="ocg:${key}"]`);
          if (input) input.value = String(preset.ocgWeights[key]);
        }
        refreshPullRatePreview();
      });
    });

    document.getElementById('savePullRatesBtn').addEventListener('click', async () => {
      const pullRes = readPullRatesFromForm();
      if (!pullRes.ok) {
        App.showToast(pullRes.error);
        return;
      }
      settings.pullRates = pullRes.pullRates;
      await DB.saveSettings(settings);
      App.showToast('บันทึกเรตเปิดซองเรียบร้อย');
      App.renderCurrentView();
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
      const winEvp = Math.floor(Number(document.getElementById('winEvpInput').value));
      const lossEvp = Math.floor(Number(document.getElementById('lossEvpInput').value));
      const packThreshold = Math.floor(Number(document.getElementById('packEvpThresholdInput').value));
      const pickCardThreshold = Math.floor(Number(document.getElementById('pickCardEvpThresholdInput').value));

      if (!Number.isFinite(winEvp) || winEvp < 0 || !Number.isFinite(lossEvp) || lossEvp < 0) {
        App.showToast('ค่า EvP ชนะ/แพ้ ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป');
        return;
      }
      if (!Number.isFinite(packThreshold) || packThreshold < 1) {
        App.showToast('เกณฑ์ EvP เปิดซองฟรี ต้องมีค่าอย่างน้อย 1');
        return;
      }
      if (!Number.isFinite(pickCardThreshold) || pickCardThreshold <= packThreshold) {
        App.showToast('เกณฑ์ EvP เลือกการ์ด ต้องมากกว่าเกณฑ์เปิดซองฟรี');
        return;
      }

      const pullRes = readPullRatesFromForm();
      if (!pullRes.ok) {
        App.showToast(pullRes.error);
        return;
      }

      settings.minibossRematchRatio = Number(document.getElementById('minibossRatioInput').value) || 0.5;
      settings.bossRematchRatio = Number(document.getElementById('bossRatioInput').value) || 1.0;
      settings.eventConfig = {
        winEvp,
        lossEvp,
        packThreshold,
        pickCardThreshold,
      };
      settings.pullRates = pullRes.pullRates;

      container.querySelectorAll('[data-eco]').forEach((input) => {
        const [floorStr, field] = input.dataset.eco.split(':');
        const eco = settings.floorEconomy.find((e) => e.floor === Number(floorStr));
        if (eco) {
          eco[field] = Number(input.value) || 0;
        }
      });

      await DB.saveSettings(settings);
      App.showToast('บันทึกการตั้งค่าเรียบร้อย');
      App.renderCurrentView();
    });

    const renderSetManager = (query = '') => {
      const Constants = root.YgoTower.Constants;
      const listEl = document.getElementById('setManagerList');
      const q = query.toLowerCase();
      const matched = allSets
        .filter((s) => !q || s.set_name.toLowerCase().includes(q) || s.set_code.toLowerCase().includes(q))
        .slice()
        .sort((a, b) => (a.tcg_date || '').localeCompare(b.tcg_date || ''));

      if (!matched.length) {
        listEl.innerHTML = `<p class="muted">ไม่พบซองที่ค้นหา</p>`;
        return;
      }

      listEl.innerHTML = `
        <table>
          <thead><tr><th>ซอง</th><th>วันที่</th><th>ชั้น</th><th>เทมเพลต</th></tr></thead>
          <tbody>
            ${matched
              .map(
                (s) => `
              <tr>
                <td>
                  <div style="display:flex; align-items:center; gap:10px;">
                    <img class="pack-thumb-sm" src="${App.escapeHtml(Constants.getPackImageUrl(s))}" alt="${App.escapeHtml(s.set_name)}" loading="lazy" />
                    <div>
                      <strong>${App.escapeHtml(s.set_name)}</strong>
                      <span class="muted">(${App.escapeHtml(s.set_code)})</span>
                    </div>
                  </div>
                </td>
                <td class="muted">${App.escapeHtml(s.tcg_date || '-')}</td>
                <td>
                  <select data-set-floor="${App.escapeHtml(s.set_name)}">
                    ${[1, 2, 3, 4, 5, 6, 7]
                      .map((fl) => `<option value="${fl}" ${Number(s.assignedFloor) === fl ? 'selected' : ''}>ชั้น ${fl}</option>`)
                      .join('')}
                  </select>
                </td>
                <td>
                  <select data-set-tpl="${App.escapeHtml(s.set_name)}">
                    <option value="tcg" ${s.templateType === 'tcg' ? 'selected' : ''}>TCG (9 ใบ)</option>
                    <option value="ocg" ${s.templateType === 'ocg' ? 'selected' : ''}>OCG (5 ใบ)</option>
                  </select>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;

      listEl.querySelectorAll('[data-set-floor]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          const item = allSets.find((x) => x.set_name === sel.dataset.setFloor);
          if (item) {
            item.assignedFloor = Number(sel.value);
            await db.sets.put(item);
            App.showToast(`ย้าย ${item.set_name} ไปชั้น ${item.assignedFloor} แล้ว`);
          }
        });
      });

      listEl.querySelectorAll('[data-set-tpl]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          const item = allSets.find((x) => x.set_name === sel.dataset.setTpl);
          if (item) {
            item.templateType = sel.value;
            await db.sets.put(item);
            App.showToast(`เปลี่ยนเทมเพลต ${item.set_name} เป็น ${item.templateType.toUpperCase()} แล้ว`);
          }
        });
      });
    };

    renderSetManager();
    document.getElementById('setFilterInput').addEventListener('input', (e) => {
      renderSetManager(e.target.value);
    });
  }

  root.YgoTower.Views.renderSettingsView = renderSettingsView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
