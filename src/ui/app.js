(function (root) {
  root.YgoTower = root.YgoTower || {};

  const state = {
    activeTab: 'tower',
    activeSeason: null,
    settings: null,
  };

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(message) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3500);
  }

  function openModal(html) {
    const backdrop = document.getElementById('modalBackdrop');
    const content = document.getElementById('modalContent');
    content.innerHTML = html;
    backdrop.classList.add('open');
  }

  function closeModal() {
    const backdrop = document.getElementById('modalBackdrop');
    backdrop.classList.remove('open');
  }

  async function refreshState() {
    state.settings = await root.YgoTower.DB.getSettings();
    state.activeSeason = await root.YgoTower.DB.getActiveSeason();
  }

  function renderStatusBar() {
    const bar = document.getElementById('statusBar');
    const s = state.activeSeason;
    const BattleEffects = root.YgoTower.BattleEffects;
    const muted = BattleEffects ? BattleEffects.isMuted() : false;
    const soundBtnHtml = `<button type="button" class="sound-toggle-btn" id="soundToggleBtn" title="เปิด/ปิดเสียงเอฟเฟกต์">${muted ? '🔇 ปิดเสียง' : '🔊 เสียง'}</button>`;

    if (!s) {
      bar.innerHTML = `<span class="pill">ยังไม่มี Season ที่กำลังเล่น</span>${soundBtnHtml}`;
    } else {
      const pendingCount = (s.pendingEvents || []).length;
      const eventPill =
        pendingCount > 0
          ? `<button class="pill event-ready" id="headerEventBtn">🎁 รางวัล Event รอรับ (${pendingCount})</button>`
          : `<span class="pill">Event ชนะ: <strong>${s.winCounter || 0}/8</strong> (4=ซอง, 8=เลือกการ์ด)</span>`;

      bar.innerHTML = `
        <span class="pill">Season: <strong>${escapeHtml(s.name)}</strong></span>
        <span class="pill">ชั้น: <strong>${s.currentFloor}/7</strong></span>
        <span class="pill">DP: <strong>${s.dp}</strong></span>
        ${eventPill}
        ${soundBtnHtml}
      `;

      const evBtn = document.getElementById('headerEventBtn');
      if (evBtn) {
        evBtn.addEventListener('click', () => {
          switchTab('shop');
        });
      }
    }

    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn && BattleEffects) {
      soundBtn.addEventListener('click', () => {
        BattleEffects.toggleMute();
        renderStatusBar();
      });
    }
  }

  async function renderCurrentView() {
    await refreshState();
    renderStatusBar();

    const main = document.getElementById('mainView');
    const views = root.YgoTower.Views || {};
    const tabMap = {
      tower: views.renderTowerView,
      shop: views.renderShopView,
      deck: views.renderDeckBuilderView,
      recipes: views.renderRecipesView,
      roster: views.renderRosterView,
      hof: views.renderHallOfFameView,
      settings: views.renderSettingsView,
    };

    const renderer = tabMap[state.activeTab];
    if (typeof renderer === 'function') {
      await renderer(main, state);
    } else {
      main.innerHTML = `<div class="card">ไม่พบหน้าจอนี้</div>`;
    }
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    renderCurrentView();
  }

  async function init() {
    document.getElementById('navTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-tab');
      if (!btn) return;
      switchTab(btn.dataset.tab);
    });

    document.getElementById('modalBackdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modalBackdrop') closeModal();
    });

    try {
      if (root.YgoTower.Api && typeof root.YgoTower.Api.migrateCachedSetsIfNeeded === 'function') {
        await root.YgoTower.Api.migrateCachedSetsIfNeeded();
      }
    } catch (err) {
      console.warn('Pack cache migration skipped:', err);
    }

    renderCurrentView();
  }

  root.YgoTower.App = {
    state,
    escapeHtml,
    showToast,
    openModal,
    closeModal,
    refreshState,
    renderCurrentView,
    switchTab,
  };

  document.addEventListener('DOMContentLoaded', init);
})(typeof globalThis !== 'undefined' ? globalThis : this);
