(function (root) {
  root.YgoTower = root.YgoTower || {};
  root.YgoTower.Views = root.YgoTower.Views || {};

  async function openNewSeasonModal() {
    const App = root.YgoTower.App;
    const DB = root.YgoTower.DB;
    const db = DB.getDB();

    const allSeasons = await db.seasons.toArray();
    const lastSeason = allSeasons[allSeasons.length - 1] || null;

    App.openModal(`
      <h3 class="card-title">🌟 สร้าง Season ใหม่</h3>
      <div class="form-row">
        <label>ชื่อ Season:</label>
        <input type="text" id="newSeasonName" value="Season ${allSeasons.length + 1}" style="flex:1" />
      </div>
      <div class="form-row">
        <label>รูปแบบการเริ่ม:</label>
        <select id="newSeasonMode" style="flex:1">
          <option value="fresh">Fresh Start (เริ่มใหม่หมด: คลังการ์ดใหม่ + 0 DP)</option>
          ${
            lastSeason
              ? `<option value="carryover">Carry Over / New Game+ (นำคลังการ์ดและ ${lastSeason.dp} DP จาก ${App.escapeHtml(lastSeason.name)} มาใช้ต่อ)</option>`
              : ''
          }
        </select>
      </div>
      <div class="form-row">
        <label>Starter Deck (.ydk):</label>
        <input type="file" id="starterYdkFile" accept=".ydk" />
      </div>
      <p class="muted">การ์ดใน Starter Deck จะถูกเพิ่มเข้าคลังการ์ด (Collection) ของ Season นี้โดยอัตโนมัติ</p>
      <div class="form-row" style="justify-content:flex-end; margin-top:16px;">
        <button class="btn" id="cancelSeasonBtn">ยกเลิก</button>
        <button class="btn btn-gold" id="confirmSeasonBtn">เริ่ม Season!</button>
      </div>
    `);

    document.getElementById('cancelSeasonBtn').addEventListener('click', App.closeModal);
    document.getElementById('confirmSeasonBtn').addEventListener('click', async () => {
      const name = document.getElementById('newSeasonName').value.trim() || `Season ${allSeasons.length + 1}`;
      const mode = document.getElementById('newSeasonMode').value;
      const fileInput = document.getElementById('starterYdkFile');

      let starterDeck = { main: [], extra: [], side: [] };
      if (fileInput.files && fileInput.files[0]) {
        const text = await fileInput.files[0].text();
        starterDeck = root.YgoTower.Ydk.parseYdk(text);
      }

      let collection = {};
      let dp = 0;
      if (mode === 'carryover' && lastSeason) {
        collection = { ...(lastSeason.collection || {}) };
        dp = lastSeason.dp || 0;
      }
      collection = root.YgoTower.Ydk.addDeckToCollection(collection, starterDeck);

      // Mark any previous active seasons as archived
      for (const s of allSeasons) {
        if (s.status === 'active') {
          s.status = 'archived';
          await DB.saveSeason(s);
        }
      }

      const settings = await DB.getSettings();
      const roster = await db.roster.toArray();
      const newSeason = {
        name,
        mode,
        status: 'active',
        createdAt: new Date().toISOString(),
        currentFloor: 1,
        dp,
        winCounter: 0,
        unlockedFloors: [],
        pendingEvents: [],
        collection,
        playerDeck: starterDeck,
        floorState: root.YgoTower.Tower.createFloorState(1, roster, settings),
      };

      await DB.saveSeason(newSeason);
      App.closeModal();
      App.showToast(`เริ่ม ${name} เรียบร้อย!`);
      App.renderCurrentView();
    });
  }

  async function renderTowerView(container, state) {
    const App = root.YgoTower.App;
    const Constants = root.YgoTower.Constants;
    const Tower = root.YgoTower.Tower;
    const DB = root.YgoTower.DB;
    const db = DB.getDB();

    const season = state.activeSeason;
    const settings = state.settings;

    if (!season) {
      container.innerHTML = `
        <div class="card" style="text-align:center; padding:40px 20px;">
          <h2>🏰 ยินดีต้อนรับสู่ Yu-Gi-Oh! Tower RPG</h2>
          <p class="muted">ยังไม่มี Season ที่กำลังเล่นอยู่ในขณะนี้ กดสร้าง Season ใหม่เพื่อเริ่มต้นไต่หอคอย 7 ชั้น</p>
          <div style="margin-top:16px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
            <button class="btn btn-gold" id="startSeasonBtn">🌟 เริ่ม Season ใหม่</button>
            <button class="btn" id="goSettingsBtn">⚙️ ซิงค์การ์ด YGOPRODeck ก่อน</button>
            <button class="btn" id="goRosterBtn">👥 จัดการตัวละครคู่ต่อสู้</button>
          </div>
        </div>
      `;
      document.getElementById('startSeasonBtn').addEventListener('click', openNewSeasonModal);
      document.getElementById('goSettingsBtn').addEventListener('click', () => App.switchTab('settings'));
      document.getElementById('goRosterBtn').addEventListener('click', () => App.switchTab('roster'));
      return;
    }

    const currentFloorMeta = Constants.FLOORS.find((f) => f.floor === season.currentFloor);
    const fs = season.floorState;

    const floorSidebarHtml = Constants.FLOORS.slice()
      .reverse()
      .map((f) => {
        const isCurrent = f.floor === season.currentFloor;
        const isCleared = (season.unlockedFloors || []).includes(f.floor);
        return `
          <div class="floor-item ${isCurrent ? 'active' : ''} ${isCleared ? 'cleared' : ''}">
            <div>
              <strong>ชั้น ${f.floor}: ${App.escapeHtml(f.name)}</strong>
              <div class="muted">${App.escapeHtml(f.era)}</div>
            </div>
            <span>${isCleared ? '✅' : isCurrent ? '⚔️' : '🔒'}</span>
          </div>
        `;
      })
      .join('');

    let penaltyHtml = '';
    if (fs.pendingPenalty) {
      const p = fs.pendingPenalty;
      const canAfford = season.dp >= p.rematchCost;
      penaltyHtml = `
        <div class="alert-box danger">
          <strong>💥 คุณพ่ายแพ้ให้กับ ${p.role === 'boss' ? 'บอสประจำชั้น' : 'มินิบอส'}!</strong>
          <p class="muted" style="margin:6px 0 10px;">
            เลือกจ่าย <strong>${p.rematchCost} DP</strong> เพื่อขอ Rematch ตัวเดิมทันที หรือกลับไปตีทหารยามใหม่ (มินิบอสที่ชนะแล้วจะยังคง Checkpoint ไว้)
          </p>
          <div class="form-row" style="margin:0;">
            <button class="btn btn-gold" id="payRematchBtn" ${canAfford ? '' : 'disabled'}>
              ⚡ จ่าย ${p.rematchCost} DP เพื่อ Rematch ทันที
            </button>
            <button class="btn btn-danger" id="returnGuardsBtn">
              🔄 กลับไปสู้ทหารยามใหม่
            </button>
          </div>
        </div>
      `;
    }

    const renderOpponents = (list, role, activePhase) => {
      return list
        .map((opp, idx) => {
          const isBoss = role === 'boss';
          const canFight = !fs.pendingPenalty && fs.phase === activePhase && !opp.defeated;
          const bo3Text = isBoss ? `<div class="muted">สกอร์ Bo3: ${opp.bo3Wins} - ${opp.bo3Losses} (ชนะ 2 ใน 3)</div>` : '';
          return `
            <div class="opponent-card ${opp.defeated ? 'defeated' : ''}">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="badge badge-${role}">${role.toUpperCase()} (${isBoss ? 'Bo3' : 'Bo1'})</span>
                <span>${opp.defeated ? '✅ ชนะแล้ว' : ''}</span>
              </div>
              <strong>${App.escapeHtml(opp.name)}</strong>
              ${bo3Text}
              <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:auto;">
                <button class="btn btn-sm" data-export-ydk="${role}:${idx}" ${opp.ydkRaw ? '' : 'disabled'}>
                  📥 .ydk บอท
                </button>
                <button class="btn btn-sm btn-success" data-duel="${role}:${idx}:win" ${canFight ? '' : 'disabled'}>
                  🏆 ชนะ
                </button>
                <button class="btn btn-sm btn-danger" data-duel="${role}:${idx}:lose" ${canFight ? '' : 'disabled'}>
                  💀 แพ้
                </button>
              </div>
            </div>
          `;
        })
        .join('');
    };

    const eco = Tower.getFloorEconomy(season.currentFloor, settings);

    container.innerHTML = `
      <div class="grid-2">
        <div>
          <div class="card">
            <h3 class="card-title">
              <span>🗼 หอคอย 7 ชั้น</span>
              <button class="btn btn-sm" id="newSeasonTopBtn">+ Season ใหม่</button>
            </h3>
            <div class="floor-list">${floorSidebarHtml}</div>
          </div>
        </div>

        <div>
          <div class="card">
            <h2 class="card-title">
              <span>ชั้นที่ ${currentFloorMeta.floor}: ${App.escapeHtml(currentFloorMeta.name)} (${App.escapeHtml(currentFloorMeta.era)})</span>
              <span class="badge">ชนะ +${eco.winDp} DP / แพ้ +${eco.lossDp} DP</span>
            </h2>
            <p class="muted">${App.escapeHtml(currentFloorMeta.description)}</p>
            ${penaltyHtml}
          </div>

          <div class="card">
            <h3 class="card-title">🛡️ ด่านที่ 1: ทหารเฝ้ายาม (Bo1) ${fs.phase === 'guards' ? '— กำลังสู้' : '— ผ่านแล้ว'}</h3>
            <div class="opponent-grid">${renderOpponents(fs.guards, 'guard', 'guards')}</div>
          </div>

          <div class="card">
            <h3 class="card-title">⚔️ ด่านที่ 2: มินิบอส (Bo1 / Checkpoint) ${fs.phase === 'minibosses' ? '— กำลังสู้' : ''}</h3>
            <div class="opponent-grid">${renderOpponents(fs.minibosses, 'miniboss', 'minibosses')}</div>
          </div>

          <div class="card">
            <h3 class="card-title">👑 ด่านที่ 3: บอสประจำชั้น (Bo3) ${fs.phase === 'boss' ? '— กำลังสู้' : ''}</h3>
            <div class="opponent-grid">${renderOpponents([fs.boss], 'boss', 'boss')}</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('newSeasonTopBtn').addEventListener('click', openNewSeasonModal);

    if (fs.pendingPenalty) {
      document.getElementById('payRematchBtn').addEventListener('click', async () => {
        try {
          Tower.payRematch(season);
          await DB.saveSeason(season);
          App.showToast('จ่าย DP ขอ Rematch สำเร็จ!');
          App.renderCurrentView();
        } catch (err) {
          App.showToast(err.message);
        }
      });

      document.getElementById('returnGuardsBtn').addEventListener('click', async () => {
        Tower.returnToGuards(season);
        await DB.saveSeason(season);
        App.showToast('กลับไปสู้ทหารยามใหม่ (Checkpoint มินิบอสยังคงอยู่)');
        App.renderCurrentView();
      });
    }

    container.querySelectorAll('[data-export-ydk]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [role, idxStr] = btn.dataset.exportYdk.split(':');
        const idx = Number(idxStr);
        const opp = role === 'guard' ? fs.guards[idx] : role === 'miniboss' ? fs.minibosses[idx] : fs.boss;
        if (!opp || !opp.ydkRaw) return;
        const safeName = opp.name.replace(/[^a-z0-9ก-๙_-]/gi, '_');
        root.YgoTower.SaveManager.downloadFile(`${safeName}.ydk`, opp.ydkRaw, 'text/plain');
      });
    });

    container.querySelectorAll('[data-duel]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const [role, idxStr, outcome] = btn.dataset.duel.split(':');
        const idx = Number(idxStr);
        const won = outcome === 'win';
        const roster = await db.roster.toArray();

        try {
          const res = Tower.recordDuelResult(season, role, idx, won, roster, settings);
          await DB.saveSeason(season);

          if (res.seasonCompleted) {
            await db.hallOfFame.add({
              seasonName: season.name,
              title: 'King of Duelist',
              completedAt: season.completedAt,
              finalDp: season.dp,
              collectionCount: Object.values(season.collection || {}).reduce((a, b) => a + b, 0),
            });
            App.showToast('🏆 ยินดีด้วย! คุณเคลียร์หอคอยครบ 7 ชั้น ได้รับฉายา King of Duelist!');
          } else if (res.floorCleared) {
            App.showToast(`🎉 ผ่านชั้นที่ ${season.currentFloor - 1} แล้ว! ปลดล็อกซองและขึ้นสู่ชั้นที่ ${season.currentFloor}`);
          } else if (res.dpEarned > 0) {
            App.showToast(`${won ? 'ชนะ' : 'แพ้'}! ได้รับ +${res.dpEarned} DP`);
          }

          if (res.triggeredEvent === 'free_pack') {
            App.showToast('🎁 ครบ 4 ชนะ! ได้รับสิทธิ์เปิดซองฟรีในหน้า ร้านค้า & เปิดซอง');
          } else if (res.triggeredEvent === 'pick_card') {
            App.showToast('🌟 ครบ 8 ชนะ! ได้รับสิทธิ์เลือกการ์ดฟรี 1 ใบในหน้า ร้านค้า & เปิดซอง');
          }

          App.renderCurrentView();
        } catch (err) {
          App.showToast(err.message);
        }
      });
    });
  }

  root.YgoTower.Views.renderTowerView = renderTowerView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
