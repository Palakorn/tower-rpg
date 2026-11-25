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
  function shuffle(arr, rng = Math.random) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Partition candidates into fresh (not locked or avoided), avoided, and locked buckets.
   */
  function orderTierCandidates(items, lockedSet, avoidSet, rng) {
    const fresh = [];
    const avoided = [];
    const locked = [];
    for (const item of items) {
      if (lockedSet.has(item.id)) {
        locked.push(item);
      } else if (avoidSet.has(item.id)) {
        avoided.push(item);
      } else {
        fresh.push(item);
      }
    }
    return {
      nonLocked: [...shuffle(fresh, rng), ...shuffle(avoided, rng)],
      locked: shuffle(locked, rng),
    };
  }

  /**
   * Pick N opponents for a given role and floor from the roster, with fallback to any floor.
   * Prefers candidates not in lockedRosterIds or avoidRosterIds when available.
   */
  function pickOpponents(roster, role, floor, count, options = {}) {
    if (count <= 0) return [];
    const rng = options.rng || Math.random;
    const lockedSet = new Set(options.lockedRosterIds || []);
    const avoidSet = new Set(options.avoidRosterIds || []);

    const exact = orderTierCandidates(
      roster.filter((c) => c.role === role && Number(c.preferredFloor) === floor),
      lockedSet,
      avoidSet,
      rng
    );
    const fallback = orderTierCandidates(
      roster.filter((c) => c.role === role && Number(c.preferredFloor) !== floor),
      lockedSet,
      avoidSet,
      rng
    );
    const anyRole = orderTierCandidates(
      roster.filter((c) => c.role !== role),
      lockedSet,
      avoidSet,
      rng
    );

    const pool = [
      ...exact.nonLocked,
      ...fallback.nonLocked,
      ...anyRole.nonLocked,
      ...exact.locked,
      ...fallback.locked,
      ...anyRole.locked,
    ];

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
   * Pre-generate initial states for all 7 floors of a season.
   */
  function createAllFloorStates(roster, settings) {
    const floorStates = {};
    for (const f of Constants.FLOORS) {
      floorStates[f.floor] = createFloorState(f.floor, roster, settings);
    }
    return floorStates;
  }

  /**
   * Ensure season.floorStates exists for all floors 1..7 and stays synced with season.floorState.
   */
  function ensureFloorStates(season, roster = [], settings) {
    let changed = false;
    if (!season.floorStates || typeof season.floorStates !== 'object') {
      season.floorStates = {};
      changed = true;
    }

    if (season.floorState && !season.floorStates[season.currentFloor]) {
      season.floorStates[season.currentFloor] = season.floorState;
      changed = true;
    }

    for (const f of Constants.FLOORS) {
      if (!season.floorStates[f.floor]) {
        season.floorStates[f.floor] = createFloorState(f.floor, roster, settings);
        changed = true;
      }
    }

    if (season.floorStates[season.currentFloor] && season.floorState !== season.floorStates[season.currentFloor]) {
      season.floorState = season.floorStates[season.currentFloor];
      changed = true;
    }

    if (typeof season.eventPoints !== 'number' || Number.isNaN(season.eventPoints)) {
      season.eventPoints =
        typeof season.winCounter === 'number' && !Number.isNaN(season.winCounter)
          ? Math.max(0, Math.floor(season.winCounter))
          : 0;
      changed = true;
    }

    return { floorStates: season.floorStates, changed };
  }

  /**
   * Get the floor state for a specific floor (falling back to season.floorState for currentFloor).
   */
  function getFloorState(season, floor) {
    if (season.floorStates && season.floorStates[floor]) {
      return season.floorStates[floor];
    }
    if (floor === season.currentFloor && season.floorState) {
      return season.floorState;
    }
    return null;
  }

  /**
   * Check whether a floor (or specific tier scope) can be re-randomized and explain why if not.
   */
  function canRerandomFloor(season, floor, scope = 'all') {
    const fs = getFloorState(season, floor);
    if (!fs) {
      return { allowed: false, reason: 'ไม่พบข้อมูลของชั้นนี้' };
    }

    const isCleared =
      (season.unlockedFloors || []).includes(floor) ||
      fs.phase === 'cleared' ||
      floor < season.currentFloor;
    if (isCleared) {
      return { allowed: false, reason: 'ชั้นที่ผ่านแล้วไม่สามารถ Re-random ได้' };
    }

    const isCurrent = floor === season.currentFloor;
    const penalty = isCurrent ? fs.pendingPenalty : null;

    const guardsAllowed = (fs.guards || []).some((g) => !g.defeated);
    const minibossBlockedByPenalty = Boolean(penalty && penalty.role === 'miniboss');
    const minibossesAllowed = !minibossBlockedByPenalty && (fs.minibosses || []).some((m) => !m.defeated);

    const bossBlockedByPenalty = Boolean(penalty && penalty.role === 'boss');
    const bossStartedBo3 = (fs.boss?.bo3Wins || 0) > 0 || (fs.boss?.bo3Losses || 0) > 0;
    const bossAllowed = !bossBlockedByPenalty && !fs.boss?.defeated && !bossStartedBo3;

    if (scope === 'guards') {
      return guardsAllowed
        ? { allowed: true, reason: '' }
        : { allowed: false, reason: 'ชนะทหารยามครบแล้ว' };
    }
    if (scope === 'minibosses') {
      if (minibossBlockedByPenalty) {
        return { allowed: false, reason: 'กำลังติดสถานะรอ Rematch มินิบอส' };
      }
      return minibossesAllowed
        ? { allowed: true, reason: '' }
        : { allowed: false, reason: 'ชนะมินิบอสครบแล้ว' };
    }
    if (scope === 'boss') {
      if (bossBlockedByPenalty) {
        return { allowed: false, reason: 'กำลังติดสถานะรอ Rematch บอส' };
      }
      if (fs.boss?.defeated) {
        return { allowed: false, reason: 'ชนะบอสประจำชั้นแล้ว' };
      }
      if (bossStartedBo3) {
        return { allowed: false, reason: 'เริ่มสู้บอส Bo3 ไปแล้ว ไม่สามารถ Re-random บอสได้' };
      }
      return { allowed: true, reason: '' };
    }

    if (penalty) {
      return { allowed: false, reason: 'กำลังติดสถานะรอ Rematch กรุณาจัดการก่อน Re-random ทั้งชั้น' };
    }
    if (!guardsAllowed && !minibossesAllowed && !bossAllowed) {
      return { allowed: false, reason: 'ไม่มีคู่ต่อสู้ที่สามารถ Re-random ได้แล้ว' };
    }
    return { allowed: true, reason: '' };
  }

  /**
   * Re-pick only undefeated slots in a guard/miniboss list while preserving defeated opponents.
   */
  function rerandomSlotList(currentList, role, floor, targetCount, roster, options = {}) {
    const lockedRosterIds = currentList.filter((o) => o.defeated && o.rosterId).map((o) => o.rosterId);
    const avoidRosterIds = currentList.filter((o) => !o.defeated && o.rosterId).map((o) => o.rosterId);

    if (currentList.length === targetCount) {
      const undefeatedIndices = [];
      currentList.forEach((o, idx) => {
        if (!o.defeated) undefeatedIndices.push(idx);
      });
      if (undefeatedIndices.length === 0) return currentList;

      const replacements = pickOpponents(roster, role, floor, undefeatedIndices.length, {
        lockedRosterIds,
        avoidRosterIds,
        rng: options.rng,
      });
      const next = currentList.slice();
      undefeatedIndices.forEach((slotIdx, i) => {
        next[slotIdx] = replacements[i];
      });
      return next;
    }

    const defeatedEntries = currentList.filter((o) => o.defeated);
    const needed = Math.max(0, targetCount - defeatedEntries.length);
    const replacements = pickOpponents(roster, role, floor, needed, {
      lockedRosterIds,
      avoidRosterIds,
      rng: options.rng,
    });
    return [...defeatedEntries, ...replacements];
  }

  /**
   * Re-randomize opponents for a given floor and scope ('all' | 'guards' | 'minibosses' | 'boss').
   * Preserves defeated opponents and respects cleared floors, pending penalties, and active Boss Bo3 matches.
   */
  function rerandomFloor(season, floor, scope = 'all', roster = [], settings, options = {}) {
    ensureFloorStates(season, roster, settings);
    const check = canRerandomFloor(season, floor, scope);
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const fs = season.floorStates[floor];
    const eco = getFloorEconomy(floor, settings);

    if (scope === 'all' || scope === 'guards') {
      if (canRerandomFloor(season, floor, 'guards').allowed) {
        fs.guards = rerandomSlotList(fs.guards || [], 'guard', floor, eco.guardCount, roster, options);
      }
    }

    if (scope === 'all' || scope === 'minibosses') {
      if (canRerandomFloor(season, floor, 'minibosses').allowed) {
        fs.minibosses = rerandomSlotList(
          fs.minibosses || [],
          'miniboss',
          floor,
          eco.minibossCount,
          roster,
          options
        );
      }
    }

    if (scope === 'all' || scope === 'boss') {
      if (canRerandomFloor(season, floor, 'boss').allowed) {
        const avoidBossIds = fs.boss && fs.boss.rosterId ? [fs.boss.rosterId] : [];
        const pickedBoss = pickOpponents(roster, 'boss', floor, 1, {
          avoidRosterIds: avoidBossIds,
          rng: options.rng,
        })[0];
        fs.boss = {
          ...pickedBoss,
          bo3Wins: 0,
          bo3Losses: 0,
        };
      }
    }

    if (floor === season.currentFloor) {
      season.floorState = fs;
    }

    return { floor, scope, floorState: fs };
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
   * Read season Event Points (EvP), migrating legacy winCounter 1:1 when present.
   */
  function getEventPoints(season) {
    if (!season) return 0;
    if (typeof season.eventPoints === 'number' && !Number.isNaN(season.eventPoints)) {
      return Math.max(0, Math.floor(season.eventPoints));
    }
    if (typeof season.winCounter === 'number' && !Number.isNaN(season.winCounter)) {
      return Math.max(0, Math.floor(season.winCounter));
    }
    return 0;
  }

  /**
   * Advance Event Points (EvP) by delta, triggering free_pack at packThreshold
   * and pick_card at pickCardThreshold with remainder carried over across cycles.
   */
  function advanceEventPoints(season, delta, settings) {
    const cfg = Constants.getEventConfig(settings);
    let current = getEventPoints(season);
    let remainingGain = Math.max(0, Math.floor(Number(delta) || 0));
    const triggeredEvents = [];
    const floor = season.currentFloor;
    season.pendingEvents = season.pendingEvents || [];

    while (remainingGain > 0) {
      const next = current + remainingGain;

      if (current < cfg.packThreshold && next >= cfg.packThreshold) {
        const ev = { type: 'free_pack', floor, threshold: cfg.packThreshold };
        season.pendingEvents.push(ev);
        triggeredEvents.push(ev);
      }

      if (next >= cfg.pickCardThreshold) {
        const ev = { type: 'pick_card', floor, threshold: cfg.pickCardThreshold };
        season.pendingEvents.push(ev);
        triggeredEvents.push(ev);
        remainingGain = next - cfg.pickCardThreshold;
        current = 0;
      } else {
        current = next;
        remainingGain = 0;
      }
    }

    season.eventPoints = current;
    return triggeredEvents;
  }

  /**
   * Record a duel game result against a Guard (Bo1), Mini-boss (Bo1), or Boss (Bo3 game).
   * Returns { dpEarned, evpEarned, triggeredEvent, triggeredEvents, matchEnded, matchWon, floorCleared, seasonCompleted }.
   */
  function recordDuelResult(season, role, index, won, roster, settings) {
    const fs = season.floorState;
    if (fs.pendingPenalty) {
      throw new Error('กรุณาเลือก Rematch หรือกลับไปสู้ทหารยามก่อนเริ่มแมตช์ใหม่');
    }

    const eco = getFloorEconomy(season.currentFloor, settings);
    const eventCfg = Constants.getEventConfig(settings);
    let dpEarned = 0;
    let evpEarned = 0;
    let triggeredEvents = [];
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
        evpEarned = eventCfg.winEvp;
        triggeredEvents = advanceEventPoints(season, evpEarned, settings);

        const allGuardsDone = fs.guards.every((g) => g.defeated);
        if (allGuardsDone) {
          const allMinibossDone = fs.minibosses.every((m) => m.defeated);
          fs.phase = allMinibossDone ? 'boss' : 'minibosses';
        }
      } else {
        dpEarned = eco.lossDp;
        season.dp += dpEarned;
        evpEarned = eventCfg.lossEvp;
        triggeredEvents = advanceEventPoints(season, evpEarned, settings);
      }
    } else if (role === 'miniboss') {
      matchEnded = true;
      if (won) {
        matchWon = true;
        fs.minibosses[index].defeated = true;
        dpEarned = eco.winDp;
        season.dp += dpEarned;
        evpEarned = eventCfg.winEvp;
        triggeredEvents = advanceEventPoints(season, evpEarned, settings);

        if (fs.minibosses.every((m) => m.defeated)) {
          fs.phase = 'boss';
        }
      } else {
        dpEarned = eco.lossDp;
        season.dp += dpEarned;
        evpEarned = eventCfg.lossEvp;
        triggeredEvents = advanceEventPoints(season, evpEarned, settings);
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
          evpEarned = eventCfg.winEvp;
          triggeredEvents = advanceEventPoints(season, evpEarned, settings);

          // Unlock floor packs
          season.unlockedFloors = season.unlockedFloors || [];
          if (!season.unlockedFloors.includes(season.currentFloor)) {
            season.unlockedFloors.push(season.currentFloor);
          }

          floorCleared = true;
          fs.phase = 'cleared';
          if (season.floorStates) {
            season.floorStates[season.currentFloor] = fs;
          }

          if (season.currentFloor >= 7) {
            season.status = 'completed';
            season.title = 'King of Duelist';
            season.completedAt = new Date().toISOString();
            seasonCompleted = true;
          } else {
            season.currentFloor += 1;
            season.floorState =
              (season.floorStates && season.floorStates[season.currentFloor]) ||
              createFloorState(season.currentFloor, roster, settings);
            if (season.floorStates) {
              season.floorStates[season.currentFloor] = season.floorState;
            }
          }
        }
      } else {
        fs.boss.bo3Losses += 1;
        if (fs.boss.bo3Losses >= 2) {
          matchEnded = true;
          dpEarned = eco.lossDp;
          season.dp += dpEarned;
          evpEarned = eventCfg.lossEvp;
          triggeredEvents = advanceEventPoints(season, evpEarned, settings);
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

    if (season.floorStates && season.floorState) {
      season.floorStates[season.currentFloor] = season.floorState;
    }

    const triggeredEvent = triggeredEvents.length ? triggeredEvents[triggeredEvents.length - 1].type : null;

    return {
      dpEarned,
      evpEarned,
      triggeredEvent,
      triggeredEvents,
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
    pickOpponents,
    createFloorState,
    createAllFloorStates,
    ensureFloorStates,
    getFloorState,
    canRerandomFloor,
    rerandomFloor,
    getFloorEconomy,
    getRematchCost,
    getEventPoints,
    recordDuelResult,
    payRematch,
    returnToGuards,
  };
});
