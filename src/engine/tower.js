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
    root.YgoTower.Tower = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Constants) {
  /**
   * Shuffle an array (Fisher-Yates) without mutating the original.
   */
  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Pick N opponents for a given role and floor from the roster, with fallback to any floor.
   */
  function pickOpponents(roster, role, floor, count) {
    const exact = shuffle(roster.filter((c) => c.role === role && Number(c.preferredFloor) === floor));
    const fallback = shuffle(roster.filter((c) => c.role === role && Number(c.preferredFloor) !== floor));
    const anyRole = shuffle(roster.filter((c) => c.role !== role));
    const pool = [...exact, ...fallback, ...anyRole];

    const picked = [];
    for (let i = 0; i < count; i++) {
      const source = pool[i % pool.length] || {
        id: `placeholder-${role}-${floor}-${i + 1}`,
        name: `${role.toUpperCase()} F${floor}-${i + 1}`,
        role,
        ydkRaw: '',
      };
      picked.push({
        rosterId: source.id,
        name: source.name,
        role,
        ydkRaw: source.ydkRaw || '',
        defeated: false,
      });
    }
    return picked;
  }

  /**
   * Create the initial state for a specific floor.
   */
  function createFloorState(floor, roster, settings) {
    const eco = getFloorEconomy(floor, settings);
    return {
      floor,
      phase: 'guards', // 'guards' | 'minibosses' | 'boss' | 'cleared'
      guards: pickOpponents(roster, 'guard', floor, eco.guardCount),
      minibosses: pickOpponents(roster, 'miniboss', floor, eco.minibossCount),
      boss: {
        ...pickOpponents(roster, 'boss', floor, 1)[0],
        bo3Wins: 0,
        bo3Losses: 0,
      },
      pendingPenalty: null, // { role, index, rematchCost }
    };
  }

  /**
   * Get economy values for a floor from settings.
   */
  function getFloorEconomy(floor, settings) {
    const list = (settings && settings.floorEconomy) || Constants.DEFAULT_SETTINGS.floorEconomy;
    const found = list.find((e) => e.floor === floor);
    if (found) return found;
    const def = Constants.FLOORS.find((f) => f.floor === floor) || Constants.FLOORS[0];
    return {
      floor: def.floor,
      packPrice: def.defaultPackPrice,
      winDp: def.defaultWinDp,
      lossDp: def.defaultLossDp,
      guardCount: def.guardCount,
      minibossCount: def.minibossCount,
    };
  }

  /**
   * Calculate Rematch DP cost for a role on a given floor.
   */
  function getRematchCost(floor, role, settings) {
    const eco = getFloorEconomy(floor, settings);
    const ratio =
      role === 'boss'
        ? settings?.bossRematchRatio ?? Constants.DEFAULT_SETTINGS.bossRematchRatio
        : settings?.minibossRematchRatio ?? Constants.DEFAULT_SETTINGS.minibossRematchRatio;
    return Math.max(10, Math.round(eco.packPrice * ratio));
  }

  /**
   * Advance winCounter (cumulative 1..8 per floor) and return any triggered event.
   */
  function advanceWinCounter(season) {
    season.winCounter = (season.winCounter || 0) + 1;
    let triggeredEvent = null;

    if (season.winCounter === 4) {
      triggeredEvent = 'free_pack';
      season.pendingEvents = season.pendingEvents || [];
      season.pendingEvents.push({ type: 'free_pack', floor: season.currentFloor });
    } else if (season.winCounter >= 8) {
      triggeredEvent = 'pick_card';
      season.pendingEvents = season.pendingEvents || [];
      season.pendingEvents.push({ type: 'pick_card', floor: season.currentFloor });
      season.winCounter = 0; // Reset loop 1..8
    }

    return triggeredEvent;
  }

  /**
   * Record a duel game result against a Guard (Bo1), Mini-boss (Bo1), or Boss (Bo3 game).
   * Returns { dpEarned, triggeredEvent, matchEnded, matchWon, floorCleared, seasonCompleted }.
   */
  function recordDuelResult(season, role, index, won, roster, settings) {
    const fs = season.floorState;
    if (fs.pendingPenalty) {
      throw new Error('กรุณาเลือก Rematch หรือกลับไปสู้ทหารยามก่อนเริ่มแมตช์ใหม่');
    }

    const eco = getFloorEconomy(season.currentFloor, settings);
    let dpEarned = 0;
    let triggeredEvent = null;
    let matchEnded = false;
    let matchWon = false;
    let floorCleared = false;
    let seasonCompleted = false;

    if (role === 'guard') {
      matchEnded = true;
      if (won) {
        matchWon = true;
        fs.guards[index].defeated = true;
        dpEarned = eco.winDp;
        season.dp += dpEarned;
        triggeredEvent = advanceWinCounter(season);

        const allGuardsDone = fs.guards.every((g) => g.defeated);
        if (allGuardsDone) {
          const allMinibossDone = fs.minibosses.every((m) => m.defeated);
          fs.phase = allMinibossDone ? 'boss' : 'minibosses';
        }
      } else {
        dpEarned = eco.lossDp;
        season.dp += dpEarned;
      }
    } else if (role === 'miniboss') {
      matchEnded = true;
      if (won) {
        matchWon = true;
        fs.minibosses[index].defeated = true;
        dpEarned = eco.winDp;
        season.dp += dpEarned;
        triggeredEvent = advanceWinCounter(season);

        if (fs.minibosses.every((m) => m.defeated)) {
          fs.phase = 'boss';
        }
      } else {
        dpEarned = eco.lossDp;
        season.dp += dpEarned;
        fs.pendingPenalty = {
          role: 'miniboss',
          index,
          rematchCost: getRematchCost(season.currentFloor, 'miniboss', settings),
        };
      }
    } else if (role === 'boss') {
      if (won) {
        fs.boss.bo3Wins += 1;
        if (fs.boss.bo3Wins >= 2) {
          matchEnded = true;
          matchWon = true;
          fs.boss.defeated = true;
          dpEarned = eco.winDp;
          season.dp += dpEarned;
          triggeredEvent = advanceWinCounter(season);

          // Unlock floor packs
          season.unlockedFloors = season.unlockedFloors || [];
          if (!season.unlockedFloors.includes(season.currentFloor)) {
            season.unlockedFloors.push(season.currentFloor);
          }

          floorCleared = true;
          if (season.currentFloor >= 7) {
            fs.phase = 'cleared';
            season.status = 'completed';
            season.title = 'King of Duelist';
            season.completedAt = new Date().toISOString();
            seasonCompleted = true;
          } else {
            season.currentFloor += 1;
            season.winCounter = 0;
            season.floorState = createFloorState(season.currentFloor, roster, settings);
          }
        }
      } else {
        fs.boss.bo3Losses += 1;
        if (fs.boss.bo3Losses >= 2) {
          matchEnded = true;
          dpEarned = eco.lossDp;
          season.dp += dpEarned;
          fs.boss.bo3Wins = 0;
          fs.boss.bo3Losses = 0;
          fs.pendingPenalty = {
            role: 'boss',
            index: 0,
            rematchCost: getRematchCost(season.currentFloor, 'boss', settings),
          };
        }
      }
    }

    return {
      dpEarned,
      triggeredEvent,
      matchEnded,
      matchWon,
      floorCleared,
      seasonCompleted,
    };
  }

  /**
   * Pay DP to immediately rematch the mini-boss or boss that defeated the player.
   */
  function payRematch(season) {
    const penalty = season.floorState.pendingPenalty;
    if (!penalty) {
      throw new Error('ไม่มีสถานะรอ Rematch');
    }
    if (season.dp < penalty.rematchCost) {
      throw new Error(`DP ไม่พอสำหรับ Rematch (ต้องการ ${penalty.rematchCost} DP)`);
    }
    season.dp -= penalty.rematchCost;
    season.floorState.pendingPenalty = null;
    if (penalty.role === 'boss') {
      season.floorState.boss.bo3Wins = 0;
      season.floorState.boss.bo3Losses = 0;
    }
    return season;
  }

  /**
   * Return to guards phase on defeat while preserving already-defeated mini-bosses (Checkpoint).
   */
  function returnToGuards(season) {
    const fs = season.floorState;
    fs.pendingPenalty = null;
    fs.phase = 'guards';
    for (const g of fs.guards) {
      g.defeated = false;
    }
    fs.boss.bo3Wins = 0;
    fs.boss.bo3Losses = 0;
    return season;
  }

  return {
    createFloorState,
    getFloorEconomy,
    getRematchCost,
    recordDuelResult,
    payRematch,
    returnToGuards,
  };
});
