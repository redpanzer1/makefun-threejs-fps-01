// The DOM HUD: it never touches the simulation. main.js pushes numbers in
// and reads callbacks out. Zones follow the reference: top-left status
// (score, integrity, armour, grenades, money, weapon slots), top-centre
// compass + round timer + hostiles, top-right minimap + weapon card.
// Numbers sit in fixed-width containers so the layout never shifts.
import { WEAPONS, FRAG_PRICE, ARMOR_PRICE } from './weapons.js';
import { BOXES, MAP } from './map.js';

const SHOP = [
  { id: 'kestrel', label: 'RIFLE' },
  { id: 'wasp', label: 'SMG' },
  { id: 'falcon', label: 'PISTOL' },
  { id: 'longbow', label: 'SNIPER' },
  { id: 'frag', label: 'FRAG GRENADE' },
  { id: 'armor', label: 'ARMOUR' },
];

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    score: $('stat-score'), kills: $('stat-kills'), hs: $('stat-hs'),
    integrityNum: $('integrity-num'), integrityFill: $('integrity-fill'),
    armorVal: $('armor-val'), grenadeVal: $('grenade-val'), moneyVal: $('money-val'),
    slots: $('slots'),
    compass: $('compass'), timer: $('timer'), roundLabel: $('round-label'), hostiles: $('hostiles'),
    minimap: $('minimap'), weaponName: $('weapon-name'),
    ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'),
    killfeed: $('killfeed'), crosshair: $('crosshair'), hitmarker: $('hitmarker'),
    scope: $('scope'), vignette: $('vignette'), banner: $('banner'), bannerSub: $('banner-sub'),
    prompt: $('prompt'), plantRing: $('plant-ring'),
    buyMenu: $('buy-menu'), buyItems: $('buy-items'), buyMoney: $('buy-money'),
    overlay: $('overlay'), overlayTitle: $('overlay-title'), overlayCopy: $('overlay-copy'),
    play: $('play'),
  };
  const compassCtx = el.compass.getContext('2d');
  const mapCtx = el.minimap.getContext('2d');
  const cache = {};
  let hitTimer = 0;
  let bannerTimer = 0;
  let buyHandler = null;
  let deployHandler = null;

  const COPY = {
    start: { title: 'DUSTLINE DEPOT', copy: 'One attacker. Five defenders. Two bomb sites. Plant the bomb or wipe the Jackals — and mind your money.', action: 'Click to play' },
    paused: { title: 'DUSTLINE DEPOT', copy: 'Paused. Click to resume.', action: 'Click to resume' },
    overWin: { title: 'ROUND WON', copy: '', action: 'Next round' },
    overLose: { title: 'ROUND LOST', copy: '', action: 'Next round' },
  };

  function setText(node, value, key) {
    if (cache[key] === value) return;
    cache[key] = value;
    node.textContent = value;
  }

  function buildSlots() {
    el.slots.innerHTML = '';
    for (const def of Object.values(WEAPONS)) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.id = `slot-${def.id}`;
      slot.innerHTML = `<b>${def.slot}</b> ${def.name.split(' ')[0]}`;
      el.slots.appendChild(slot);
    }
    const frag = document.createElement('div');
    frag.className = 'slot';
    frag.id = 'slot-frag';
    frag.innerHTML = '<b>6</b> FRAG';
    el.slots.appendChild(frag);
  }
  buildSlots();

  function buildShop() {
    el.buyItems.innerHTML = '';
    for (const item of SHOP) {
      const def = WEAPONS[item.id];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'shop-item';
      row.id = `buy-${item.id}`;
      const price = item.id === 'frag' ? FRAG_PRICE : item.id === 'armor' ? ARMOR_PRICE : def.price;
      const stats = def ? `${def.damage} dmg · ${def.mag} mag` : item.id === 'frag' ? 'blast · 7 m' : 'absorbs half damage';
      row.innerHTML = `<span class="shop-name">${def ? def.name : item.label}</span><span class="shop-stats">${stats}</span><span class="shop-price">$${price}</span>`;
      row.addEventListener('click', () => buyHandler && buyHandler(item.id));
      el.buyItems.appendChild(row);
    }
    $('deploy-btn').addEventListener('click', () => deployHandler && deployHandler());
  }
  buildShop();

  function drawCompass(yaw) {
    const ctx = compassCtx;
    const w = el.compass.width;
    const h = el.compass.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(25,21,18,0.72)';
    ctx.fillRect(0, 0, w, h);
    const heading = ((-yaw * 180) / Math.PI % 360 + 360) % 360;
    const labels = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let deg = -60; deg <= 420; deg += 15) {
      let rel = ((deg - heading + 540) % 360) - 180;
      if (rel < -60 || rel > 60) continue;
      const x = w / 2 + (rel / 60) * (w / 2 - 8);
      const isCard = labels.some(([d]) => d === ((deg % 360) + 360) % 360);
      ctx.fillStyle = isCard ? '#f5b81e' : 'rgba(242,237,227,0.75)';
      ctx.fillRect(x - 0.5, isCard ? 4 : 8, 1, isCard ? 10 : 6);
      if (isCard) {
        const label = labels.find(([d]) => d === ((deg % 360) + 360) % 360)[1];
        ctx.fillText(label, x, 21);
      }
    }
    ctx.fillStyle = '#e5484d';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 5, 2);
    ctx.lineTo(w / 2 + 5, 2);
    ctx.lineTo(w / 2, 8);
    ctx.closePath();
    ctx.fill();
  }

  function drawMinimap(player, bots, bomb, time) {
    const ctx = mapCtx;
    const w = el.minimap.width;
    const h = el.minimap.height;
    const s = w / 58;
    const ox = w / 2;
    const oy = h / 2;
    const X = (x) => ox + x * s;
    const Z = (z) => oy + z * s;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(25,21,18,0.85)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#6e5f45';
    for (const [bw, , bd, bx, , bz] of BOXES) {
      if (bw === 56 || bd === 44.6 || bw === 56.6 || bd === 44.6) continue; // perimeter
      ctx.fillRect(X(bx - bw / 2), Z(bz - bd / 2), Math.max(2, bw * s), Math.max(2, bd * s));
    }
    ctx.strokeStyle = '#f5b81e';
    ctx.lineWidth = 1.5;
    for (const key of Object.keys(MAP.sites)) {
      const site = MAP.sites[key];
      ctx.beginPath();
      ctx.arc(X(site.x), Z(site.z), site.r * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#f5b81e';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(key, X(site.x), Z(site.z) - site.r * s - 4);
    }
    // Bots the player has spotted recently.
    for (const bot of bots) {
      if (!bot.alive || time - bot.spottedAt > 4) continue;
      ctx.fillStyle = '#e5484d';
      ctx.beginPath();
      ctx.arc(X(bot.pos.x), Z(bot.pos.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (bomb.state === 'planted' && Math.floor(time * 2) % 2 === 0) {
      ctx.fillStyle = '#f5b81e';
      ctx.beginPath();
      ctx.arc(X(bomb.x), Z(bomb.z), 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const px = X(player.position.x);
    const pz = Z(player.position.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-player.yaw);
    ctx.fillStyle = '#f2ede3';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return {
    setStatus({ score, kills, hs, health, armor, grenades, money }) {
      setText(el.score, String(score), 'score');
      setText(el.kills, String(kills), 'kills');
      setText(el.hs, String(hs), 'hs');
      setText(el.integrityNum, String(Math.ceil(health)), 'hp');
      if (cache.hpFill !== health) {
        cache.hpFill = health;
        el.integrityFill.style.width = `${Math.max(0, health)}%`;
        el.integrityFill.style.background = health <= 30 ? '#e5484d' : health <= 60 ? '#f5b81e' : '#57a773';
      }
      setText(el.armorVal, String(Math.ceil(armor)), 'armor');
      setText(el.grenadeVal, String(grenades), 'grenades');
      setText(el.moneyVal, `$${money}`, 'money');
    },
    setSlots(currentId, owned, frags) {
      for (const def of Object.values(WEAPONS)) {
        const slot = document.getElementById(`slot-${def.id}`);
        if (!slot) continue;
        slot.classList.toggle('owned', owned.has(def.id));
        slot.classList.toggle('current', def.id === currentId);
      }
      const frag = document.getElementById('slot-frag');
      frag.classList.toggle('owned', frags > 0);
      frag.textContent = `6 FRAG ×${frags}`;
      frag.innerHTML = `<b>6</b> FRAG ×${frags}`;
    },
    setAmmo(mag, reserve, name) {
      setText(el.weaponName, name, 'wname');
      if (typeof mag === 'number') {
        setText(el.ammoMag, String(mag), 'mag');
        setText(el.ammoReserve, `/ ${reserve}`, 'res');
        el.ammoMag.parentElement.classList.toggle('empty', mag === 0);
      } else {
        setText(el.ammoMag, '—', 'mag');
        setText(el.ammoReserve, '', 'res');
      }
    },
    setObjective({ round, timeLeft, hostiles, phase }) {
      setText(el.roundLabel, `ROUND ${round}`, 'round');
      const t = Math.max(0, Math.ceil(timeLeft));
      const mm = String(Math.floor(t / 60));
      const ss = String(t % 60).padStart(2, '0');
      setText(el.timer, `${mm}:${ss}`, 'timer');
      setText(el.hostiles, `HOSTILES ${hostiles}`, 'hostiles');
      el.timer.classList.toggle('low', t <= 10 && phase === 'live');
    },
    setCompass,
    drawMinimap,
    killfeed(html) {
      const row = document.createElement('div');
      row.className = 'feed-row';
      row.innerHTML = html;
      el.killfeed.prepend(row);
      while (el.killfeed.children.length > 4) el.killfeed.lastChild.remove();
      setTimeout(() => row.classList.add('fade'), 3800);
      setTimeout(() => row.remove(), 4400);
    },
    banner(text, sub = '') {
      el.banner.textContent = text;
      el.bannerSub.textContent = sub;
      el.banner.parentElement.classList.add('show');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => el.banner.parentElement.classList.remove('show'), 2600);
    },
    prompt(text) {
      if (cache.prompt === text) return;
      cache.prompt = text;
      el.prompt.textContent = text;
      el.prompt.classList.toggle('show', text !== '');
    },
    hitMarker(killed, holdMs = 90) {
      el.hitmarker.classList.add('on');
      el.hitmarker.classList.toggle('kill', killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => el.hitmarker.classList.remove('on', 'kill'), holdMs);
    },
    damageFlash() {
      el.vignette.classList.remove('hit');
      void el.vignette.offsetWidth;
      el.vignette.classList.add('hit');
    },
    setCrosshair(gap) {
      el.crosshair.style.setProperty('--gap', `${gap.toFixed(1)}px`);
    },
    setScope(on) {
      el.scope.classList.toggle('on', on);
      el.crosshair.classList.toggle('hidden', on);
    },
    setPlant(p) {
      if (p === null) {
        el.plantRing.classList.remove('show');
        return;
      }
      el.plantRing.classList.add('show');
      el.plantRing.style.setProperty('--p', `${(p * 360).toFixed(0)}deg`);
    },
    showBuy(money, owned, frags, armor) {
      for (const item of SHOP) {
        const row = document.getElementById(`buy-${item.id}`);
        const def = WEAPONS[item.id];
        const price = item.id === 'frag' ? FRAG_PRICE : item.id === 'armor' ? ARMOR_PRICE : def.price;
        const isOwned = item.id === 'frag' ? frags >= 3 : item.id === 'armor' ? armor >= 100 : owned.has(item.id);
        const afford = money >= price;
        row.classList.toggle('owned', isOwned);
        row.classList.toggle('cant', !isOwned && !afford);
        row.querySelector('.shop-price').textContent = isOwned ? 'OWNED' : `$${price}`;
      }
      el.buyMoney.textContent = `$${money}`;
      el.buyMenu.classList.add('show');
    },
    hideBuy() {
      el.buyMenu.classList.remove('show');
    },
    showOverlay(mode, data = {}) {
      const text = COPY[mode];
      el.overlayTitle.textContent = text.title;
      el.overlayCopy.textContent = mode.startsWith('over') ? `${data.reason ?? ''} Rounds ${data.won ?? 0}–${data.lost ?? 0}.` : text.copy;
      el.play.textContent = text.action;
      el.overlay.hidden = false;
      el.play.focus();
    },
    hideOverlay() {
      el.overlay.hidden = true;
    },
    onPlay(handler) {
      el.play.addEventListener('click', handler);
    },
    onBuy(handler) {
      buyHandler = handler;
    },
    onDeploy(handler) {
      deployHandler = handler;
    },
  };
}
