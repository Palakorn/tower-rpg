(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  } else {
    root.YgoTower = root.YgoTower || {};
    root.YgoTower.Constants = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CURATED_MAPPING_VERSION = 3;

  const FLOORS = [
    {
      floor: 1,
      name: 'Apprentice Hall',
      era: 'GBC / Dark Duel Stories',
      description: 'Duelist ระดับเริ่มต้น สไตล์ Dark Duel Stories • ซอง DM ยุคแรก (2002–กลาง 2003)',
      yearMin: 2002,
      yearMax: 2003,
      defaultPackPrice: 100,
      defaultWinDp: 120,
      defaultLossDp: 40,
      guardCount: 3,
      minibossCount: 3,
    },
    {
      floor: 2,
      name: 'Warrior Hall',
      era: 'Duel Monsters (DM)',
      description: 'ตัวละครและซองการ์ดยุค Duel Monsters ช่วงหลัง (ปลาย 2003–2004)',
      yearMin: 2003,
      yearMax: 2004,
      defaultPackPrice: 200,
      defaultWinDp: 220,
      defaultLossDp: 70,
      guardCount: 4,
      minibossCount: 3,
    },
    {
      floor: 3,
      name: 'Elite Arena',
      era: 'GX',
      description: 'ตัวละครและซองการ์ดยุค Yu-Gi-Oh! GX (2005–2008)',
      yearMin: 2005,
      yearMax: 2008,
      defaultPackPrice: 350,
      defaultWinDp: 360,
      defaultLossDp: 110,
      guardCount: 4,
      minibossCount: 3,
    },
    {
      floor: 4,
      name: 'Arcane Sanctum',
      era: "5D's",
      description: "ตัวละครและซองการ์ดยุค Yu-Gi-Oh! 5D's (2008–2011)",
      yearMin: 2008,
      yearMax: 2011,
      defaultPackPrice: 500,
      defaultWinDp: 500,
      defaultLossDp: 150,
      guardCount: 4,
      minibossCount: 3,
    },
    {
      floor: 5,
      name: "Dragon's Dominion",
      era: 'ZEXAL',
      description: 'ตัวละครและซองการ์ดยุค Yu-Gi-Oh! ZEXAL (2011–2014)',
      yearMin: 2011,
      yearMax: 2014,
      defaultPackPrice: 700,
      defaultWinDp: 680,
      defaultLossDp: 200,
      guardCount: 4,
      minibossCount: 3,
    },
    {
      floor: 6,
      name: 'Divine Sanctuary',
      era: 'ARC-V',
      description: 'ตัวละครและซองการ์ดยุค Yu-Gi-Oh! ARC-V (2014–2017)',
      yearMin: 2014,
      yearMax: 2017,
      defaultPackPrice: 950,
      defaultWinDp: 900,
      defaultLossDp: 270,
      guardCount: 4,
      minibossCount: 3,
    },
    {
      floor: 7,
      name: 'Supreme Throne',
      era: 'VRAINS & Series 11–13',
      description: 'ตัวละครและซองการ์ดยุค VRAINS และ Series 11–13 (2017–2026)',
      yearMin: 2017,
      yearMax: 2026,
      defaultPackPrice: 1200,
      defaultWinDp: 1200,
      defaultLossDp: 350,
      guardCount: 4,
      minibossCount: 3,
    },
  ];

  const CURATED_PACKS = [
    // Floor 1: GBC / Dark Duel Stories — DM Part 1 (6 original packs + 25th Anniversary Editions)
    { floor: 1, set_code: 'LOB', set_name: 'Legend of Blue Eyes White Dragon', tcg_date: '2002-03-08' },
    { floor: 1, set_code: 'LOB', set_name: 'Legend of Blue Eyes White Dragon (25th Anniversary Edition)', tcg_date: '2023-04-20' },
    { floor: 1, set_code: 'MRD', set_name: 'Metal Raiders', tcg_date: '2002-06-26' },
    { floor: 1, set_code: 'MRD', set_name: 'Metal Raiders (25th Anniversary Edition)', tcg_date: '2023-04-20' },
    { floor: 1, set_code: 'SRL', set_name: 'Spell Ruler', tcg_date: '2002-09-16' },
    { floor: 1, set_code: 'SRL', set_name: 'Spell Ruler (25th Anniversary Edition)', tcg_date: '2023-04-20' },
    { floor: 1, set_code: 'PSV', set_name: "Pharaoh's Servant", tcg_date: '2002-10-20' },
    { floor: 1, set_code: 'PSV', set_name: "Pharaoh's Servant (25th Anniversary Edition)", tcg_date: '2023-04-20' },
    { floor: 1, set_code: 'LON', set_name: 'Labyrinth of Nightmare', tcg_date: '2003-03-01' },
    { floor: 1, set_code: 'LOD', set_name: 'Legacy of Darkness', tcg_date: '2003-06-06' },
    // Floor 2: Yu-Gi-Oh! Duel Monsters (DM) — Part 2 (7 original packs + 25th Anniversary Edition)
    { floor: 2, set_code: 'PGD', set_name: 'Pharaonic Guardian', tcg_date: '2003-07-18' },
    { floor: 2, set_code: 'MFC', set_name: "Magician's Force", tcg_date: '2003-10-10' },
    { floor: 2, set_code: 'DCR', set_name: 'Dark Crisis', tcg_date: '2003-12-01' },
    { floor: 2, set_code: 'DCR', set_name: 'Dark Crisis (25th Anniversary Edition)', tcg_date: '2023-04-20' },
    { floor: 2, set_code: 'IOC', set_name: 'Invasion of Chaos', tcg_date: '2004-03-01' },
    { floor: 2, set_code: 'AST', set_name: 'Ancient Sanctuary', tcg_date: '2004-06-01' },
    { floor: 2, set_code: 'SOD', set_name: 'Soul of the Duelist', tcg_date: '2004-10-01' },
    { floor: 2, set_code: 'RDS', set_name: 'Rise of Destiny', tcg_date: '2004-11-20' },
    // Floor 3: Yu-Gi-Oh! GX (14 packs)
    { floor: 3, set_code: 'FET', set_name: 'Flaming Eternity', tcg_date: '2005-03-01' },
    { floor: 3, set_code: 'TLM', set_name: 'The Lost Millennium', tcg_date: '2005-06-01' },
    { floor: 3, set_code: 'CRV', set_name: 'Cybernetic Revolution', tcg_date: '2005-08-17' },
    { floor: 3, set_code: 'EEN', set_name: 'Elemental Energy', tcg_date: '2005-11-16' },
    { floor: 3, set_code: 'SOI', set_name: 'Shadow of Infinity', tcg_date: '2006-02-18' },
    { floor: 3, set_code: 'EOJ', set_name: 'Enemy of Justice', tcg_date: '2006-05-17' },
    { floor: 3, set_code: 'POTD', set_name: 'Power of the Duelist', tcg_date: '2006-08-16' },
    { floor: 3, set_code: 'CDIP', set_name: 'Cyberdark Impact', tcg_date: '2006-11-15' },
    { floor: 3, set_code: 'STON', set_name: 'Strike of Neos', tcg_date: '2007-02-28' },
    { floor: 3, set_code: 'FOTB', set_name: 'Force of the Breaker', tcg_date: '2007-05-16' },
    { floor: 3, set_code: 'TAEV', set_name: 'Tactical Evolution', tcg_date: '2007-08-15' },
    { floor: 3, set_code: 'GLAS', set_name: "Gladiator's Assault", tcg_date: '2007-11-14' },
    { floor: 3, set_code: 'PTDN', set_name: 'Phantom Darkness', tcg_date: '2008-02-13' },
    { floor: 3, set_code: 'LODT', set_name: 'Light of Destruction', tcg_date: '2008-05-13' },
    // Floor 4: Yu-Gi-Oh! 5D's (12 packs)
    { floor: 4, set_code: 'TDGS', set_name: 'The Duelist Genesis', tcg_date: '2008-09-02' },
    { floor: 4, set_code: 'CSOC', set_name: 'Crossroads of Chaos', tcg_date: '2008-11-18' },
    { floor: 4, set_code: 'CRMS', set_name: 'Crimson Crisis', tcg_date: '2009-03-03' },
    { floor: 4, set_code: 'RGBT', set_name: 'Raging Battle', tcg_date: '2009-05-12' },
    { floor: 4, set_code: 'ANPR', set_name: 'Ancient Prophecy', tcg_date: '2009-09-01' },
    { floor: 4, set_code: 'SOVR', set_name: 'Stardust Overdrive', tcg_date: '2009-11-17' },
    { floor: 4, set_code: 'ABPF', set_name: 'Absolute Powerforce', tcg_date: '2010-02-12' },
    { floor: 4, set_code: 'TSHD', set_name: 'The Shining Darkness', tcg_date: '2010-05-07' },
    { floor: 4, set_code: 'DREV', set_name: 'Duelist Revolution', tcg_date: '2010-08-17' },
    { floor: 4, set_code: 'STBL', set_name: 'Starstrike Blast', tcg_date: '2010-11-11' },
    { floor: 4, set_code: 'STOR', set_name: 'Storm of Ragnarok', tcg_date: '2011-02-08' },
    { floor: 4, set_code: 'EXVC', set_name: 'Extreme Victory', tcg_date: '2011-05-06' },
    // Floor 5: Yu-Gi-Oh! ZEXAL (12 packs)
    { floor: 5, set_code: 'GENF', set_name: 'Generation Force', tcg_date: '2011-08-16' },
    { floor: 5, set_code: 'PHSW', set_name: 'Photon Shockwave', tcg_date: '2011-11-10' },
    { floor: 5, set_code: 'ORCS', set_name: 'Order of Chaos', tcg_date: '2012-01-20' },
    { floor: 5, set_code: 'GAOV', set_name: 'Galactic Overlord', tcg_date: '2012-05-08' },
    { floor: 5, set_code: 'REDU', set_name: 'Return of the Duelist', tcg_date: '2012-08-24' },
    { floor: 5, set_code: 'ABYR', set_name: 'Abyss Rising', tcg_date: '2012-11-09' },
    { floor: 5, set_code: 'CBLZ', set_name: 'Cosmo Blazer', tcg_date: '2013-01-25' },
    { floor: 5, set_code: 'LTGY', set_name: 'Lord of the Tachyon Galaxy', tcg_date: '2013-05-17' },
    { floor: 5, set_code: 'JOTL', set_name: 'Judgment of the Light', tcg_date: '2013-08-08' },
    { floor: 5, set_code: 'SHSP', set_name: 'Shadow Specters', tcg_date: '2013-11-08' },
    { floor: 5, set_code: 'LVAL', set_name: 'Legacy of the Valiant', tcg_date: '2014-01-24' },
    { floor: 5, set_code: 'PRIO', set_name: 'Primal Origin', tcg_date: '2014-05-16' },
    // Floor 6: Yu-Gi-Oh! ARC-V (12 packs)
    { floor: 6, set_code: 'DUEA', set_name: 'Duelist Alliance', tcg_date: '2014-08-14' },
    { floor: 6, set_code: 'NECH', set_name: 'The New Challengers', tcg_date: '2014-11-06' },
    { floor: 6, set_code: 'SECE', set_name: 'Secrets of Eternity', tcg_date: '2015-01-15' },
    { floor: 6, set_code: 'CROS', set_name: 'Crossed Souls', tcg_date: '2015-05-14' },
    { floor: 6, set_code: 'CORE', set_name: 'Clash of Rebellions', tcg_date: '2015-08-06' },
    { floor: 6, set_code: 'DOCS', set_name: 'Dimension of Chaos', tcg_date: '2015-11-05' },
    { floor: 6, set_code: 'BOSH', set_name: 'Breakers of Shadow', tcg_date: '2016-01-14' },
    { floor: 6, set_code: 'SHVI', set_name: 'Shining Victories', tcg_date: '2016-05-05' },
    { floor: 6, set_code: 'TDIL', set_name: 'The Dark Illusion', tcg_date: '2016-08-04' },
    { floor: 6, set_code: 'INOV', set_name: 'Invasion: Vengeance', tcg_date: '2016-11-03' },
    { floor: 6, set_code: 'RATE', set_name: 'Raging Tempest', tcg_date: '2017-02-09' },
    { floor: 6, set_code: 'MACR', set_name: 'Maximum Crisis', tcg_date: '2017-05-04' },
    // Floor 7: Yu-Gi-Oh! VRAINS (11 packs) + Series 11 - Series 13 (26 packs) = 37 packs
    { floor: 7, set_code: 'COTD', set_name: 'Code of the Duelist', tcg_date: '2017-08-03' },
    { floor: 7, set_code: 'CIBR', set_name: 'Circuit Break', tcg_date: '2017-10-19' },
    { floor: 7, set_code: 'EXFO', set_name: 'Extreme Force', tcg_date: '2018-02-01' },
    { floor: 7, set_code: 'FLOD', set_name: 'Flames of Destruction', tcg_date: '2018-05-03' },
    { floor: 7, set_code: 'CYHO', set_name: 'Cybernetic Horizon', tcg_date: '2018-07-26' },
    { floor: 7, set_code: 'SOFU', set_name: 'Soul Fusion', tcg_date: '2018-10-18' },
    { floor: 7, set_code: 'SAST', set_name: 'Savage Strike', tcg_date: '2019-01-31' },
    { floor: 7, set_code: 'DANE', set_name: 'Dark Neostorm', tcg_date: '2019-05-02' },
    { floor: 7, set_code: 'RIRA', set_name: 'Rising Rampage', tcg_date: '2019-07-26' },
    { floor: 7, set_code: 'CHIM', set_name: 'Chaos Impact', tcg_date: '2019-10-24' },
    { floor: 7, set_code: 'IGAS', set_name: 'Ignition Assault', tcg_date: '2020-01-30' },
    { floor: 7, set_code: 'ETCO', set_name: 'Eternity Code', tcg_date: '2020-04-30' },
    { floor: 7, set_code: 'ROTD', set_name: 'Rise of the Duelist', tcg_date: '2020-08-06' },
    { floor: 7, set_code: 'PHRA', set_name: 'Phantom Rage', tcg_date: '2020-11-05' },
    { floor: 7, set_code: 'BLVO', set_name: 'Blazing Vortex', tcg_date: '2021-02-04' },
    { floor: 7, set_code: 'LIOV', set_name: 'Lightning Overdrive', tcg_date: '2021-06-03' },
    { floor: 7, set_code: 'DAMA', set_name: 'Dawn of Majesty', tcg_date: '2021-08-12' },
    { floor: 7, set_code: 'BODE', set_name: 'Burst of Destiny', tcg_date: '2021-11-04' },
    { floor: 7, set_code: 'BACH', set_name: 'Battle of Chaos', tcg_date: '2022-02-10' },
    { floor: 7, set_code: 'DIFO', set_name: 'Dimension Force', tcg_date: '2022-05-19' },
    { floor: 7, set_code: 'POTE', set_name: 'Power of the Elements', tcg_date: '2022-08-04' },
    { floor: 7, set_code: 'DABL', set_name: 'Darkwing Blast', tcg_date: '2022-10-20' },
    { floor: 7, set_code: 'PHHY', set_name: 'Photon Hypernova', tcg_date: '2023-02-09' },
    { floor: 7, set_code: 'CYAC', set_name: 'Cyberstorm Access', tcg_date: '2023-05-04' },
    { floor: 7, set_code: 'DUNE', set_name: 'Duelist Nexus', tcg_date: '2023-07-27' },
    { floor: 7, set_code: 'AGOV', set_name: 'Age of Overlord', tcg_date: '2023-10-19' },
    { floor: 7, set_code: 'PHNI', set_name: 'Phantom Nightmare', tcg_date: '2024-02-08' },
    { floor: 7, set_code: 'LEDE', set_name: 'Legacy of Destruction', tcg_date: '2024-04-25' },
    { floor: 7, set_code: 'INFO', set_name: 'The Infinite Forbidden', tcg_date: '2024-07-18' },
    { floor: 7, set_code: 'ROTA', set_name: 'Rage of the Abyss', tcg_date: '2024-10-10' },
    { floor: 7, set_code: 'SUDA', set_name: 'Supreme Darkness', tcg_date: '2025-01-23' },
    { floor: 7, set_code: 'ALIN', set_name: 'Alliance Insight', tcg_date: '2025-05-01' },
    { floor: 7, set_code: 'DUAD', set_name: "Duelist's Advance", tcg_date: '2025-07-03' },
    { floor: 7, set_code: 'DOOD', set_name: 'Doom of Dimensions', tcg_date: '2025-09-25' },
    { floor: 7, set_code: 'BPRO', set_name: 'Burst Protocol', tcg_date: '2026-02-05' },
    { floor: 7, set_code: 'BLZD', set_name: 'Blazing Dominion', tcg_date: '2026-05-07' },
    { floor: 7, set_code: 'CORI', set_name: 'Chaos Origins', tcg_date: '2026-07-02' },
  ];

  function normalizeSetName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  const CURATED_BY_CODE = new Map(CURATED_PACKS.map((p, idx) => [p.set_code.toUpperCase(), { ...p, order: idx }]));
  const CURATED_BY_NAME = new Map(CURATED_PACKS.map((p, idx) => [normalizeSetName(p.set_name), { ...p, order: idx }]));

  function findCuratedPack(set) {
    if (!set) return null;
    if (set.set_name) {
      return CURATED_BY_NAME.get(normalizeSetName(set.set_name)) || null;
    }
    return set.set_code ? CURATED_BY_CODE.get(String(set.set_code).toUpperCase()) || null : null;
  }

  function getPackImageUrl(set) {
    if (set && set.set_image) return set.set_image;
    if (set && set.set_code) return `https://images.ygoprodeck.com/images/sets/${set.set_code}.jpg`;
    return '';
  }

  const DEFAULT_SETTINGS = {
    id: 'global',
    minibossRematchRatio: 0.5, // 50% of floor pack price
    bossRematchRatio: 1.0, // 100% of floor pack price
    floorEconomy: FLOORS.map((f) => ({
      floor: f.floor,
      packPrice: f.defaultPackPrice,
      winDp: f.defaultWinDp,
      lossDp: f.defaultLossDp,
      guardCount: f.guardCount,
      minibossCount: f.minibossCount,
    })),
    pullRates: {
      ocg: {
        cardsPerPack: 5,
        // Weights for each slot
        weights: {
          common: 72,
          rare: 18,
          super: 6,
          ultra: 3,
          secret: 1,
        },
      },
      tcg: {
        cardsPerPack: 9,
        commonSlots: 7,
        rareSlots: 1,
        // Foil slot probabilities (sum = 100)
        foilWeights: {
          super: 70,
          ultra: 22,
          secret: 8,
        },
      },
    },
  };

  const ROLES = {
    GUARD: 'guard',
    MINIBOSS: 'miniboss',
    BOSS: 'boss',
  };

  return {
    CURATED_MAPPING_VERSION,
    FLOORS,
    CURATED_PACKS,
    normalizeSetName,
    findCuratedPack,
    getPackImageUrl,
    DEFAULT_SETTINGS,
    ROLES,
  };
});
