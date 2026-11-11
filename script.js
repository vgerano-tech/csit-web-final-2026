(() => {
  const cv = document.getElementById('space'), ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, on = !reduce, t = 0, last = 0, mx = 0, my = 0, tx = 0, ty = 0, sy = scrollY;
  const rnd = Math.random, lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const parts = Array.from({ length: 150 }, () => ({ x: rnd(), y: rnd(), z: .15 + rnd() * .85, s: .002 + rnd() * .006, p: rnd() * 6.28 }));

  function size() {
    const d = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * d; cv.height = H * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  size();
  addEventListener('resize', size);
  addEventListener('pointermove', e => { tx = e.clientX / W - .5; ty = e.clientY / H - .5; });
  addEventListener('scroll', () => { sy = scrollY; }, { passive: true });

  // Rotate a 3D point, then project it with a little perspective
  function proj(x, y, z, a, b, R, ox, oy) {
    const x1 = x * Math.cos(a) + z * Math.sin(a), z1 = -x * Math.sin(a) + z * Math.cos(a);
    const y1 = y * Math.cos(b) - z1 * Math.sin(b), z2 = y * Math.sin(b) + z1 * Math.cos(b);
    const k = 1 / (1 + z2 * .22);
    return [ox + x1 * R * k, oy + y1 * R * k, z2];
  }

  function planet(ox, oy, R, a, b, alpha) {
    const g = ctx.createRadialGradient(ox, oy, R * .2, ox, oy, R * 1.9);
    g.addColorStop(0, `rgba(94,231,255,${.16 * alpha})`); g.addColorStop(1, 'rgba(94,231,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, R * 1.9, 0, 7); ctx.fill();

    // Three paths by depth (back, middle, front) so far lines look dimmer
    const B = [new Path2D(), new Path2D(), new Path2D()];
    const seg = pts => {
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1], q = pts[i], z = (p[2] + q[2]) / 2, k = z > .35 ? 0 : z > -.35 ? 1 : 2;
        B[k].moveTo(p[0], p[1]); B[k].lineTo(q[0], q[1]);
      }
    };
    for (let i = 1; i < 8; i++) {
      const lat = -Math.PI / 2 + i * Math.PI / 8, r = Math.cos(lat), y = Math.sin(lat), pts = [];
      for (let j = 0; j <= 48; j++) { const th = j / 48 * 6.2832; pts.push(proj(r * Math.cos(th), y, r * Math.sin(th), a, b, R, ox, oy)); }
      seg(pts);
    }
    for (let i = 0; i < 16; i++) {
      const lon = i / 16 * 6.2832, pts = [];
      for (let j = 0; j <= 48; j++) { const la = -Math.PI / 2 + j / 48 * Math.PI; pts.push(proj(Math.cos(la) * Math.cos(lon), Math.sin(la), Math.cos(la) * Math.sin(lon), a, b, R, ox, oy)); }
      seg(pts);
    }
    const tilt = .35, ring = rad => {
      const pts = [];
      for (let j = 0; j <= 90; j++) { const th = j / 90 * 6.2832, x = rad * Math.cos(th); pts.push(proj(x * Math.cos(tilt), x * Math.sin(tilt), rad * Math.sin(th), a * .4, b, R, ox, oy)); }
      seg(pts);
    };
    ring(1.7); ring(2.3);
    ctx.lineWidth = 1.2;
    [.14, .4, .9].forEach((o, i) => { ctx.strokeStyle = `rgba(94,231,255,${o * alpha})`; ctx.stroke(B[i]); });

    // Moon on the outer ring
    const th = t * .6, x = 2.3 * Math.cos(th);
    const m = proj(x * Math.cos(tilt), x * Math.sin(tilt), 2.3 * Math.sin(th), a * .4, b, R, ox, oy);
    ctx.fillStyle = `rgba(255,191,122,${alpha})`; ctx.shadowColor = '#ffbf7a'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(m[0], m[1], Math.max(3, R * .035), 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  }

  // Perspective grid that rolls toward the viewer
  function floor(off, alpha) {
    const hy = H * .64, vx = W / 2 - tx * 50;
    ctx.lineWidth = 1; ctx.strokeStyle = `rgba(94,231,255,${.2 * alpha})`;
    ctx.beginPath();
    for (let i = -16; i <= 16; i++) { ctx.moveTo(vx + i * W * .012, hy); ctx.lineTo(vx + i * W * .14, H); }
    ctx.stroke();
    for (let k = 0; k < 14; k++) {
      const p = ((k + off) % 14) / 14, y = hy + (H - hy) * p * p;
      ctx.strokeStyle = `rgba(94,231,255,${.28 * p * alpha})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function frame(ms) {
    const dt = Math.min((ms - last) / 1000, .05); last = ms;
    if (on) t += dt;
    mx = lerp(mx, tx, .06); my = lerp(my, ty, .06);
    ctx.clearRect(0, 0, W, H);
    const p = clamp(sy / (H * .9), 0, 1), S = Math.min(W, H);

    floor(t * .5 + sy * .004, 1 - p * .6);

    for (const q of parts) {
      if (on) { q.y -= q.s * q.z * dt * 3; if (q.y < -.02) { q.y = 1.02; q.x = rnd(); } }
      const x = q.x * W - mx * 70 * q.z, y = ((q.y * H - sy * .2 * q.z) % H + H) % H;
      ctx.globalAlpha = .25 + .75 * q.z * (.6 + .4 * Math.sin(t * 2 + q.p));
      ctx.fillStyle = q.z > .7 ? '#ffffff' : '#9fe9ff';
      ctx.beginPath(); ctx.arc(x, y, q.z * 1.7, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // The planet starts large in the middle, then drifts to the side as you scroll
    planet(lerp(W / 2, W * .8, p) - mx * 30, lerp(H * .46, H * .34, p) - my * 20,
      lerp(.3 * S, .15 * S, p), t * .22 + sy * .0015 + mx * 1.1, .4 + my * .5, lerp(1, .4, p));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Motion on/off button
  const btn = document.getElementById('motion');
  const sync = () => { btn.textContent = 'Motion: ' + (on ? 'on' : 'off'); btn.setAttribute('aria-pressed', String(on)); };
  btn.onclick = () => { on = !on; sync(); };
  sync();

  // Typewriter greeting
  const el = document.getElementById('typed'), msg = 'Hello, world.';
  if (el && on) {
    el.textContent = ''; let i = 0;
    (function tick() { el.textContent = msg.slice(0, ++i); if (i < msg.length) setTimeout(tick, 110); })();
  }

  // Zone label and menu highlight follow the section on screen
  const zones = { about: 'Home orbit', education: 'Flight school', achievements: 'Medal bay', skills: 'Toolkit', projects: 'Mission control', values: 'Flight code' };
  const ids = Object.keys(zones), zEl = document.getElementById('zone'), links = document.querySelectorAll('nav a');
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    zEl.textContent = `Zone 0${ids.indexOf(e.target.id) + 1} — ${zones[e.target.id]}`;
    links.forEach(a => a.getAttribute('href') === '#' + e.target.id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'));
  }), { rootMargin: '-40% 0px -55% 0px' });
  ids.forEach(id => io.observe(document.getElementById(id)));
})();