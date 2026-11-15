(function (root) {
  root.YgoTower = root.YgoTower || {};

  let dbInstance = null;

  /**
   * Initialize and return the Dexie IndexedDB instance.
   */
  function getDB() {
    if (dbInstance) return dbInstance;
    if (typeof Dexie === 'undefined') {
      throw new Error('Dexie.js is not loaded.');
    }

    const db = new Dexie('YgoTowerRPG_DB');
    db.version(1).stores({
      cards: 'id, name, frameType, type',
      sets: 'set_code, set_name, tcg_date, assignedFloor',
      roster: '++id, name, role, preferredFloor',
      seasons: '++id, name, status, createdAt',
      settings: 'id',
      hallOfFame: '++id, seasonName, completedAt',
    });

    dbInstance = db;
    return dbInstance;
  }

  /**
   * Load global settings, initializing defaults if missing.
   */
  async function getSettings() {
    const db = getDB();
    let settings = await db.settings.get('global');
    if (!settings) {
      settings = structuredClone(root.YgoTower.Constants.DEFAULT_SETTINGS);
      await db.settings.put(settings);
    }
    return settings;
  }

  /**
   * Save global settings.
   */
  async function saveSettings(settings) {
    const db = getDB();
    settings.id = 'global';
    await db.settings.put(settings);
    return settings;
  }

  /**
   * Get the currently active season, or null if none exists.
   */
  async function getActiveSeason() {
    const db = getDB();
    const seasons = await db.seasons.where('status').equals('active').toArray();
    return seasons[0] || null;
  }

  /**
   * Save or update a season record.
   */
  async function saveSeason(season) {
    const db = getDB();
    if (season.id) {
      await db.seasons.put(season);
      return season.id;
    }
    const id = await db.seasons.add(season);
    season.id = id;
    return id;
  }

  root.YgoTower.DB = {
    getDB,
    getSettings,
    saveSettings,
    getActiveSeason,
    saveSeason,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
