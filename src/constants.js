(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  } else {
    root.YgoTower = root.YgoTower || {};
    root.YgoTower.Constants = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const FLOORS = [
    {
      floor: 1,
      name: 'Apprentice Hall',
      era: 'GBC / Dark Duel Stories',
      description: 'Duelist ระดับเริ่มต้น สไตล์ Deck แบบ Dark Duel Stories ยุค GBC',
      yearMin: 1999,
      yearMax: 2002,
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
      description: 'ตัวละครและ Deck จากภาคแรก (Duel Monsters)',
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
      description: 'ตัวละครและ Deck จากภาค GX',
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
      description: "ตัวละครและ Deck จากภาค 5D's",
      yearMin: 2009,
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
      era: 'Zexal',
      description: 'ตัวละครและ Deck จากภาค Zexal',
      yearMin: 2012,
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
      era: 'Arc-V',
      description: 'ตัวละครและ Deck จากภาค Arc-V',
      yearMin: 2015,
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
      era: 'VRAINS',
      description: 'ตัวละครและ Deck จากภาค VRAINS',
      yearMin: 2018,
      yearMax: 2099,
      defaultPackPrice: 1200,
      defaultWinDp: 1200,
      defaultLossDp: 350,
      guardCount: 4,
      minibossCount: 3,
    },
  ];

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
    FLOORS,
    DEFAULT_SETTINGS,
    ROLES,
  };
});
