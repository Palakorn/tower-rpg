(function (root) {
  root.YgoTower = root.YgoTower || {};
  root.YgoTower.Views = root.YgoTower.Views || {};

  async function renderRosterView(container) {
    const App = root.YgoTower.App;
    const Constants = root.YgoTower.Constants;
    const db = root.YgoTower.DB.getDB();

    const roster = await db.roster.toArray();
    const floorOptions = Constants.FLOORS.map(
      (f) => `<option value="${f.floor}">ชั้น ${f.floor}: ${App.escapeHtml(f.name)}</option>`
    ).join('');

    const rowsHtml = roster.length
      ? roster
          .map(
            (c) => `
          <tr>
            <td><strong>${App.escapeHtml(c.name)}</strong></td>
            <td><span class="badge badge-${c.role}">${c.role.toUpperCase()}</span></td>
            <td>ชั้น ${c.preferredFloor}</td>
            <td>${c.ydkRaw ? '✅ มี .ydk' : '—'}</td>
            <td>
              <button class="btn btn-sm btn-danger" data-del-roster="${c.id}">ลบ</button>
            </td>
          </tr>
        `
          )
          .join('')
      : `<tr><td colspan="5" class="muted">ยังไม่มีตัวละครในคลัง (สามารถเพิ่มทีละคน หรือ Bulk Import ไฟล์ .ydk หลายไฟล์พร้อมกันได้)</td></tr>`;

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title">
          <span>➕ เพิ่มตัวละครใหม่</span>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm" id="exportRosterBtn">📥 Export Roster JSON</button>
            <label class="btn btn-sm" style="cursor:pointer;">
              📤 Import Roster JSON
              <input type="file" id="importRosterJsonInput" accept=".json" style="display:none;" />
            </label>
          </div>
        </h3>
        <div class="form-row">
          <input type="text" id="rosterNameInput" placeholder="ชื่อตัวละคร (เช่น Yugi, Kaiba)" style="flex:1; min-width:180px;" />
          <select id="rosterRoleSelect">
            <option value="guard">Guard (ทหารเฝ้ายาม)</option>
            <option value="miniboss">Mini-boss (มินิบอส)</option>
            <option value="boss">Boss (บอสประจำชั้น)</option>
          </select>
          <select id="rosterFloorSelect">${floorOptions}</select>
          <input type="file" id="rosterSingleYdk" accept=".ydk" />
          <button class="btn btn-primary" id="addRosterBtn">เพิ่มตัวละคร</button>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">📦 Bulk Import ไฟล์ .ydk ทีละหลายไฟล์</h3>
        <p class="muted">ระบบจะใช้ชื่อไฟล์เป็นชื่อตัวละครอัตโนมัติ (เช่น <code>Kaiba_DM.ydk</code> → <code>Kaiba_DM</code>)</p>
        <div class="form-row">
          <select id="bulkRoleSelect">
            <option value="guard">Guard</option>
            <option value="miniboss">Mini-boss</option>
            <option value="boss">Boss</option>
          </select>
          <select id="bulkFloorSelect">${floorOptions}</select>
          <input type="file" id="bulkYdkInput" accept=".ydk" multiple />
          <button class="btn btn-gold" id="runBulkImportBtn">นำเข้าทั้งหมด</button>
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">👥 รายชื่อตัวละครทั้งหมด (${roster.length} คน)</h3>
        <table>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>บทบาท</th>
              <th>ชั้นที่สังกัด</th>
              <th>Deck (.ydk)</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    document.getElementById('addRosterBtn').addEventListener('click', async () => {
      const name = document.getElementById('rosterNameInput').value.trim();
      if (!name) {
        App.showToast('กรุณากรอกชื่อตัวละคร');
        return;
      }
      const role = document.getElementById('rosterRoleSelect').value;
      const preferredFloor = Number(document.getElementById('rosterFloorSelect').value);
      const fileEl = document.getElementById('rosterSingleYdk');
      const ydkRaw = fileEl.files && fileEl.files[0] ? await fileEl.files[0].text() : '';

      await db.roster.add({ name, role, preferredFloor, ydkRaw });
      App.showToast(`เพิ่มตัวละคร "${name}" เรียบร้อย`);
      App.renderCurrentView();
    });

    document.getElementById('runBulkImportBtn').addEventListener('click', async () => {
      const files = document.getElementById('bulkYdkInput').files;
      if (!files || !files.length) {
        App.showToast('กรุณาเลือกไฟล์ .ydk อย่างน้อย 1 ไฟล์');
        return;
      }
      const role = document.getElementById('bulkRoleSelect').value;
      const preferredFloor = Number(document.getElementById('bulkFloorSelect').value);

      const items = [];
      for (const f of files) {
        const ydkRaw = await f.text();
        const name = f.name.replace(/\.ydk$/i, '');
        items.push({ name, role, preferredFloor, ydkRaw });
      }
      await db.roster.bulkAdd(items);
      App.showToast(`นำเข้าตัวละคร ${items.length} คนเรียบร้อย!`);
      App.renderCurrentView();
    });

    document.getElementById('exportRosterBtn').addEventListener('click', () => {
      root.YgoTower.SaveManager.downloadFile('ygo_tower_roster.json', JSON.stringify(roster, null, 2));
    });

    document.getElementById('importRosterJsonInput').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (!Array.isArray(parsed)) throw new Error('รูปแบบไฟล์ Roster JSON ไม่ถูกต้อง');
        const cleaned = parsed.map((c) => ({
          name: c.name || 'Unnamed',
          role: c.role || 'guard',
          preferredFloor: Number(c.preferredFloor) || 1,
          ydkRaw: c.ydkRaw || '',
        }));
        await db.roster.bulkAdd(cleaned);
        App.showToast(`นำเข้าตัวละคร ${cleaned.length} คนเรียบร้อย`);
        App.renderCurrentView();
      } catch (err) {
        App.showToast(err.message);
      }
    });

    container.querySelectorAll('[data-del-roster]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await db.roster.delete(Number(btn.dataset.delRoster));
        App.renderCurrentView();
      });
    });
  }

  root.YgoTower.Views.renderRosterView = renderRosterView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
