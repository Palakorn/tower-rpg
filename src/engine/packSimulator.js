(function (root, factory) {
  const Constants =
    typeof module === 'object' && module.exports
      ? require('../constants.js')
      : root.YgoTower.Constants;
  const exported = factory(Constants);
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  } else {
    root.YgoTower = root.YgoTower || {};
    root.YgoTower.PackSimulator = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Constants) {
  /**
   * Normalize a YGOPRODeck set_rarity string into one of:
   * 'common' | 'rare' | 'super' | 'ultra' | 'secret'
   */
  function normalizeRarity(setRarity) {
    const r = (setRarity || '').toLowerCase();
    if (r.includes('secret') || r.includes('starlight') || r.includes('quarter century') || r.includes('prismatic')) {
      return 'secret';
    }
    if (r.includes('ultra') || r.includes('ultimate') || r.includes('ghost') || r.includes('gold')) {
      return 'ultra';
    }
    if (r.includes('super')) {
      return 'super';
    }
    if (r.includes('rare') && !r.includes('common')) {
      return 'rare';
    }
    return 'common';
  }

  /**
   * Pick a key from a weight map: { common: 72, rare: 18, ... }.
   */
  function pickWeightedKey(weights, rng = Math.random) {
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total <= 0) return entries[0]?.[0] || 'common';

    let roll = rng() * total;
    for (const [key, w] of entries) {
      roll -= w;
      if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
  }

  /**
   * Group cards in a set by normalized rarity bucket.
   * @param {Array<{ card: object, setEntry: { set_rarity: string } }>} setCards
   */
  function groupByRarity(setCards) {
    const buckets = {
      common: [],
      rare: [],
      super: [],
      ultra: [],
      secret: [],
    };
    for (const item of setCards) {
      const bucket = normalizeRarity(item.setEntry?.set_rarity);
      buckets[bucket].push(item);
    }
    return buckets;
  }

  /**
   * Pick a random card from the requested rarity bucket, falling back cleanly if empty.
   */
  function pickFromBucket(buckets, desiredRarity, allItems, rng = Math.random) {
    const fallbackOrder = {
      secret: ['secret', 'ultra', 'super', 'rare', 'common'],
      ultra: ['ultra', 'super', 'secret', 'rare', 'common'],
      super: ['super', 'ultra', 'rare', 'common', 'secret'],
      rare: ['rare', 'common', 'super', 'ultra', 'secret'],
      common: ['common', 'rare', 'super', 'ultra', 'secret'],
    };

    const order = fallbackOrder[desiredRarity] || fallbackOrder.common;
    for (const key of order) {
      const pool = buckets[key];
      if (pool && pool.length > 0) {
        const chosen = pool[Math.floor(rng() * pool.length)];
        return {
          card: chosen.card,
          rarity: chosen.setEntry?.set_rarity || key,
          bucket: key,
        };
      }
    }

    const fallback = allItems[Math.floor(rng() * allItems.length)];
    return {
      card: fallback.card,
      rarity: fallback.setEntry?.set_rarity || 'Common',
      bucket: 'common',
    };
  }

  /**
   * Simulate opening one pack of cards.
   * @param {Array<{ card: object, setEntry: { set_rarity: string } }>} setCards
   * @param {'ocg'|'tcg'} templateType
   * @param {object} [settings]
   * @param {function} [rng]
   */
  function openPack(setCards, templateType = 'tcg', settings, rng = Math.random) {
    if (!setCards || setCards.length === 0) {
      throw new Error('ซองนี้ยังไม่มีข้อมูลการ์ดในแคช');
    }

    const pullRates = (settings && settings.pullRates) || Constants.DEFAULT_SETTINGS.pullRates;
    const buckets = groupByRarity(setCards);
    const pulled = [];

    if (templateType === 'ocg') {
      const ocg = pullRates.ocg || Constants.DEFAULT_SETTINGS.pullRates.ocg;
      const count = ocg.cardsPerPack || 5;
      for (let i = 0; i < count; i++) {
        const target = pickWeightedKey(ocg.weights, rng);
        pulled.push(pickFromBucket(buckets, target, setCards, rng));
      }
    } else {
      const tcg = pullRates.tcg || Constants.DEFAULT_SETTINGS.pullRates.tcg;
      const commonCount = tcg.commonSlots ?? 7;
      const rareCount = tcg.rareSlots ?? 1;

      for (let i = 0; i < commonCount; i++) {
        pulled.push(pickFromBucket(buckets, 'common', setCards, rng));
      }
      for (let i = 0; i < rareCount; i++) {
        pulled.push(pickFromBucket(buckets, 'rare', setCards, rng));
      }
      const foilTarget = pickWeightedKey(tcg.foilWeights, rng);
      pulled.push(pickFromBucket(buckets, foilTarget, setCards, rng));
    }

    return pulled;
  }

  /**
   * Filter sets eligible for Event rewards.
   * - 'free_pack' (4 EvP): current floor + at most 1 floor ahead.
   * - 'pick_card' (8 EvP): any pack on any floor, regardless of unlock status.
   */
  function getEventEligibleSets(allSets, currentFloor, eventType = 'free_pack') {
    const sets = allSets || [];
    if (eventType === 'pick_card') {
      return sets.slice();
    }
    const maxFloor = Math.min(7, Number(currentFloor) + 1);
    return sets.filter((s) => Number(s.assignedFloor) <= maxFloor);
  }

  /**
   * Build a map of total owned copies per card name (summing across all artwork IDs).
   * @param {Array<{ id: number|string, name: string }>} allCards
   * @param {Record<string, number>} collection
   */
  function getOwnedCountsByName(allCards, collection) {
    const counts = new Map();
    if (!collection || typeof collection !== 'object') return counts;

    for (const card of allCards || []) {
      if (!card || !card.name) continue;
      const owned = Number(collection[String(card.id)] || 0);
      if (owned > 0) {
        counts.set(card.name, (counts.get(card.name) || 0) + owned);
      }
    }
    return counts;
  }

  /**
   * Get total owned copies for a card, combining name-based count (across artworks) and ID fallback.
   */
  function getCardOwnedCount(card, ownedCountsByName, collection) {
    if (!card) return 0;
    const byName = ownedCountsByName && card.name ? ownedCountsByName.get(card.name) || 0 : 0;
    const byId = collection ? Number(collection[String(card.id)] || 0) : 0;
    return Math.max(byName, byId);
  }

  /**
   * Filter cards eligible for the pick_card EvP reward by floor, set name, and search query.
   * When both floor and setName are 'all', returns all unique canonical cards from allCards
   * (including side sets, structure/starter decks, and promos outside curated tower packs).
   */
  function getPickCardEligibleCards(allSets, allCards, options = {}) {
    const { floor = 'all', setName = 'all', query = '' } = options || {};
    const q = String(query || '').trim().toLowerCase();
    const filterBySet =
      (floor !== 'all' && floor !== '' && floor !== null && floor !== undefined) ||
      (setName && setName !== 'all');

    let targetSetNames = null;
    if (filterBySet) {
      let targetSets = allSets || [];
      if (floor !== 'all' && floor !== '' && floor !== null && floor !== undefined) {
        const floorNum = Number(floor);
        targetSets = targetSets.filter((s) => Number(s.assignedFloor) === floorNum);
      }
      if (setName && setName !== 'all') {
        targetSets = targetSets.filter((s) => s.set_name === setName);
      }
      targetSetNames = new Set(targetSets.map((s) => s.set_name));
    }

    const namesWithSets = new Set();
    if (!filterBySet) {
      for (const c of allCards || []) {
        if (c && c.name && (!c.canonicalId || String(c.canonicalId) === String(c.id)) && Array.isArray(c.card_sets) && c.card_sets.length > 0) {
          namesWithSets.add(c.name);
        }
      }
    }

    const result = [];
    const seenNames = new Set();

    for (const c of allCards || []) {
      if (!c || !c.name) continue;
      if (c.canonicalId && String(c.canonicalId) !== String(c.id)) continue;

      if (filterBySet) {
        if (seenNames.has(c.name)) continue;
        if (!Array.isArray(c.card_sets) || !c.card_sets.some((cs) => targetSetNames.has(cs.set_name))) {
          continue;
        }
      } else {
        if (seenNames.has(c.name)) continue;
        if (Array.isArray(c.card_sets) && c.card_sets.length === 0 && namesWithSets.has(c.name)) {
          continue;
        }
      }

      if (q && !String(c.name).toLowerCase().includes(q)) continue;

      seenNames.add(c.name);
      result.push(c);
    }

    return result;
  }

  return {
    normalizeRarity,
    groupByRarity,
    openPack,
    getEventEligibleSets,
    getOwnedCountsByName,
    getCardOwnedCount,
    getPickCardEligibleCards,
  };
});
