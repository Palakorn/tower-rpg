(function (root) {
  root.YgoTower = root.YgoTower || {};
  root.YgoTower.Views = root.YgoTower.Views || {};

  async function renderHallOfFameView(container) {
    const App = root.YgoTower.App;
    const db = root.YgoTower.DB.getDB();
    const entries = await db.hallOfFame.toArray();

    const rowsHtml = entries.length
      ? entries
          .slice()
          .reverse()
          .map(
            (e) => `
          <tr>
            <td><strong>${App.escapeHtml(e.seasonName)}</strong></td>
            <td><span class="badge" style="color:var(--gold); border-color:var(--gold);">👑 ${App.escapeHtml(e.title)}</span></td>
            <td>${e.finalDp} DP</td>
            <td>${e.collectionCount} ใบ</td>
            <td class="muted">${new Date(e.completedAt).toLocaleString('th-TH')}</td>
          </tr>
        `
          )
          .join('')
      : `<tr><td colspan="5" class="muted">ยังไม่มีผู้พิชิตหอคอยครบ 7 ชั้น — เอาชนะบอสชั้น 7 เพื่อรับฉายา King of Duelist!</td></tr>`;

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title">🏆 Hall of Fame — ทำเนียบ King of Duelist</h3>
        <table>
          <thead>
            <tr>
              <th>Season</th>
              <th>ฉายา</th>
              <th>DP คงเหลือ</th>
              <th>การ์ดในคลัง</th>
              <th>วันที่พิชิต</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  root.YgoTower.Views.renderHallOfFameView = renderHallOfFameView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
