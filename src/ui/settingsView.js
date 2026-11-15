(function (root) {
  root.YgoTower = root.YgoTower || {};
  root.YgoTower.Views = root.YgoTower.Views || {};

  async function renderSettingsView(container, state) {
    const App = root.YgoTower.App;
    const DB = root.YgoTower.DB;
    const Api = root.YgoTower.Api;
    const SaveManager = root.YgoTower.SaveManager;
    const db = DB.getDB();

    const settings = state.settings;
    const cacheStats = await Api.getCacheStats();
    const allSets = await db.sets.toArray();

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
        <h3 class="card-title">⚖️ ตั้งค่าเศรษฐกิจ, Rematch &amp; เรตสุ่มซอง</h3>
        <div class="form-row">
          <label>ตัวคูณค่า Rematch มินิบอส (เทียบราคาซอง):</label>
          <input type="number" step="0.1" id="minibossRatioInput" value="${settings.minibossRematchRatio}" style="width:80px" />
          <label>ตัวคูณค่า Rematch บอส:</label>
          <input type="number" step="0.1" id="bossRatioInput" value="${settings.bossRematchRatio}" style="width:80px" />
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

    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
      settings.minibossRematchRatio = Number(document.getElementById('minibossRatioInput').value) || 0.5;
      settings.bossRematchRatio = Number(document.getElementById('bossRatioInput').value) || 1.0;

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
      const listEl = document.getElementById('setManagerList');
      const q = query.toLowerCase();
      const matched = allSets
        .filter((s) => !q || s.set_name.toLowerCase().includes(q) || s.set_code.toLowerCase().includes(q))
        .slice(0, 25);

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
                <td><strong>${App.escapeHtml(s.set_name)}</strong> <span class="muted">(${App.escapeHtml(s.set_code)})</span></td>
                <td class="muted">${App.escapeHtml(s.tcg_date || '-')}</td>
                <td>
                  <select data-set-floor="${App.escapeHtml(s.set_code)}">
                    ${[1, 2, 3, 4, 5, 6, 7]
                      .map((fl) => `<option value="${fl}" ${Number(s.assignedFloor) === fl ? 'selected' : ''}>ชั้น ${fl}</option>`)
                      .join('')}
                  </select>
                </td>
                <td>
                  <select data-set-tpl="${App.escapeHtml(s.set_code)}">
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
          const item = allSets.find((x) => x.set_code === sel.dataset.setFloor);
          if (item) {
            item.assignedFloor = Number(sel.value);
            await db.sets.put(item);
            App.showToast(`ย้าย ${item.set_name} ไปชั้น ${item.assignedFloor} แล้ว`);
          }
        });
      });

      listEl.querySelectorAll('[data-set-tpl]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          const item = allSets.find((x) => x.set_code === sel.dataset.setTpl);
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
