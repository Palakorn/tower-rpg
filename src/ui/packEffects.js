(function (root) {
  root.YgoTower = root.YgoTower || {};

  let activeCleanup = null;
  let audioCtx = null;

  function isMuted() {
    const BattleEffects = root.YgoTower.BattleEffects;
    if (BattleEffects && typeof BattleEffects.isMuted === 'function') {
      return BattleEffects.isMuted();
    }
    try {
      return localStorage.getItem('ygoTowerMuted') === '1';
    } catch {
      return false;
    }
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
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playPackCharge() {
    if (isMuted()) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.55);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch {
      // Optional audio
    }
  }

  function playPackTear() {
    if (isMuted()) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Crisp noise burst for foil tear
      const bufferSize = Math.floor(ctx.sampleRate * 0.18);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);

      // Sub pop
      playNote(ctx, 130, 0, 0.22, 'sine', 0.16);
      playNote(ctx, 523.25, 0.04, 0.25, 'triangle', 0.1);
    } catch {
      // Optional audio
    }
  }

  function playCardFlip(bucket) {
    if (isMuted()) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      if (bucket === 'secret') {
        [587.33, 739.99, 880, 1174.66, 1479.98].forEach((f, idx) => {
          playNote(ctx, f, idx * 0.055, 0.35, 'triangle', 0.13);
        });
        playNote(ctx, 1174.66, 0.22, 0.45, 'sine', 0.1);
      } else if (bucket === 'ultra') {
        playNote(ctx, 523.25, 0, 0.22, 'triangle', 0.12);
        playNote(ctx, 659.25, 0.06, 0.24, 'triangle', 0.12);
        playNote(ctx, 1046.5, 0.12, 0.34, 'sine', 0.13);
      } else if (bucket === 'super') {
        playNote(ctx, 587.33, 0, 0.16, 'triangle', 0.1);
        playNote(ctx, 880, 0.07, 0.22, 'sine', 0.1);
      } else if (bucket === 'rare') {
        playNote(ctx, 660, 0, 0.09, 'sine', 0.06);
      } else {
        playNote(ctx, 420, 0, 0.06, 'sine', 0.04);
      }
    } catch {
      // Optional audio
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

  function createParticleSystem(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { burst: () => {}, stop: () => {} };

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const particles = [];
    let rafId = 0;

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.985;
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (particles.length > 0) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    };

    const burst = (x, y, colors, count, speedMax) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * speedMax;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          size: 2 + Math.random() * 3.5,
          color: colors[i % colors.length],
          alpha: 1,
          decay: 0.014 + Math.random() * 0.014,
          gravity: 0.08,
        });
      }
      if (!rafId) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const stop = () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };

    return { burst, stop };
  }

  function burstForRarity(particles, el, bucket) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    if (bucket === 'secret') {
      particles.burst(cx, cy, ['#f472b6', '#a78bfa', '#60a5fa', '#fbbf24', '#34d399'], 42, 7.5);
    } else if (bucket === 'ultra') {
      particles.burst(cx, cy, ['#fbbf24', '#fef08a', '#f59e0b', '#ffffff'], 28, 6);
    } else if (bucket === 'super') {
      particles.burst(cx, cy, ['#34d399', '#6ee7b7', '#ffffff'], 16, 4.5);
    }
  }

  function show({ setName, packImageUrl, pulledItems, onDone }) {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }

    const overlay = document.createElement('div');
    overlay.className = 'pack-fx-overlay';

    const canvas = document.createElement('canvas');
    canvas.className = 'pack-fx-canvas';
    overlay.appendChild(canvas);

    const cardsHtml = pulledItems
      .map(
        (p, idx) => `
      <div class="pack-fx-card-slot rarity-${escapeHtml(p.bucket || 'common')}" data-slot-idx="${idx}">
        <div class="pack-fx-card-inner">
          <div class="pack-fx-card-face pack-fx-card-back">
            <div class="pack-fx-card-back-ring"></div>
          </div>
          <div class="pack-fx-card-face pack-fx-card-front">
            <div class="pack-fx-holo"></div>
            <img src="${escapeHtml(p.card.image_url || '')}" alt="${escapeHtml(p.card.name)}" />
            <span class="badge badge-${escapeHtml(p.bucket)}">${escapeHtml(p.rarity)}</span>
            <strong class="pack-fx-card-name">${escapeHtml(p.card.name)}</strong>
          </div>
        </div>
      </div>
    `
      )
      .join('');

    const stage = document.createElement('div');
    stage.className = 'pack-fx-stage';
    stage.innerHTML = `
      <div class="pack-fx-header">
        <h3 class="pack-fx-title">✨ เปิดซอง: ${escapeHtml(setName)}</h3>
      </div>

      <div class="pack-fx-rip-zone" id="packFxRipZone">
        <div class="pack-fx-pack-wrap" id="packFxPackWrap">
          <div class="pack-fx-pack-glow"></div>
          ${
            packImageUrl
              ? `<img class="pack-fx-pack-img" src="${escapeHtml(packImageUrl)}" alt="${escapeHtml(setName)}" />`
              : `<div class="pack-fx-pack-fallback">🃏<span>${escapeHtml(setName)}</span></div>`
          }
          <div class="pack-fx-tear-line"></div>
        </div>
        <div class="pack-fx-rip-caption">กำลังฉีกซอง...</div>
      </div>

      <div class="pack-fx-cards-zone" id="packFxCardsZone" style="display:none;">
        <div class="pack-fx-grid">${cardsHtml}</div>
      </div>

      <div class="pack-fx-actions">
        <button type="button" class="btn" id="packFxSkipBtn">ข้าม / เปิดทั้งหมด</button>
        <button type="button" class="btn btn-primary" id="packFxCollectBtn" style="display:none;">เก็บเข้าคลัง</button>
      </div>
    `;
    overlay.appendChild(stage);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    const particles = createParticleSystem(canvas);
    const ripZone = stage.querySelector('#packFxRipZone');
    const packWrap = stage.querySelector('#packFxPackWrap');
    const cardsZone = stage.querySelector('#packFxCardsZone');
    const skipBtn = stage.querySelector('#packFxSkipBtn');
    const collectBtn = stage.querySelector('#packFxCollectBtn');
    const slots = Array.from(stage.querySelectorAll('.pack-fx-card-slot'));

    const timers = [];
    let closed = false;
    let allRevealed = false;
    let stage2Started = false;

    const addTimer = (fn, ms) => {
      const id = setTimeout(fn, ms);
      timers.push(id);
      return id;
    };

    const clearAllTimers = () => {
      while (timers.length) clearTimeout(timers.pop());
    };

    const finishRevealUI = () => {
      if (allRevealed) return;
      allRevealed = true;
      skipBtn.style.display = 'none';
      collectBtn.style.display = 'inline-flex';
    };

    const revealSlot = (idx, withFx = true) => {
      const slot = slots[idx];
      if (!slot || slot.classList.contains('is-flipped')) return;
      slot.classList.add('is-flipped');
      const item = pulledItems[idx];
      const bucket = item ? item.bucket : 'common';
      if (withFx) {
        playCardFlip(bucket);
        burstForRarity(particles, slot, bucket);
      }
      if (slots.every((s) => s.classList.contains('is-flipped'))) {
        finishRevealUI();
      }
    };

    const revealAllImmediately = () => {
      clearAllTimers();
      if (!stage2Started) {
        stage2Started = true;
        ripZone.style.display = 'none';
        cardsZone.style.display = 'block';
      }
      let bestBucket = 'common';
      const rank = { common: 0, rare: 1, super: 2, ultra: 3, secret: 4 };
      slots.forEach((slot, idx) => {
        const wasFlipped = slot.classList.contains('is-flipped');
        slot.classList.add('is-flipped');
        const bucket = pulledItems[idx]?.bucket || 'common';
        if (!wasFlipped && (rank[bucket] || 0) > (rank[bestBucket] || 0)) {
          bestBucket = bucket;
        }
        if (!wasFlipped && (bucket === 'ultra' || bucket === 'secret')) {
          burstForRarity(particles, slot, bucket);
        }
      });
      playCardFlip(bestBucket);
      finishRevealUI();
    };

    const startStage2 = () => {
      if (closed || stage2Started) return;
      stage2Started = true;
      ripZone.style.display = 'none';
      cardsZone.style.display = 'block';

      let delay = 140;
      pulledItems.forEach((item, idx) => {
        const bucket = item.bucket || 'common';
        // Slight dramatic pause before Ultra/Secret
        if (bucket === 'secret') delay += 220;
        else if (bucket === 'ultra') delay += 120;

        addTimer(() => {
          if (!closed) revealSlot(idx, true);
        }, delay);

        delay += bucket === 'secret' ? 380 : bucket === 'ultra' ? 300 : 210;
      });
    };

    // Stage 1 timeline: charge -> tear burst -> stage 2
    playPackCharge();
    addTimer(() => {
      if (closed || stage2Started) return;
      packWrap.classList.add('is-tearing');
      playPackTear();
      const rect = packWrap.getBoundingClientRect();
      particles.burst(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        ['#f5b942', '#6c8cff', '#ffffff', '#34d399'],
        65,
        9
      );
    }, 680);

    addTimer(() => {
      startStage2();
    }, 1150);

    // Allow clicking individual face-down cards to flip early
    slots.forEach((slot, idx) => {
      slot.addEventListener('click', () => {
        if (!slot.classList.contains('is-flipped')) {
          revealSlot(idx, true);
        }
      });
    });

    const close = () => {
      if (closed) return;
      closed = true;
      clearAllTimers();
      document.removeEventListener('keydown', onKeyDown);
      overlay.classList.remove('is-visible');
      overlay.classList.add('is-leaving');
      setTimeout(() => {
        particles.stop();
        overlay.remove();
        if (activeCleanup === cleanupImmediate) {
          activeCleanup = null;
        }
        if (typeof onDone === 'function') onDone();
      }, 240);
    };

    const cleanupImmediate = () => {
      if (closed) return;
      closed = true;
      clearAllTimers();
      document.removeEventListener('keydown', onKeyDown);
      particles.stop();
      overlay.remove();
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (!allRevealed) revealAllImmediately();
        else close();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!allRevealed) revealAllImmediately();
        else close();
      }
    };

    skipBtn.addEventListener('click', revealAllImmediately);
    collectBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKeyDown);
    activeCleanup = cleanupImmediate;
  }

  function showCardPick({ card, onDone }) {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }

    const overlay = document.createElement('div');
    overlay.className = 'pack-fx-overlay pick-fx-overlay';

    const canvas = document.createElement('canvas');
    canvas.className = 'pack-fx-canvas';
    overlay.appendChild(canvas);

    const stage = document.createElement('div');
    stage.className = 'pick-fx-stage';
    stage.innerHTML = `
      <div class="pick-fx-ring"></div>
      <div class="pick-fx-badge">🌟 8-WIN MILESTONE REWARD</div>
      <h3 class="pick-fx-title">ได้รับการ์ดรางวัล!</h3>
      <div class="pick-fx-card-wrap">
        <div class="pick-fx-card-aura"></div>
        <div class="pick-fx-card">
          <div class="pick-fx-holo"></div>
          <img src="${escapeHtml(card?.image_url || '')}" alt="${escapeHtml(card?.name || '')}" />
        </div>
      </div>
      <div class="pick-fx-name">${escapeHtml(card?.name || 'Unknown Card')}</div>
      <div class="pick-fx-pill">✨ เพิ่มเข้าคลัง +1 ใบ</div>
      <div class="pick-fx-hint">คลิกที่ใดก็ได้ หรือกด Esc เพื่อดำเนินการต่อ</div>
    `;
    overlay.appendChild(stage);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    const particles = createParticleSystem(canvas);
    playCardFlip('secret');

    const burstTimer = setTimeout(() => {
      const cardEl = stage.querySelector('.pick-fx-card');
      if (!cardEl) return;
      const rect = cardEl.getBoundingClientRect();
      particles.burst(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        ['#f5b942', '#fde047', '#34d399', '#60a5fa', '#f472b6'],
        55,
        8.5
      );
    }, 180);

    let closed = false;
    let autoTimer = 0;

    const close = () => {
      if (closed) return;
      closed = true;
      clearTimeout(burstTimer);
      clearTimeout(autoTimer);
      document.removeEventListener('keydown', onKeyDown);
      overlay.classList.remove('is-visible');
      overlay.classList.add('is-leaving');
      setTimeout(() => {
        particles.stop();
        overlay.remove();
        if (activeCleanup === cleanupImmediate) {
          activeCleanup = null;
        }
        if (typeof onDone === 'function') onDone();
      }, 240);
    };

    const cleanupImmediate = () => {
      if (closed) return;
      closed = true;
      clearTimeout(burstTimer);
      clearTimeout(autoTimer);
      document.removeEventListener('keydown', onKeyDown);
      particles.stop();
      overlay.remove();
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        close();
      }
    };

    overlay.addEventListener('click', close);
    document.addEventListener('keydown', onKeyDown);
    autoTimer = setTimeout(close, 2800);
    activeCleanup = cleanupImmediate;
  }

  root.YgoTower.PackEffects = {
    show,
    showCardPick,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
