// The HUD: health, money, wanted stars, objective line, minimap, toasts and menus.
// All DOM lives in index.html; this module only drives it.
export function createHud(doc) {
  const $ = (id) => doc.getElementById(id);
  const healthFill = $('health-fill');
  const healthText = $('health-text');
  const moneyText = $('money');
  const starsEl = $('stars');
  const objectiveEl = $('objective');
  const toastEl = $('toast');
  const bannerEl = $('banner');
  const bannerTitle = $('banner-title');
  const bannerSub = $('banner-sub');
  const holdWrap = $('hold-wrap');
  const holdFill = $('hold-fill');
  const hintEl = $('hint');
  const minimap = $('minimap');
  const mctx = minimap.getContext('2d');
  const districtEl = $('district');
  let toastTimer = null;
  let bannerTimer = null;

  const STAR_ON = '★';
  const STAR_OFF = '☆';

  return {
    setHealth(hp, max) {
      const pct = Math.max(0, Math.min(100, (hp / max) * 100));
      healthFill.style.width = `${pct}%`;
      healthFill.style.background = pct > 50 ? '#4ad87a' : pct > 25 ? '#d8a13c' : '#d83c3c';
      healthText.textContent = `${Math.ceil(hp)}`;
    },
    setMoney(amount) {
      moneyText.textContent = `$${Math.floor(amount).toLocaleString('en-US')}`;
    },
    setRep(rep, rank) {
      const el = $('rep');
      if (el) el.textContent = `${rank} • ${Math.floor(rep)} rep`;
    },
    setAmmo(ammo, magSize, reloading) {
      const el = $('ammo');
      if (!el) return;
      el.textContent = reloading ? 'RELOADING…' : `AMMO ${ammo}/${magSize}`;
      el.classList.toggle('low', !reloading && ammo <= 3);
    },
    setWanted(stars) {
      let s = '';
      for (let i = 0; i < 5; i += 1) s += i < stars ? STAR_ON : STAR_OFF;
      starsEl.textContent = s;
      starsEl.classList.toggle('hot', stars > 0);
    },
    setObjective(text) {
      objectiveEl.textContent = text;
    },
    setDistrict(name) {
      districtEl.textContent = name;
    },
    setHint(text) {
      hintEl.textContent = text;
    },
    toast(msg, ms = 3500) {
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
    },
    banner(title, sub, ms = 3200) {
      bannerTitle.textContent = title;
      bannerSub.textContent = sub || '';
      bannerEl.classList.add('show');
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => bannerEl.classList.remove('show'), ms);
    },
    setHold(progress) {
      if (progress > 0 && progress < 1) {
        holdWrap.classList.add('show');
        holdFill.style.width = `${Math.round(progress * 100)}%`;
      } else {
        holdWrap.classList.remove('show');
      }
    },
    showScreen(name) {
      for (const id of ['screen-start', 'screen-pause', 'screen-wasted', 'screen-complete']) {
        $(id).classList.toggle('show', id === `screen-${name}`);
      }
      $('hud').classList.toggle('hidden', name === 'start');
    },
    hideScreens() {
      for (const id of ['screen-start', 'screen-pause', 'screen-wasted', 'screen-complete']) {
        $(id).classList.remove('show');
      }
      $('hud').classList.remove('hidden');
    },
    setSaveInfo(text) {
      $('save-info').textContent = text;
    },
    /** Draw the minimap: water, land, roads, blips. `s` carries the live state. */
    drawMinimap(s) {
      const W = minimap.width;
      const H = minimap.height;
      const scale = 0.25;
      const ox = 17.5;
      const oy = 0;
      const px = (x) => ox + (x + 290) * scale;
      const py = (z) => oy + (z + 440) * scale;
      mctx.clearRect(0, 0, W, H);
      // Water.
      mctx.fillStyle = '#1f5f8e';
      mctx.fillRect(0, 0, W, H);
      // Land: city square + island.
      mctx.fillStyle = '#2e3138';
      mctx.fillRect(px(-260), py(-260), 520 * scale, 520 * scale);
      mctx.beginPath();
      mctx.arc(px(0), py(-380), 95 * scale, 0, Math.PI * 2);
      mctx.fill();
      // Roads.
      mctx.strokeStyle = '#6a6e78';
      mctx.lineWidth = 2;
      for (let i = -5; i <= 5; i += 1) {
        const p = i * 52;
        mctx.beginPath();
        mctx.moveTo(px(p), py(-260));
        mctx.lineTo(px(p), py(260));
        mctx.stroke();
        mctx.beginPath();
        mctx.moveTo(px(-260), py(p));
        mctx.lineTo(px(260), py(p));
        mctx.stroke();
      }
      // Bridge.
      mctx.beginPath();
      mctx.moveTo(px(0), py(-260));
      mctx.lineTo(px(0), py(-364));
      mctx.stroke();
      // Safehouse.
      mctx.fillStyle = '#4ad87a';
      mctx.fillRect(px(78) - 3, py(78) - 3, 6, 6);
      // Mission target (pulsing yellow diamond).
      if (s.target) {
        const pulse = 5 + Math.sin(s.time * 5) * 2;
        mctx.fillStyle = '#ffd23c';
        mctx.beginPath();
        mctx.moveTo(px(s.target.x), py(s.target.z) - pulse);
        mctx.lineTo(px(s.target.x) + pulse, py(s.target.z));
        mctx.lineTo(px(s.target.x), py(s.target.z) + pulse);
        mctx.lineTo(px(s.target.x) - pulse, py(s.target.z));
        mctx.closePath();
        mctx.fill();
      }
      // Police (red dots).
      mctx.fillStyle = '#ff4040';
      for (const u of s.policeUnits) {
        mctx.beginPath();
        mctx.arc(px(u.x), py(u.z), 3, 0, Math.PI * 2);
        mctx.fill();
      }
      // Player (white arrow, rotated by heading; canvas y grows with +z).
      mctx.save();
      mctx.translate(px(s.player.x), py(s.player.z));
      mctx.rotate(Math.PI - s.player.heading);
      mctx.fillStyle = '#ffffff';
      mctx.beginPath();
      mctx.moveTo(0, -6);
      mctx.lineTo(4.5, 5);
      mctx.lineTo(-4.5, 5);
      mctx.closePath();
      mctx.fill();
      mctx.restore();
    },
  };
}
