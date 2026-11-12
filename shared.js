// SA. shared time + pay-schedule maths. Used by the SA. Team Worker, the SA. Team site and SA. Management.
const SAT = (() => {
  const DAY = 864e5;
  // date parts of an instant in a time zone (24h)
  const fmtCache = {};
  const fmt = (tz) => fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short' }));
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function parts(ms, tz) {
    const o = {}; for (const p of fmt(tz || 'UTC').formatToParts(new Date(ms))) o[p.type] = p.value;
    return { y: +o.year, m: +o.month, d: +o.day, hh: +o.hour % 24, mm: +o.minute, ss: +o.second, dow: WD[o.weekday], date: `${o.year}-${o.month}-${o.day}`, hm: `${String(+o.hour % 24).padStart(2, '0')}:${o.minute}` };
  }
  const offset = (ms, tz) => { const p = parts(ms, tz); return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - Math.floor(ms / 1000) * 1000; };
  // a wall-clock date + time in a time zone -> UTC ms
  function toUtc(date, hm, tz) {
    const [y, m, d] = date.split('-').map(Number), [hh, mi] = String(hm || '00:00').split(':').map(Number);
    const guess = Date.UTC(y, m - 1, d, hh, mi); let t = guess - offset(guess, tz); t = guess - offset(t, tz); return t;
  }
  const addDays = (date, n) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const dowOf = (date) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }; // 0 = Sunday
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-12
  const today = (tz, now = Date.now()) => parts(now, tz).date;
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // ---- pay schedule ----
  // pay = { kind: 'weekly'|'biweekly'|'semimonthly'|'monthly', dow: 0-6 (Sun=0), anchor: 'YYYY-MM-DD', split: '1-15'|'15-last', mday: 1-28|'last', moves: { 'orig': 'moved' } }
  function clean(p) {
    p = p && typeof p === 'object' ? p : {};
    const kind = ['weekly', 'biweekly', 'semimonthly', 'monthly'].includes(p.kind) ? p.kind : null; if (!kind) return null;
    const out = { kind, dow: Math.min(6, Math.max(0, parseInt(p.dow, 10) || 0)) };
    if (kind === 'biweekly') { if (!/^\d{4}-\d\d-\d\d$/.test(p.anchor || '')) return null; out.anchor = p.anchor; out.dow = dowOf(p.anchor); }
    if (kind === 'semimonthly') out.split = p.split === '15-last' ? '15-last' : '1-15';
    if (kind === 'monthly') out.mday = p.mday === 'last' ? 'last' : Math.min(28, Math.max(1, parseInt(p.mday, 10) || 1));
    const mv = {}; for (const [a, b] of Object.entries(p.moves || {})) if (/^\d{4}-\d\d-\d\d$/.test(a) && /^\d{4}-\d\d-\d\d$/.test(b)) mv[a] = b;
    out.moves = mv; return out;
  }
  // the regular pay dates (before moves) in [from, to]
  function regular(p, from, to) {
    const out = [];
    if (p.kind === 'weekly') { let d = from; while (dowOf(d) !== p.dow) d = addDays(d, 1); for (; d <= to; d = addDays(d, 7)) out.push(d); }
    else if (p.kind === 'biweekly') { const [a] = [p.anchor]; const diff = Math.round((Date.parse(from) - Date.parse(a)) / DAY); let k = Math.floor(diff / 14); let d = addDays(a, k * 14); while (d < from) d = addDays(d, 14); for (; d <= to; d = addDays(d, 14)) out.push(d); }
    else {
      let [y, m] = from.split('-').map(Number); m -= 1; if (m < 1) { m = 12; y--; }
      for (let i = 0; i < 400; i++) {
        const last = dim(y, m), mk = (dd) => `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
        const ds = p.kind === 'semimonthly' ? (p.split === '15-last' ? [15, last] : [1, 15]) : [p.mday === 'last' ? last : Math.min(p.mday, last)];
        for (const dd of ds) { const d = mk(dd); if (d >= from && d <= to) out.push(d); }
        if (mk(1) > to) break; m++; if (m > 12) { m = 1; y++; }
      }
    }
    return out;
  }
  const moved = (p, d) => (p.moves && p.moves[d]) || d;
  // next n pay days on/after `from` (with moves applied): [{ date (actual), regular, from, to }] where from..to is the period it pays
  function upcoming(p, from, n = 3) {
    p = clean(p); if (!p) return [];
    const regs = regular(p, addDays(from, -70), addDays(from, 400)), out = [];
    for (let i = 1; i < regs.length && out.length < n; i++) {
      const date = moved(p, regs[i]); if (date < from) continue;
      out.push({ date, regular: regs[i], from: regs[i - 1], to: addDays(regs[i], -1) });
    }
    return out;
  }
  // the pay period that contains `date` (the one that will be paid on the next regular pay day after it)
  function periodOf(p, date) {
    p = clean(p); if (!p) return null;
    const regs = regular(p, addDays(date, -70), addDays(date, 70));
    for (let i = 1; i < regs.length; i++) if (date >= regs[i - 1] && date < regs[i]) return { from: regs[i - 1], to: addDays(regs[i], -1), pay: moved(p, regs[i]), regular: regs[i] };
    return null;
  }
  // shift the period window by k periods (k=0 current)
  function periodAt(p, date, k) {
    let cur = periodOf(p, date); if (!cur) return null;
    for (let i = 0; i < Math.abs(k); i++) cur = periodOf(p, k < 0 ? addDays(cur.from, -1) : addDays(cur.to, 1)) || cur;
    return cur;
  }
  function label(p) {
    p = clean(p); if (!p) return 'Not set';
    if (p.kind === 'weekly') return `Every week on ${DAYS[p.dow]}`;
    if (p.kind === 'biweekly') return `Every 2 weeks on ${DAYS[p.dow]}`;
    if (p.kind === 'semimonthly') return p.split === '15-last' ? 'Twice a month: the 15th and the last day' : 'Twice a month: the 1st and the 15th';
    return p.mday === 'last' ? 'Monthly on the last day' : `Monthly on the ${p.mday}${['th', 'st', 'nd', 'rd'][(p.mday % 100 > 10 && p.mday % 100 < 14) || p.mday % 10 > 3 ? 0 : p.mday % 10]}`;
  }

  // ---- schedule (shifts) ----
  // template: { person_id, dow: 0-6 (Mon=0), start: 'HH:MM', end: 'HH:MM', what }; exception for one date: { person_id, date, off, start, end, what }
  const monDow = (date) => (dowOf(date) + 6) % 7; // Monday = 0
  function shiftOn(tpl, exc, pid, date) {
    const x = exc.find((e) => e.person_id === pid && e.date === date);
    if (x) return x.off ? null : { start: x.start, end: x.end, what: x.what || '', one: true };
    const t = tpl.find((s) => s.person_id === pid && s.dow === monDow(date));
    return t ? { start: t.start, end: t.end, what: t.what || '' } : null;
  }
  // absolute window of a shift on a date: end at/before start means it runs past midnight
  function window(sh, date, tz) { const a = toUtc(date, sh.start, tz); let z = toUtc(date, sh.end, tz); if (z <= a) z = toUtc(addDays(date, 1), sh.end, tz); return [a, z]; }
  function weekOf(date) { const k = monDow(date), mon = addDays(date, -k); return [...Array(7)].map((_, i) => addDays(mon, i)); }

  return { DAY, parts, toUtc, addDays, dowOf, today, DAYS, pay: { clean, regular, upcoming, periodOf, periodAt, label }, shiftOn, window, weekOf, monDow };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SAT;
