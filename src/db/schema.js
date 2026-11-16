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
    // Rebuild sets store with set_name as primary key so editions sharing set_code (e.g. LOB & LOB 25th) coexist.
    db.version(2).stores({
      sets: null,
    });
    db.version(3).stores({
      sets: 'set_name, set_code, tcg_date, assignedFloor',
    });
    db.version(4).stores({
      recipes: '++id, name, updatedAt',
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

  /**
   * Get all saved deck recipes ordered by most recently updated first.
   */
  async function getRecipes() {
    const db = getDB();
    return db.recipes.orderBy('updatedAt').reverse().toArray();
  }

  /**
   * Save or update a deck recipe (enforces MAX_RECIPES limit on new recipes).
   */
  async function saveRecipe(recipe) {
    const db = getDB();
    const maxRecipes = (root.YgoTower.Constants && root.YgoTower.Constants.MAX_RECIPES) || 20;
    const now = new Date().toISOString();

    const record = {
      ...recipe,
      name: String(recipe.name || 'Untitled Recipe').trim() || 'Untitled Recipe',
      main: Array.isArray(recipe.main) ? recipe.main : [],
      extra: Array.isArray(recipe.extra) ? recipe.extra : [],
      side: Array.isArray(recipe.side) ? recipe.side : [],
      updatedAt: now,
    };

    if (record.id) {
      await db.recipes.put(record);
      return record.id;
    }

    const currentCount = await db.recipes.count();
    if (currentCount >= maxRecipes) {
      throw new Error(`บันทึก Recipe ได้สูงสุด ${maxRecipes} Deck กรุณาลบ Deck เดิมก่อน`);
    }

    record.createdAt = now;
    const id = await db.recipes.add(record);
    record.id = id;
    return id;
  }

  /**
   * Delete a saved deck recipe by ID.
   */
  async function deleteRecipe(id) {
    const db = getDB();
    await db.recipes.delete(id);
  }

  root.YgoTower.DB = {
    getDB,
    getSettings,
    saveSettings,
    getActiveSeason,
    saveSeason,
    getRecipes,
    saveRecipe,
    deleteRecipe,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
