(function (root) {
  root.YgoTower = root.YgoTower || {};

  /**
   * Export all user save data (roster, seasons, settings, hallOfFame) as a JSON string.
   */
  async function exportSaveJson() {
    const db = root.YgoTower.DB.getDB();
    const [roster, seasons, settings, hallOfFame] = await Promise.all([
      db.roster.toArray(),
      db.seasons.toArray(),
      db.settings.toArray(),
      db.hallOfFame.toArray(),
    ]);

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        roster,
        seasons,
        settings,
        hallOfFame,
      },
    };

    return JSON.stringify(payload, null, 2);
  }

  /**
   * Trigger browser file download for a text payload.
   */
  function downloadFile(filename, content, mimeType = 'application/json') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import save JSON and restore roster, seasons, settings, and hallOfFame.
   */
  async function importSaveJson(jsonText) {
    const parsed = JSON.parse(jsonText);
    if (!parsed || !parsed.data) {
      throw new Error('ไฟล์ Save ไม่ถูกต้อง (ไม่พบโครงสร้าง data)');
    }

    const { roster = [], seasons = [], settings = [], hallOfFame = [] } = parsed.data;
    const db = root.YgoTower.DB.getDB();

    await db.transaction('rw', db.roster, db.seasons, db.settings, db.hallOfFame, async () => {
      await db.roster.clear();
      await db.seasons.clear();
      await db.settings.clear();
      await db.hallOfFame.clear();

      if (roster.length) await db.roster.bulkPut(roster);
      if (seasons.length) await db.seasons.bulkPut(seasons);
      if (settings.length) await db.settings.bulkPut(settings);
      if (hallOfFame.length) await db.hallOfFame.bulkPut(hallOfFame);
    });

    return {
      rosterCount: roster.length,
      seasonsCount: seasons.length,
      hallOfFameCount: hallOfFame.length,
    };
  }

  root.YgoTower.SaveManager = {
    exportSaveJson,
    importSaveJson,
    downloadFile,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
