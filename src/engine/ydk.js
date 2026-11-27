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

  function encodeUint32Base64(ids) {
    const list = Array.isArray(ids) ? ids : [];
    const bytes = new Uint8Array(list.length * 4);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < list.length; i++) {
      const id = Number(list[i]);
      if (!Number.isInteger(id) || id <= 0 || id > 0xffffffff) {
        throw new Error(`รหัสการ์ดไม่ถูกต้อง: ${list[i]}`);
      }
      view.setUint32(i * 4, id, true);
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function decodeUint32Base64(b64, zoneLabel) {
    if (!b64) return [];
    if (/\s/.test(b64) || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length % 4 !== 0) {
      throw new Error(`รูปแบบ Base64 ในโซน ${zoneLabel} ไม่ถูกต้อง`);
    }
    let binary;
    try {
      binary = atob(b64);
    } catch {
      throw new Error(`รูปแบบ Base64 ในโซน ${zoneLabel} ไม่ถูกต้อง`);
    }
    if (binary.length % 4 !== 0) {
      throw new Error(`ข้อมูลไบต์ในโซน ${zoneLabel} ไม่สมบูรณ์ (ต้องหาร 4 ลงตัว)`);
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const view = new DataView(bytes.buffer);
    const ids = [];
    for (let i = 0; i < bytes.length; i += 4) {
      const id = view.getUint32(i, true);
      if (id <= 0) {
        throw new Error(`พบรหัสการ์ดที่ไม่ถูกต้อง (${id}) ในโซน ${zoneLabel}`);
      }
      ids.push(id);
    }
    return ids;
  }

  /**
   * Parse a ydke:// URI string into { main, extra, side } arrays of numeric passcodes.
   * Throws an Error with a descriptive message if the URI format is invalid.
   * @param {string} uri
   */
  function parseYdke(uri) {
    const trimmed = String(uri ?? '').trim();
    if (!trimmed) {
      throw new Error('กรุณากรอกลิงก์ ydke://...');
    }
    if (!trimmed.startsWith('ydke://')) {
      throw new Error('ลิงก์ต้องขึ้นต้นด้วย ydke://');
    }

    const payload = trimmed.slice('ydke://'.length);
    const parts = payload.split('!');
    const isValidFourParts = parts.length === 4 && parts[3] === '';
    const isValidThreeParts = parts.length === 3;
    if (!isValidFourParts && !isValidThreeParts) {
      throw new Error('รูปแบบ YDKE ต้องประกอบด้วย 3 โซนคั่นด้วยเครื่องหมาย ! (ydke://main!extra!side!)');
    }

    return {
      main: decodeUint32Base64(parts[0], 'Main Deck'),
      extra: decodeUint32Base64(parts[1], 'Extra Deck'),
      side: decodeUint32Base64(parts[2], 'Side Deck'),
    };
  }

  /**
   * Generate a ydke:// URI string from { main, extra, side }.
   * @param {{ main?: number[], extra?: number[], side?: number[] }} deck
   */
  function generateYdke(deck) {
    const main = encodeUint32Base64((deck && deck.main) || []);
    const extra = encodeUint32Base64((deck && deck.extra) || []);
    const side = encodeUint32Base64((deck && deck.side) || []);
    return `ydke://${main}!${extra}!${side}!`;
  }

  const PLAINTEXT_SECTION_RE =
    /^(?:[-=]+\s*)?(main|extra|side)(?:\s+deck)?(?:\s*\(\s*\d+\s*\))?\s*:?(?:\s*[-=]+)?$/i;
  const PLAINTEXT_CARD_RE = /^(\d+)(?:\s*[x×])?\s+(.+)$/i;

  /**
   * Parse a plaintext decklist string into { main, extra, side } arrays of { count, name }.
   * Supports headers like "Main Deck:", "Extra Deck:", "Side DecK:" (case-insensitive)
   * and card lines like "2 Dark Magician" or "3  Nitro Warrior".
   * @param {string} text
   */
  function parsePlaintextDeck(text) {
    const raw = String(text ?? '');
    if (!raw.trim()) {
      throw new Error('กรุณากรอกรายชื่อการ์ดรูปแบบ Plaintext');
    }

    const deck = { main: [], extra: [], side: [] };
    let section = 'main';
    const lines = raw.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith('#') || line.startsWith('//')) continue;

      const secMatch = line.match(PLAINTEXT_SECTION_RE);
      if (secMatch) {
        section = secMatch[1].toLowerCase();
        continue;
      }

      const cardMatch = line.match(PLAINTEXT_CARD_RE);
      if (!cardMatch) {
        throw new Error(
          `รูปแบบบรรทัดที่ ${i + 1} ไม่ถูกต้อง: "${line}" (ต้องเป็น "<จำนวน> <ชื่อการ์ด>" เช่น "2 Dark Magician")`
        );
      }

      const count = parseInt(cardMatch[1], 10);
      if (!Number.isInteger(count) || count <= 0) {
        throw new Error(`จำนวนการ์ดในบรรทัดที่ ${i + 1} ต้องมากกว่า 0: "${line}"`);
      }
      if (count > 60) {
        throw new Error(`จำนวนการ์ดในบรรทัดที่ ${i + 1} มากเกินไป (${count} ใบ): "${line}"`);
      }

      const name = cardMatch[2].trim().replace(/\s+/g, ' ');
      if (!name) {
        throw new Error(`ไม่พบชื่อการ์ดในบรรทัดที่ ${i + 1}: "${line}"`);
      }

      deck[section].push({ count, name });
    }

    return deck;
  }

  function getCardFromLookup(cardLookup, id) {
    if (!cardLookup) return null;
    if (typeof cardLookup.get === 'function') {
      return cardLookup.get(id) || cardLookup.get(String(id)) || null;
    }
    return cardLookup[id] || cardLookup[String(id)] || null;
  }

  function formatPlaintextZone(header, ids, cardLookup) {
    if (!Array.isArray(ids) || ids.length === 0) return '';
    const counts = new Map();
    for (const id of ids) {
      const card = getCardFromLookup(cardLookup, id);
      const name = card && card.name ? String(card.name).trim() : `Card #${id}`;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    const lines = [header];
    for (const [name, count] of counts.entries()) {
      lines.push(`${count} ${name}`);
    }
    return lines.join('\n');
  }

  /**
   * Generate a plaintext decklist ("<count> <card name>" grouped by zone) from { main, extra, side }.
   * @param {{ main?: number[], extra?: number[], side?: number[] }} deck
   * @param {Map<number, { name: string }>|Record<string, { name: string }>} [cardLookup]
   */
  function generatePlaintextDeck(deck, cardLookup) {
    const main = (deck && deck.main) || [];
    const extra = (deck && deck.extra) || [];
    const side = (deck && deck.side) || [];

    const sections = [
      formatPlaintextZone('Main Deck:', main, cardLookup),
      formatPlaintextZone('Extra Deck:', extra, cardLookup),
      formatPlaintextZone('Side Deck:', side, cardLookup),
    ].filter(Boolean);

    if (sections.length === 0) {
      return 'Main Deck:\n\nExtra Deck:\n\nSide Deck:';
    }
    return sections.join('\n\n');
  }

  /**
   * Resolve parsed plaintext entries into numeric passcode arrays per zone.
   * Allocates owned card IDs first (supporting alternate artworks) when ownedCards/collection are provided.
   * @param {{ main: Array<{count:number,name:string}>, extra: Array<{count:number,name:string}>, side: Array<{count:number,name:string}> }} parsedDeck
   * @param {{ cardsByName?: Map<string, { id: number, name: string }>, ownedCards?: Array<{ id: number, name: string }>, collection?: Record<string, number> }} [options]
   */
  function resolvePlaintextDeck(parsedDeck, options = {}) {
    const cardsByName = options.cardsByName instanceof Map ? options.cardsByName : new Map();
    const collection = options.collection || {};
    const ownedBuckets = new Map();

    if (Array.isArray(options.ownedCards)) {
      for (const c of options.ownedCards) {
        if (!c || !c.id || !c.name) continue;
        const owned = Math.floor(Number(collection[String(c.id)]) || 0);
        if (owned <= 0) continue;
        const key = String(c.name).trim().replace(/\s+/g, ' ').toLowerCase();
        if (!ownedBuckets.has(key)) ownedBuckets.set(key, []);
        ownedBuckets.get(key).push({ id: Number(c.id), remaining: owned });
      }
    }

    const deck = { main: [], extra: [], side: [] };
    const missingNames = [];
    const seenMissing = new Set();

    for (const zone of ['main', 'extra', 'side']) {
      for (const entry of (parsedDeck && parsedDeck[zone]) || []) {
        const key = String(entry.name || '').trim().replace(/\s+/g, ' ').toLowerCase();
        const buckets = ownedBuckets.get(key);
        const canonical = cardsByName.get(key);
        const fallbackId = canonical ? Number(canonical.id) : buckets && buckets.length ? buckets[0].id : null;

        if (!fallbackId) {
          if (!seenMissing.has(key)) {
            seenMissing.add(key);
            missingNames.push(entry.name);
          }
          continue;
        }

        for (let i = 0; i < entry.count; i++) {
          let chosenId = null;
          if (buckets) {
            for (const b of buckets) {
              if (b.remaining > 0) {
                b.remaining -= 1;
                chosenId = b.id;
                break;
              }
            }
          }
          deck[zone].push(chosenId || fallbackId);
        }
      }
    }

    return { deck, missingNames };
  }

  /**
   * Generate an MDPro4 trunk whitelist (.lflist.conf) string from a card collection.
   * Limits each card count to 1-3 copies.
   * @param {Record<string, number>} collection
   */
  function generateTrunk(collection) {
    const header = [
      '#[Tower RPG]',
      '!Tower RPG',
      '$whitelist',
      '# รูปแบบ: <Card Passcode 8 หลัก> <จำนวนใบที่มีในคลัง 1-3>',
    ];

    const entries = [];
    if (collection && typeof collection === 'object') {
      for (const [rawId, rawCount] of Object.entries(collection)) {
        const id = parseInt(rawId, 10);
        const count = Math.floor(Number(rawCount) || 0);
        if (!Number.isNaN(id) && id > 0 && count > 0) {
          entries.push([id, Math.min(3, count)]);
        }
      }
    }

    entries.sort((a, b) => a[0] - b[0]);
    const body = entries.map(([id, count]) => `${id} ${count}`);

    return [...header, ...body, ''].join('\n');
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
   * Collect ownership and 3-copy limit errors for a deck against a collection.
   * @param {{ main: number[], extra: number[], side: number[] }} deck
   * @param {Record<string, number>} collection
   * @param {Map<number, { name: string }>} [cardLookup]
   */
  function collectCollectionErrors(deck, collection, cardLookup) {
    const errors = [];
    const main = (deck && deck.main) || [];
    const extra = (deck && deck.extra) || [];
    const side = (deck && deck.side) || [];

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
      if (owned <= 0) {
        const label = cardLookup && cardLookup.has(id) ? cardLookup.get(id).name : `#${id}`;
        errors.push(`การ์ด ${label} ไม่มีในคลัง (ต้องการ ${count} ใบ)`);
      } else if (count > owned) {
        const label = cardLookup && cardLookup.has(id) ? cardLookup.get(id).name : `#${id}`;
        errors.push(`การ์ด ${label} ใส่ ${count} ใบ เกินจำนวนที่มีในคลัง (${owned} ใบ)`);
      }
      if ((!cardLookup || !cardLookup.has(id)) && count > 3) {
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

    return errors;
  }

  /**
   * Validate an imported deck against collection ownership and 3-copy limit
   * (without enforcing Main/Extra/Side deck size bounds).
   * @param {{ main: number[], extra: number[], side: number[] }} deck
   * @param {Record<string, number>} collection
   * @param {Map<number, { name: string }>} [cardLookup]
   * @param {{ emptyMessage?: string }} [options]
   */
  function validateDeckCollection(deck, collection, cardLookup, options) {
    const main = (deck && deck.main) || [];
    const extra = (deck && deck.extra) || [];
    const side = (deck && deck.side) || [];

    const errors = [];
    if (main.length + extra.length + side.length === 0) {
      errors.push((options && options.emptyMessage) || 'ไม่พบการ์ดในไฟล์ .ydk นี้');
    } else {
      errors.push(...collectCollectionErrors(deck, collection, cardLookup));
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

    errors.push(...collectCollectionErrors(deck, collection, cardLookup));

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
    parseYdke,
    generateYdke,
    parsePlaintextDeck,
    generatePlaintextDeck,
    resolvePlaintextDeck,
    generateTrunk,
    addDeckToCollection,
    validateDeck,
    validateDeckCollection,
    evaluateRecipeAgainstCollection,
  };
});
