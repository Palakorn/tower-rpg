(function (root) {
  root.YgoTower = root.YgoTower || {};

  const MUTE_STORAGE_KEY = 'ygoTowerMuted';
  let activeCleanup = null;
  let audioCtx = null;

  function isMuted() {
    try {
      return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  function setMuted(muted) {
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
  }

  function toggleMute() {
    const next = !isMuted();
    setMuted(next);
    return next;
  }

  function getAudioContext() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      return audioCtx;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function playNote(ctx, freq, startOffset, duration, type, peakGain) {
    const now = ctx.currentTime + startOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function playSound(tier) {
    if (isMuted()) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      if (tier === 'champion' || tier === 'floor') {
        // Heroic ascending fanfare
        const notes = [
          { f: 523.25, t: 0.0, d: 0.14 },   // C5
          { f: 659.25, t: 0.1, d: 0.14 },   // E5
          { f: 783.99, t: 0.2, d: 0.14 },   // G5
          { f: 1046.5, t: 0.32, d: 0.55 },  // C6
        ];
        notes.forEach((n) => playNote(ctx, n.f, n.t, n.d, 'triangle', 0.16));
        playNote(ctx, 523.25, 0.32, 0.55, 'sine', 0.1);
        playNote(ctx, 783.99, 0.32, 0.55, 'sine', 0.09);
      } else if (tier === 'victory') {
        // Crisp victory triad
        playNote(ctx, 523.25, 0.0, 0.12, 'triangle', 0.14);
        playNote(ctx, 659.25, 0.09, 0.12, 'triangle', 0.14);
        playNote(ctx, 783.99, 0.18, 0.32, 'triangle', 0.15);
      } else {
        // Dramatic descending minor defeat chime
        playNote(ctx, 293.66, 0.0, 0.2, 'sawtooth', 0.07);  // D4
        playNote(ctx, 261.63, 0.14, 0.22, 'sawtooth', 0.07); // C4
        playNote(ctx, 220.0, 0.28, 0.45, 'triangle', 0.12);  // A3
        playNote(ctx, 110.0, 0.28, 0.5, 'sine', 0.14);       // A2 sub
      }
    } catch {
      // Audio playback is optional
    }
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveTier(opts) {
    const { won, res, hasPenalty } = opts;
    if (res.seasonCompleted) return 'champion';
    if (res.floorCleared) return 'floor';
    if (won) return 'victory';
    if (hasPenalty) return 'penalty';
    return 'defeat';
  }

  function buildContent(tier, opts) {
    const { won, res, opponentName, role, clearedFloor, bo3Note } = opts;

    let icon = '⚔️';
    let badge = 'DUEL RESULT';
    let title = 'VICTORY!';
    let subtitle = `เอาชนะ ${escapeHtml(opponentName)} สำเร็จ`;

    if (tier === 'champion') {
      icon = '👑';
      badge = 'KING OF DUELIST';
      title = 'CHAMPION!';
      subtitle = 'เคลียร์หอคอยครบทั้ง 7 ชั้นแล้ว!';
    } else if (tier === 'floor') {
      icon = '🏆';
      badge = `FLOOR ${clearedFloor} CLEARED`;
      title = 'FLOOR CLEAR!';
      subtitle = `พิชิตบอส ${escapeHtml(opponentName)} ปลดล็อกซองชั้นใหม่!`;
    } else if (tier === 'victory') {
      icon = role === 'boss' ? '⚡' : '⚔️';
      badge = bo3Note ? `BOSS BO3 (${bo3Note})` : 'DUEL VICTORY';
      title = 'VICTORY!';
      subtitle = bo3Note
        ? `ชนะเกมนี้เหนือ ${escapeHtml(opponentName)}`
        : `เอาชนะ ${escapeHtml(opponentName)} สำเร็จ`;
    } else if (tier === 'penalty') {
      icon = '💀';
      badge = 'CHECKPOINT TRIGGERED';
      title = 'DEFEAT...';
      subtitle = `พ่ายแพ้ต่อ ${escapeHtml(opponentName)} — เลือกแก้มือหรือกลับไปด่านทหารยาม`;
    } else {
      icon = '💔';
      badge = bo3Note ? `BOSS BO3 (${bo3Note})` : 'DUEL DEFEAT';
      title = 'DEFEAT...';
      subtitle = `พ่ายแพ้ต่อ ${escapeHtml(opponentName)}`;
    }

    const pills = [];
    if (res.dpEarned > 0) {
      pills.push(`<span class="battle-fx-pill battle-fx-pill--dp">+${res.dpEarned} DP</span>`);
    }
    if (res.triggeredEvent === 'free_pack') {
      pills.push(`<span class="battle-fx-pill battle-fx-pill--event">🎁 ครบ 4 ชนะ! รับซองฟรี</span>`);
    } else if (res.triggeredEvent === 'pick_card') {
      pills.push(`<span class="battle-fx-pill battle-fx-pill--event">🌟 ครบ 8 ชนะ! เลือกการ์ดฟรี 1 ใบ</span>`);
    }
    if (!won && !res.dpEarned && bo3Note) {
      pills.push(`<span class="battle-fx-pill battle-fx-pill--muted">ยังเหลือโอกาสพลิกเกมใน Bo3</span>`);
    }

    return `
      <div class="battle-fx-card" role="dialog" aria-live="polite">
        <div class="battle-fx-slash"></div>
        <div class="battle-fx-ring"></div>
        <div class="battle-fx-badge">${badge}</div>
        <div class="battle-fx-icon">${icon}</div>
        <h2 class="battle-fx-title">${title}</h2>
        <p class="battle-fx-subtitle">${subtitle}</p>
        ${pills.length ? `<div class="battle-fx-pills">${pills.join('')}</div>` : ''}
        <div class="battle-fx-hint">คลิกที่ใดก็ได้ หรือกด Esc เพื่อข้าม</div>
      </div>
    `;
  }

  function startParticles(canvas, tier) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => {};

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const isWin = tier === 'victory' || tier === 'floor' || tier === 'champion';
    const isGrand = tier === 'floor' || tier === 'champion';

    const winColors = isGrand
      ? ['#f5b942', '#fde047', '#34d399', '#60a5fa', '#f472b6']
      : ['#f5b942', '#34d399', '#fef08a', '#6c8cff'];
    const loseColors = ['#f87171', '#ef4444', '#991b1b', '#64748b'];
    const colors = isWin ? winColors : loseColors;

    const particles = [];
    const cx = width / 2;
    const cy = height / 2;

    if (isWin) {
      const burstCount = isGrand ? 95 : 55;
      for (let i = 0; i < burstCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (isGrand ? 4 : 3) + Math.random() * (isGrand ? 10 : 7);
        particles.push({
          x: cx + (Math.random() - 0.5) * 40,
          y: cy + (Math.random() - 0.5) * 30,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (isGrand ? 3 : 1.5),
          size: 3 + Math.random() * 5,
          color: colors[i % colors.length],
          alpha: 1,
          decay: 0.01 + Math.random() * 0.012,
          gravity: isGrand ? 0.16 : 0.08,
          isRect: isGrand && i % 2 === 0,
          rot: Math.random() * Math.PI,
          vRot: (Math.random() - 0.5) * 0.2,
        });
      }
    } else {
      const emberCount = tier === 'penalty' ? 60 : 40;
      for (let i = 0; i < emberCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: -10 - Math.random() * (height * 0.4),
          vx: (Math.random() - 0.5) * 1.4,
          vy: 1.5 + Math.random() * 2.8,
          size: 2 + Math.random() * 4,
          color: colors[i % colors.length],
          alpha: 0.85,
          decay: 0.005 + Math.random() * 0.006,
          gravity: 0.02,
          isRect: false,
          rot: 0,
          vRot: 0,
        });
      }
    }

    let rafId = 0;
    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.99;
        p.alpha -= p.decay;
        p.rot += p.vRot;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        if (p.isRect) {
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (particles.length > 0) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }

  function show(opts) {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }

    const tier = resolveTier(opts);
    const isGrand = tier === 'floor' || tier === 'champion';
    const isLoss = tier === 'defeat' || tier === 'penalty';

    const overlay = document.createElement('div');
    overlay.className = `battle-fx-overlay battle-fx--${tier}`;

    const canvas = document.createElement('canvas');
    canvas.className = 'battle-fx-canvas';
    overlay.appendChild(canvas);

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'battle-fx-center';
    contentWrapper.innerHTML = buildContent(tier, opts);
    overlay.appendChild(contentWrapper);

    document.body.appendChild(overlay);

    if (isLoss) {
      document.body.classList.remove('battle-fx-shake');
      void document.body.offsetWidth;
      document.body.classList.add('battle-fx-shake');
    }

    const stopParticles = startParticles(canvas, tier);
    playSound(tier);

    requestAnimationFrame(() => {
      overlay.classList.add('is-visible');
    });

    let dismissed = false;
    let autoTimer = 0;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      clearTimeout(autoTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('battle-fx-shake');
      overlay.classList.remove('is-visible');
      overlay.classList.add('is-leaving');
      setTimeout(() => {
        stopParticles();
        overlay.remove();
        if (activeCleanup === cleanupImmediate) {
          activeCleanup = null;
        }
      }, 260);
    };

    const cleanupImmediate = () => {
      if (dismissed) return;
      dismissed = true;
      clearTimeout(autoTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('battle-fx-shake');
      stopParticles();
      overlay.remove();
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        dismiss();
      }
    };

    overlay.addEventListener('click', dismiss);
    document.addEventListener('keydown', onKeyDown);
    autoTimer = setTimeout(dismiss, isGrand ? 3200 : 2300);
    activeCleanup = cleanupImmediate;
  }

  root.YgoTower.BattleEffects = {
    show,
    isMuted,
    setMuted,
    toggleMute,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
