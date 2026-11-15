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
   * Fetch all card sets and cards from YGOPRODeck API and cache in IndexedDB.
   * Preserves any user-customized assignedFloor / templateType if the set already exists.
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

    // Preserve user custom floor assignments if already cached
    const existingSets = await db.sets.toArray();
    const existingMap = new Map(existingSets.map((s) => [s.set_code, s]));

    const mappedSets = rawSets
      .filter((s) => s.set_code && s.set_name)
      .map((s) => {
        const prev = existingMap.get(s.set_code);
        return {
          set_code: s.set_code,
          set_name: s.set_name,
          num_of_cards: s.num_of_cards || 0,
          tcg_date: s.tcg_date || '',
          assignedFloor: prev ? prev.assignedFloor : assignFloorByDate(s.tcg_date),
          templateType: prev ? prev.templateType : guessTemplateType(s),
        };
      });

    report(`กำลังบันทึกซองการ์ด ${mappedSets.length} ซองลง IndexedDB...`, 25);
    await db.sets.bulkPut(mappedSets);

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
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
