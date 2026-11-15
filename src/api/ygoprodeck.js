(function (root) {
  root.YgoTower = root.YgoTower || {};

  const API_BASE = 'https://db.ygoprodeck.com/api/v7';

  /**
   * Map a set's release date (YYYY-MM-DD) to one of the 7 tower floors.
   */
  function assignFloorByDate(tcgDate) {
    const FLOORS = root.YgoTower.Constants.FLOORS;
    if (!tcgDate) return 1;
    const year = parseInt(String(tcgDate).slice(0, 4), 10);
    if (Number.isNaN(year)) return 1;

    for (const f of FLOORS) {
      if (year >= f.yearMin && year <= f.yearMax) {
        return f.floor;
      }
    }
    return year < FLOORS[0].yearMin ? 1 : 7;
  }

  /**
   * Guess default pack template ('ocg' or 'tcg') based on set_name / set_code.
   */
  function guessTemplateType(set) {
    const name = (set.set_name || '').toLowerCase();
    if (name.includes('ocg') || name.includes('japan')) return 'ocg';
    return 'tcg';
  }

  /**
   * Filter raw API/cached sets down to the curated pack list and apply floor + thumbnail mapping.
   */
  function filterAndMapCuratedSets(rawSets, existingSets = [], preserveFloor = false) {
    const Constants = root.YgoTower.Constants;
    const existingMap = new Map(existingSets.map((s) => [s.set_code, s]));

    const mapped = [];
    for (const s of rawSets) {
      if (!s || !s.set_code || !s.set_name) continue;
      const curated = Constants.findCuratedPack(s);
      if (!curated) continue;

      const prev = existingMap.get(s.set_code);
      mapped.push({
        set_code: s.set_code,
        set_name: s.set_name,
        num_of_cards: s.num_of_cards || 0,
        tcg_date: s.tcg_date || curated.tcg_date || '',
        set_image: s.set_image || Constants.getPackImageUrl(s),
        assignedFloor: preserveFloor && prev ? prev.assignedFloor : curated.floor,
        templateType: prev ? prev.templateType : guessTemplateType(s),
        _order: curated.order,
      });
    }

    mapped.sort((a, b) => a._order - b._order);
    return mapped.map(({ _order, ...rest }) => rest);
  }

  const MAPPING_VERSION_KEY = 'ygo_tower_pack_mapping_version';

  /**
   * Migrate an existing IndexedDB sets cache so only the curated packs remain with updated floor mapping & thumbnails.
   */
  async function migrateCachedSetsIfNeeded() {
    const Constants = root.YgoTower.Constants;
    const db = root.YgoTower.DB.getDB();
    const existingSets = await db.sets.toArray();
    if (!existingSets.length) return false;

    const targetVersion = String(Constants.CURATED_MAPPING_VERSION || 1);
    const savedVersion =
      typeof localStorage !== 'undefined' ? localStorage.getItem(MAPPING_VERSION_KEY) : null;

    const needsMigration =
      savedVersion !== targetVersion ||
      existingSets.length !== Constants.CURATED_PACKS.length ||
      existingSets.some((s) => !Constants.findCuratedPack(s) || !s.set_image);

    if (!needsMigration) return false;

    const existingMap = new Map(existingSets.map((s) => [s.set_code.toUpperCase(), s]));
    const migrated = Constants.CURATED_PACKS.map((curated) => {
      const prev = existingMap.get(curated.set_code.toUpperCase());
      return {
        set_code: prev?.set_code || curated.set_code,
        set_name: prev?.set_name || curated.set_name,
        num_of_cards: prev?.num_of_cards || 0,
        tcg_date: prev?.tcg_date || curated.tcg_date,
        set_image: prev?.set_image || Constants.getPackImageUrl(curated),
        assignedFloor: curated.floor,
        templateType: prev?.templateType || guessTemplateType(curated),
      };
    });

    await db.sets.clear();
    await db.sets.bulkPut(migrated);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MAPPING_VERSION_KEY, targetVersion);
    }
    return true;
  }

  /**
   * Fetch curated card sets and cards from YGOPRODeck API and cache in IndexedDB.
   */
  async function syncFromApi(onProgress) {
    const db = root.YgoTower.DB.getDB();
    const report = (msg, pct) => {
      if (typeof onProgress === 'function') onProgress(msg, pct);
    };

    report('กำลังดึงรายชื่อซองการ์ด (Card Sets) จาก YGOPRODeck...', 10);
    const setsRes = await fetch(`${API_BASE}/cardsets.php`);
    if (!setsRes.ok) {
      throw new Error(`โหลด Card Sets ไม่สำเร็จ (${setsRes.status})`);
    }
    const rawSets = await setsRes.json();

    // Preserve user templateType if already cached; enforce curated pack whitelist + floor mapping
    const existingSets = await db.sets.toArray();
    const mappedSets = filterAndMapCuratedSets(rawSets, existingSets, false);

    report(`กำลังบันทึกซองการ์ด ${mappedSets.length} ซองลง IndexedDB...`, 25);
    await db.sets.clear();
    await db.sets.bulkPut(mappedSets);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MAPPING_VERSION_KEY, String(root.YgoTower.Constants.CURATED_MAPPING_VERSION || 1));
    }

    report('กำลังดึงข้อมูลการ์ดทั้งหมดจาก YGOPRODeck (อาจใช้เวลาสักครู่)...', 40);
    const cardsRes = await fetch(`${API_BASE}/cardinfo.php`);
    if (!cardsRes.ok) {
      throw new Error(`โหลดข้อมูลการ์ดไม่สำเร็จ (${cardsRes.status})`);
    }
    const cardsJson = await cardsRes.json();
    const rawCards = cardsJson.data || [];

    report(`กำลังจัดเตรียมข้อมูลการ์ด ${rawCards.length} ใบ...`, 70);
    const compactCards = rawCards.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type || '',
      frameType: c.frameType || '',
      desc: c.desc || '',
      race: c.race || '',
      attribute: c.attribute || '',
      atk: c.atk ?? null,
      def: c.def ?? null,
      level: c.level ?? null,
      card_sets: (c.card_sets || []).map((cs) => ({
        set_name: cs.set_name,
        set_code: cs.set_code,
        set_rarity: cs.set_rarity || 'Common',
        set_rarity_code: cs.set_rarity_code || '(C)',
      })),
      image_url: c.card_images && c.card_images[0] ? c.card_images[0].image_url_small : '',
    }));

    // Write in chunks to keep UI responsive
    const CHUNK_SIZE = 2000;
    for (let i = 0; i < compactCards.length; i += CHUNK_SIZE) {
      const chunk = compactCards.slice(i, i + CHUNK_SIZE);
      await db.cards.bulkPut(chunk);
      const pct = 70 + Math.round(((i + chunk.length) / compactCards.length) * 30);
      report(`กำลังบันทึกการ์ดลง IndexedDB (${Math.min(i + chunk.length, compactCards.length)}/${compactCards.length})...`, pct);
    }

    report('ซิงค์ข้อมูลการ์ดและซองเรียบร้อยแล้ว!', 100);
    return {
      setsCount: mappedSets.length,
      cardsCount: compactCards.length,
    };
  }

  /**
   * Check how many cards and sets are currently cached in IndexedDB.
   */
  async function getCacheStats() {
    const db = root.YgoTower.DB.getDB();
    const [cardsCount, setsCount] = await Promise.all([db.cards.count(), db.sets.count()]);
    return { cardsCount, setsCount };
  }

  /**
   * Get all cards belonging to a specific set_name.
   */
  async function getCardsInSet(setName) {
    const db = root.YgoTower.DB.getDB();
    const allCards = await db.cards.toArray();
    const result = [];
    for (const card of allCards) {
      if (!card.card_sets) continue;
      const match = card.card_sets.find((cs) => cs.set_name === setName);
      if (match) {
        result.push({ card, setEntry: match });
      }
    }
    return result;
  }

  root.YgoTower.Api = {
    syncFromApi,
    getCacheStats,
    getCardsInSet,
    assignFloorByDate,
    filterAndMapCuratedSets,
    migrateCachedSetsIfNeeded,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
