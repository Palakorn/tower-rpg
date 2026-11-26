(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  } else {
    root.YgoTower = root.YgoTower || {};
    root.YgoTower.CardFilter = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CARD_FRAMES = [
    { key: 'normal', label: 'Normal' },
    { key: 'effect', label: 'Effect' },
    { key: 'fusion', label: 'Fusion' },
    { key: 'ritual', label: 'Ritual' },
    { key: 'synchro', label: 'Synchro' },
    { key: 'xyz', label: 'Xyz' },
    { key: 'pendulum', label: 'Pendulum' },
    { key: 'link', label: 'Link' },
    { key: 'spell', label: 'Spell' },
    { key: 'trap', label: 'Trap' },
  ];

  const STAT_FIELDS = [
    { key: 'level', label: 'Level/Rank/Link' },
    { key: 'atk', label: 'Attack' },
    { key: 'def', label: 'Defense' },
    { key: 'scale', label: 'Pendulum Scale' },
  ];

  function createEmptyFilters() {
    return {
      frames: [],
      stats: {
        level: { min: '', max: '' },
        atk: { min: '', max: '' },
        def: { min: '', max: '' },
        scale: { min: '', max: '' },
      },
    };
  }

  function cloneFilters(filters) {
    const base = createEmptyFilters();
    if (!filters || typeof filters !== 'object') return base;
    const validKeys = new Set(CARD_FRAMES.map((f) => f.key));
    if (Array.isArray(filters.frames)) {
      base.frames = Array.from(new Set(filters.frames.filter((k) => validKeys.has(k))));
    }
    if (filters.stats && typeof filters.stats === 'object') {
      for (const field of STAT_FIELDS) {
        const raw = filters.stats[field.key];
        if (raw && typeof raw === 'object') {
          base.stats[field.key] = {
            min: raw.min === null || raw.min === undefined ? '' : String(raw.min).trim(),
            max: raw.max === null || raw.max === undefined ? '' : String(raw.max).trim(),
          };
        }
      }
    }
    return base;
  }

  function parseStatBound(raw) {
    if (raw === '' || raw === null || raw === undefined) return null;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }

  function isLinkCard(card) {
    const ft = String(card?.frameType || '').toLowerCase();
    const tp = String(card?.type || '').toLowerCase();
    return ft === 'link' || tp.includes('link monster');
  }

  const FRAME_MATCHERS = {
    normal: (ft, tp) =>
      ft === 'normal' ||
      ft === 'normal_pendulum' ||
      (!ft && (tp.includes('normal monster') || tp.includes('pendulum normal'))),
    effect: (ft, tp) =>
      ft === 'effect' ||
      ft === 'effect_pendulum' ||
      (!ft &&
        tp.includes('effect') &&
        !tp.includes('fusion') &&
        !tp.includes('synchro') &&
        !tp.includes('xyz') &&
        !tp.includes('ritual') &&
        !tp.includes('link')),
    fusion: (ft, tp) => ft === 'fusion' || ft === 'fusion_pendulum' || (!ft && tp.includes('fusion')),
    ritual: (ft, tp) =>
      ft === 'ritual' || ft === 'ritual_pendulum' || (!ft && tp.includes('ritual') && !tp.includes('spell')),
    synchro: (ft, tp) => ft === 'synchro' || ft === 'synchro_pendulum' || (!ft && tp.includes('synchro')),
    xyz: (ft, tp) => ft === 'xyz' || ft === 'xyz_pendulum' || (!ft && tp.includes('xyz')),
    pendulum: (ft, tp) => ft.includes('pendulum') || tp.includes('pendulum'),
    link: (ft, tp) => ft === 'link' || (!ft && tp.includes('link monster')),
    spell: (ft, tp) => ft === 'spell' || (!ft && tp.includes('spell')),
    trap: (ft, tp) => ft === 'trap' || (!ft && tp.includes('trap')),
  };

  /**
   * Check whether a card matches any of the selected frame keys (OR semantics, hybrid Pendulums match both).
   */
  function matchesCardFrames(card, selectedFrames) {
    if (!Array.isArray(selectedFrames) || selectedFrames.length === 0) return true;
    const ft = String(card?.frameType || '').toLowerCase();
    const tp = String(card?.type || '').toLowerCase();
    return selectedFrames.some((key) => {
      const fn = FRAME_MATCHERS[key];
      return fn ? fn(ft, tp) : false;
    });
  }

  function getCardNumericStat(card, statKey) {
    if (!card) return null;
    let raw = null;
    if (statKey === 'level') {
      raw = isLinkCard(card) ? (card.linkval ?? card.level) : card.level;
    } else {
      raw = card[statKey];
    }
    if (raw === null || raw === undefined || raw === '') return null;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return null;
    return num;
  }

  /**
   * Check whether a card satisfies all active Min/Max stat constraints.
   */
  function matchesCardStats(card, stats) {
    if (!stats || typeof stats !== 'object') return true;
    for (const field of STAT_FIELDS) {
      const range = stats[field.key];
      if (!range) continue;
      const min = parseStatBound(range.min);
      const max = parseStatBound(range.max);
      if (min === null && max === null) continue;

      const value = getCardNumericStat(card, field.key);
      if (value === null) return false;
      if (min !== null && value < min) return false;
      if (max !== null && value > max) return false;
    }
    return true;
  }

  function matchesCardFilters(card, filters, query = '') {
    const q = String(query || '').trim().toLowerCase();
    if (q) {
      const name = String(card?.name || '').toLowerCase();
      const idStr = String(card?.id ?? '');
      if (!name.includes(q) && !idStr.includes(String(query).trim())) {
        return false;
      }
    }
    if (!filters) return true;
    return matchesCardFrames(card, filters.frames) && matchesCardStats(card, filters.stats);
  }

  function filterCollectionItems(items, filters, query = '') {
    return (items || []).filter((item) => matchesCardFilters(item.card, filters, query));
  }

  function countActiveFilters(filters) {
    if (!filters || typeof filters !== 'object') return 0;
    let count = Array.isArray(filters.frames) ? filters.frames.length : 0;
    if (filters.stats && typeof filters.stats === 'object') {
      for (const field of STAT_FIELDS) {
        const range = filters.stats[field.key];
        if (!range) continue;
        if (parseStatBound(range.min) !== null || parseStatBound(range.max) !== null) {
          count += 1;
        }
      }
    }
    return count;
  }

  function getActiveFilterChips(filters) {
    if (!filters || typeof filters !== 'object') return [];
    const chips = [];
    const frameMap = new Map(CARD_FRAMES.map((f) => [f.key, f.label]));
    for (const key of filters.frames || []) {
      chips.push(frameMap.get(key) || key);
    }
    for (const field of STAT_FIELDS) {
      const range = filters.stats?.[field.key];
      if (!range) continue;
      const min = parseStatBound(range.min);
      const max = parseStatBound(range.max);
      if (min !== null && max !== null) {
        chips.push(`${field.label}: ${min}–${max}`);
      } else if (min !== null) {
        chips.push(`${field.label} ≥ ${min}`);
      } else if (max !== null) {
        chips.push(`${field.label} ≤ ${max}`);
      }
    }
    return chips;
  }

  return {
    CARD_FRAMES,
    STAT_FIELDS,
    createEmptyFilters,
    cloneFilters,
    parseStatBound,
    getCardNumericStat,
    matchesCardFrames,
    matchesCardStats,
    matchesCardFilters,
    filterCollectionItems,
    countActiveFilters,
    getActiveFilterChips,
  };
});
