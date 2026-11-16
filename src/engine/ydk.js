(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  } else {
    root.YgoTower = root.YgoTower || {};
    root.YgoTower.Ydk = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /**
   * Parse a .ydk text string into { main, extra, side } arrays of numeric passcodes.
   */
  function parseYdk(text) {
    const deck = { main: [], extra: [], side: [] };
    if (!text) return deck;

    let section = 'main';
    const lines = String(text).split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line === '#main') {
        section = 'main';
        continue;
      }
      if (line === '#extra') {
        section = 'extra';
        continue;
      }
      if (line === '!side') {
        section = 'side';
        continue;
      }
      if (line.startsWith('#') || line.startsWith('!')) {
        continue;
      }

      const id = parseInt(line, 10);
      if (!Number.isNaN(id) && id > 0) {
        deck[section].push(id);
      }
    }

    return deck;
  }

  /**
   * Generate a .ydk formatted string from { main, extra, side }.
   */
  function generateYdk(deck) {
    const main = (deck && deck.main) || [];
    const extra = (deck && deck.extra) || [];
    const side = (deck && deck.side) || [];

    const parts = ['#created by YgoTowerRPG', '#main', ...main.map(String), '#extra', ...extra.map(String), '!side', ...side.map(String), ''];
    return parts.join('\n');
  }

  /**
   * Count total copies of each card ID in a deck, and add them to a collection map.
   */
  function addDeckToCollection(collection, deck) {
    const next = { ...(collection || {}) };
    const allIds = [...(deck.main || []), ...(deck.extra || []), ...(deck.side || [])];
    for (const id of allIds) {
      const key = String(id);
      next[key] = (next[key] || 0) + 1;
    }
    return next;
  }

  /**
   * Validate deck size, 3-copy limit, and owned collection limits.
   * @param {{ main: number[], extra: number[], side: number[] }} deck
   * @param {Record<string, number>} collection - map of cardId -> owned count
   * @param {Map<number, { name: string }>} [cardLookup] - optional map for name-based 3-copy check
   */
  function validateDeck(deck, collection, cardLookup) {
    const errors = [];
    const main = (deck && deck.main) || [];
    const extra = (deck && deck.extra) || [];
    const side = (deck && deck.side) || [];

    if (main.length < 40 || main.length > 60) {
      errors.push(`Main Deck ต้องมี 40–60 ใบ (ปัจจุบันมี ${main.length} ใบ)`);
    }
    if (extra.length > 15) {
      errors.push(`Extra Deck ต้องไม่เกิน 15 ใบ (ปัจจุบันมี ${extra.length} ใบ)`);
    }
    if (side.length > 15) {
      errors.push(`Side Deck ต้องไม่เกิน 15 ใบ (ปัจจุบันมี ${side.length} ใบ)`);
    }

    const idCounts = new Map();
    const nameCounts = new Map();

    for (const id of [...main, ...extra, ...side]) {
      idCounts.set(id, (idCounts.get(id) || 0) + 1);
      if (cardLookup && cardLookup.has(id)) {
        const name = cardLookup.get(id).name;
        nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
      }
    }

    for (const [id, count] of idCounts.entries()) {
      const owned = (collection && collection[String(id)]) || 0;
      if (count > owned) {
        const label = cardLookup && cardLookup.has(id) ? cardLookup.get(id).name : `#${id}`;
        errors.push(`การ์ด ${label} ใส่ ${count} ใบ เกินจำนวนที่มีในคลัง (${owned} ใบ)`);
      }
      if (!cardLookup && count > 3) {
        errors.push(`การ์ด #${id} ใส่เกิน 3 ใบ (${count} ใบ)`);
      }
    }

    if (cardLookup) {
      for (const [name, count] of nameCounts.entries()) {
        if (count > 3) {
          errors.push(`การ์ด "${name}" ใส่เกิน 3 ใบ (${count} ใบ)`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      counts: {
        main: main.length,
        extra: extra.length,
        side: side.length,
      },
    };
  }

  /**
   * Evaluate a recipe deck against the player's card collection.
   * Each card copy gets owned=true (opacity 1) if available in collection, or owned=false (opacity 0.5).
   * @param {{ main: number[], extra: number[], side: number[] }} deck
   * @param {Record<string, number>} collection
   */
  function evaluateRecipeAgainstCollection(deck, collection) {
    const remaining = new Map();
    if (collection && typeof collection === 'object') {
      for (const [k, v] of Object.entries(collection)) {
        const count = Number(v) || 0;
        if (count > 0) remaining.set(String(k), count);
      }
    }

    let totalCards = 0;
    let ownedCards = 0;

    const mapZone = (ids) =>
      (ids || []).map((id) => {
        const key = String(id);
        const avail = remaining.get(key) || 0;
        const owned = avail > 0;
        if (owned) {
          remaining.set(key, avail - 1);
          ownedCards += 1;
        }
        totalCards += 1;
        return {
          id,
          owned,
          opacity: owned ? 1 : 0.5,
        };
      });

    const main = mapZone(deck && deck.main);
    const extra = mapZone(deck && deck.extra);
    const side = mapZone(deck && deck.side);
    const missingCards = totalCards - ownedCards;
    const completionPct = totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0;

    return {
      main,
      extra,
      side,
      stats: {
        totalCards,
        ownedCards,
        missingCards,
        completionPct,
      },
    };
  }

  return {
    parseYdk,
    generateYdk,
    addDeckToCollection,
    validateDeck,
    evaluateRecipeAgainstCollection,
  };
});
