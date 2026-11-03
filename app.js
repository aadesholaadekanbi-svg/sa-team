// SA. Team, phase 1: sign in with an employee ID, people / departments / roles, clock in and out, breaks, checklists,
// the Live floor, and "What they see". Every call goes to a database function that checks the ID first and
// decides what that person may see or change; this page only asks. Pay never reaches a team member's screen.
'use strict';
const CFG = window.SA_CONFIG || {};
const sb = window.SA_FAKE ? null : window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const ERR = { BAD_ID: 'That ID doesn’t work. Check it, or ask Sola for a new one.', OFF: 'Your access is switched off.', NOT_OWNER: 'Only the owner can do that.' };
const raw = window.SA_FAKE ? window.SA_FAKE.rpc : async (n, a) => { const { data, error } = await sb.rpc(n, a || {}); if (error) throw new Error(error.message || 'Something went wrong'); return data; };
async function rpc(n, a) { try { return await raw(n, a); } catch (e) { const m = String(e.message || '').trim(); const err = new Error(ERR[m] || m || 'Something went wrong'); err.code = ERR[m] ? m : null; throw err; } }
const ID = { get() { try { return localStorage.getItem('sa.id') || ''; } catch { return S.memId || ''; } }, set(v) { S.memId = v; try { if (v) localStorage.setItem('sa.id', v); else localStorage.removeItem('sa.id'); } catch { /* private mode: kept in memory */ } } };
const call = (n, a = {}) => rpc(n, { p_id: ID.get(), ...a });
const normId = (v) => { let x = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (x.startsWith('SA')) x = x.slice(2); return x ? 'SA-' + x.match(/.{1,4}/g).join('-') : ''; };

// ---- helpers ----
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MIN = 60e3, HOUR = 36e5, DAY = 864e5;
const ms = (t) => (t ? Date.parse(t) : 0);
const pad = (n) => String(n).padStart(2, '0');
const hms = (x) => { x = Math.max(0, Math.floor(x / 1000)); return `${pad(Math.floor(x / 3600))}:${pad(Math.floor((x % 3600) / 60))}:${pad(x % 60)}`; };
const hm = (x) => { x = Math.max(0, Math.round(x / MIN)); const h = Math.floor(x / 60), m = x % 60; return h ? `${h}h ${pad(m)}m` : `${m}m`; };
const tm = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dayName = (t) => new Date(t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const ago = (t) => { const d = Date.now() - t; return d < HOUR ? Math.max(1, Math.round(d / MIN)) + 'm ago' : d < DAY ? Math.round(d / HOUR) + 'h ago' : Math.round(d / DAY) + 'd ago'; };
const midnight = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const weekStart = () => { const d = new Date(midnight()); const k = (d.getDay() + 6) % 7; return d.getTime() - k * DAY; }; // Monday
const first = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';
const COLORS = ['#c6ff4d', '#f9a8d4', '#93c5fd', '#fcd34d', '#86efac', '#c4b5fd', '#fda4af', '#a5f3fc', '#fde68a', '#fdba74'];
const colorOf = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
const av = (name, s = 36) => `<div class="av" style="width:${s}px;height:${s}px;background:${colorOf(name)};font-size:${Math.round(s / 2.8)}px">${esc((name || '?').trim()[0] || '?').toUpperCase()}</div>`;
const chip = (role) => (role ? `<span class="chip" style="color:${esc(role.color)};background:${esc(role.color)}22">${esc(role.name)}</span>` : '<span class="chip">No role</span>');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
let toastT; function toast(m, t = 2600) { const el = $('#toast'); el.textContent = m; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), t); }
function ask(title, body, yes = 'Yes', bad = false) {
  return new Promise((res) => {
    $('#dlg').innerHTML = `<div class="scrim" id="dlgscrim"><div class="dlg"><h2>${esc(title)}</h2><p>${body}</p><div class="row" style="justify-content:flex-end"><button class="btn" id="dlgno">Cancel</button><button class="btn ${bad ? 'bad' : 'pri'}" id="dlgyes">${esc(yes)}</button></div></div></div>`;
    const done = (v) => { $('#dlg').innerHTML = ''; res(v); };
    $('#dlgyes').onclick = () => done(true); $('#dlgno').onclick = () => done(false);
    $('#dlgscrim').onclick = (e) => { if (e.target.id === 'dlgscrim') done(false); };
  });
}
const I = {
  live: '<path d="M3 12h4l3-8 4 16 3-8h4"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  inb: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>', pay: '<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/>',
  ppl: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.5-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.6 5.2"/>',
  dep: '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-3h14v3"/>',
  sop: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  dc: '<path d="M8 12h.01M16 12h.01M6 5c2-1 4-1.5 6-1.5S16 4 18 5c2 3 3 6.5 2.5 11-1.5 1.2-3 2-4.5 2.5l-1-2M6 5C4 8 3 11.5 3.5 16c1.5 1.2 3 2 4.5 2.5l1-2"/>',
  set: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24">${I[k]}</svg>`;
const LOGO = 'logo.svg';

// ---- state ----
const S = { who: null, page: localStorage.getItem('sa.page') || 'live', O: null, E: null, tab: 'home', pick: null, co: false, sel: null, rsel: null, wts: null, wtsMode: 'phone', err: null, busy: false };
const setPage = (p) => { S.page = p; try { localStorage.setItem('sa.page', p); } catch { /* private mode */ } };
const since = () => new Date(Date.now() - 15 * DAY).toISOString();

// ---- time maths ----
function brk(clock, breaks) { // break time inside a shift (ms), counting a break that's still going
  if (clock.ended_at) return (clock.break_secs || 0) * 1000;
  return breaks.filter((b) => b.clock_id === clock.id).reduce((a, b) => a + ((b.ended_at ? ms(b.ended_at) : Date.now()) - ms(b.started_at)), 0);
}
const worked = (c, breaks) => Math.max(0, (c.ended_at ? ms(c.ended_at) : Date.now()) - ms(c.started_at) - brk(c, breaks));
function workedBetween(c, breaks, a, z) { // the part of a shift between a and z, minus breaks in that window
  const s = Math.max(ms(c.started_at), a), e = Math.min(c.ended_at ? ms(c.ended_at) : Date.now(), z); if (e <= s) return 0;
  const bs = breaks.filter((b) => b.clock_id === c.id).reduce((t, b) => { const bs0 = Math.max(ms(b.started_at), s), be = Math.min(b.ended_at ? ms(b.ended_at) : Date.now(), e); return t + Math.max(0, be - bs0); }, 0);
  return Math.max(0, e - s - bs);
}
const ckDone = (c) => (c.checklist || []).filter((x) => x.done).length;
const ckAll = (c) => (c.checklist || []).length;
function weekStats(clocks, breaks) {
  const w0 = weekStart(), list = clocks.filter((c) => ms(c.started_at) >= w0 || !c.ended_at || ms(c.ended_at) >= w0);
  const work = list.reduce((a, c) => a + workedBetween(c, breaks, w0, w0 + 7 * DAY), 0);
  const done = list.reduce((a, c) => a + ckDone(c), 0), all = list.reduce((a, c) => a + ckAll(c), 0);
  const closed = list.filter((c) => c.ended_at), avgBreak = closed.length ? closed.reduce((a, c) => a + brk(c, breaks), 0) / closed.length : 0;
  const days = [...Array(7)].map((_, i) => list.reduce((a, c) => a + workedBetween(c, breaks, w0 + i * DAY, w0 + (i + 1) * DAY), 0));
  return { work, shifts: list.length, pct: all ? Math.round((done / all) * 100) : null, avgBreak, days, list };
}
const breaksAllowed = (me, role) => (me.breaks_override === true || me.breaks_override === false ? me.breaks_override : role ? role.breaks_on : true);

// ---- loading ----
async function loadOwner() { const d = await call('t_owner_load'); S.O = { ...d, at: Date.now() }; }
const refreshClocks = () => loadOwner(); // small team: re-reading everything keeps names and sign-ins fresh too
const typing = () => document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.activeElement.id !== 'wtsp';
function softReload() { loadOwner().then(() => { if (!typing() && !S.busy) ownerView(); }).catch(() => {}); }
async function loadMe() {
  const d = await call('t_me');
  S.E = { me: d.me, role: d.role, settings: d.settings || {}, models: d.models || [], clocks: d.clocks || [], breaks: d.breaks || [] };
  if (!S.pick) S.pick = (d.me.models || []).filter((m) => S.E.models.some((x) => x.name === m));
}
const roleOf = (p) => (S.O.roles || []).find((r) => r.id === p.role_id) || null;
const deptOf = (r) => (S.O.departments || []).find((d) => d.id === (r && r.department_id)) || null;

// ---- start ----
async function boot() {
  $('#app').innerHTML = '<div class="gate"><span class="spin"></span></div>';
  try {
    S.who = await rpc('t_status', { p_id: ID.get() });
    if (S.who.state === 'bad') { ID.set(''); return gate('bad'); }
    if (S.who.state === 'ok') { if (S.who.owner) await loadOwner(); else await loadMe(); }
    render();
  } catch (err) { if (err.code === 'BAD_ID' || err.code === 'OFF') { ID.set(''); return boot(); } S.err = err.message; gate('error'); }
}
function gate(kind) {
  const w = S.who || {}, again = '<button class="btn" data-a="signout" style="height:40px;font-size:13px;width:auto;margin-top:4px">Use a different ID</button>';
  const idForm = (msg) => `<p class="mu" style="margin:0">Clock in, see your checklist, log your work.</p><div style="height:40px"></div>${msg ? `<div class="err" style="width:100%">${msg}</div>` : ''}
    <input id="sid" placeholder="SA-XXXX-XXXX" style="width:100%;height:50px;text-align:center;font:700 17px 'JetBrains Mono',monospace;letter-spacing:.06em" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="btn pri" data-a="signin">Sign in</button><small class="mu2">Your employee ID is from Sola. Keep it to yourself: it’s your sign-in.</small>`;
  const body = {
    signed_out: w.has_owner === false ? `<p class="mu" style="margin:0">First time setting up. Enter the setup code from the STEPS file on your PC.</p><input id="oname" placeholder="Your name" maxlength="60" style="width:100%;height:46px;text-align:center"><input id="ocode" placeholder="SA-XXXX-XXXX" style="width:100%;height:46px;text-align:center;font:700 16px 'JetBrains Mono',monospace;letter-spacing:.06em" autocomplete="off"><button class="btn pri" data-a="claim">Set up SA. Team</button>` : idForm(''),
    bad: idForm('That ID doesn’t work. Check it, or ask Sola for a new one.'),
    inactive: `<p class="mu" style="margin:0">Hey ${esc(first(w.name))}, your access is switched off right now. Talk to Sola.</p>${again}`,
    error: `<div class="err" style="width:100%">${esc(S.err || 'Couldn’t reach SA. Team.')}</div><button class="btn" data-a="recheck">Try again</button>${again}`,
    owner_id: `<p class="mu" style="margin:0">You’re the owner. This is <b style="color:var(--tx)">your</b> ID: it signs you in on any phone or laptop.</p><div class="mono" style="font:800 24px 'JetBrains Mono',monospace;letter-spacing:.04em;padding:14px 0;color:var(--ac)">${esc(S.newOwnerId || '')}</div><button class="btn" data-a="copyid" data-v="${esc(S.newOwnerId || '')}" style="height:42px">Copy it</button><p class="mu2" style="margin:0;font-size:12px">Save it now (Notes, a password manager). It’s shown once. If you ever lose it, ask Claude for a recovery.</p><button class="btn pri" data-a="recheck">I saved it, open SA. Team</button>`,
  }[kind] || idForm('');
  $('#app').innerHTML = `<div class="gate"><div class="gbox"><img src="${LOGO}" alt=""><h1>SA. Team</h1>${body}</div></div>`;
  const f = $('#sid') || $('#oname'); if (f) f.focus();
}
function render() {
  if (!S.who || S.who.state !== 'ok') return gate(S.who ? S.who.state : 'signed_out');
  if (S.who.owner) ownerView(); else teamPage();
}

// =====================================================================================================
// the team member's screen (also drawn read-only inside "What they see")
// =====================================================================================================
function teamPage() { $('#app').innerHTML = `<div class="team">${teamView(S.E, { tab: S.tab, pick: S.pick, co: S.co })}</div>`; tick(); }
function teamView(E, st, pv) {
  const { me, role, settings, models, clocks, breaks } = E;
  const open = clocks.find((c) => !c.ended_at), onBreak = open && breaks.find((b) => b.clock_id === open.id && !b.ended_at);
  const head = `<div class="thead"><img src="${LOGO}" alt=""><b class="bric" style="font-size:16px">SA. Team</b><span class="sp"></span>${pv ? '<span class="chip">preview</span>' : '<button class="btn sm" data-a="signout">Sign out</button>'}</div>`;
  let body;
  if (open && onBreak) {
    body = `<div class="row"><span class="st br"><i></i>On break</span><span class="sp"></span><span class="mu" style="font-size:12px">${esc((open.models || []).join(', '))}</span></div>
      <div style="text-align:center;margin-top:20px"><div class="timer" data-t0="${ms(onBreak.started_at)}">${hms(Date.now() - ms(onBreak.started_at))}</div><div class="mu2" style="font-size:12px">break since ${tm(ms(onBreak.started_at))}</div></div>
      <div class="sp"></div><button class="big go" data-a="breakend">End break</button>`;
  } else if (open && st.co) {
    body = `<b class="bric" style="font-size:22px">Clock out</b><div class="tiles">${tileH(hm(worked(open, breaks)), 'worked')}${tileH(hm(brk(open, breaks)), 'breaks')}${tileH(ckAll(open) ? ckDone(open) + '/' + ckAll(open) : '—', 'checklist')}</div>
      ${ckAll(open) && ckDone(open) < ckAll(open) ? `<div class="tcard warn" style="font-size:12.5px">${plural(ckAll(open) - ckDone(open), 'checklist step')} not ticked. Fine if there's a reason; say it in the note.</div>` : ''}
      <div><div style="font-weight:700;margin-bottom:6px">Handover note</div><textarea id="handover" rows="5" style="width:100%;background:#141414;border-color:#262626" placeholder="What the next person should know: fans waiting, offers made, anything unfinished.">${esc(st.note || '')}</textarea></div>
      <div class="sp"></div><button class="big stop" data-a="clockout">Clock out</button><button class="btn" data-a="cancelco" style="height:40px">Back to my shift</button>`;
  } else if (open) {
    const t0 = ms(open.started_at), off = brk(open, breaks), can = breaksAllowed(me, role);
    body = `<div class="row"><span class="st on"><i></i>On shift</span><span class="sp"></span><span class="mu" style="font-size:12px">${esc((open.models || []).join(', '))}</span></div>
      <div style="text-align:center"><div class="timer" data-t0="${t0}" data-off="${off}">${hms(Date.now() - t0 - off)}</div><div class="mu2" style="font-size:12px">since ${tm(t0)} · break ${hm(off)}</div></div>
      ${can ? '<button class="big dark" data-a="breakstart">☕ Break</button>' : ''}
      ${ckAll(open) ? `<div><div style="font-weight:700;margin-bottom:2px">Checklist <span class="mu2">${ckDone(open)}/${ckAll(open)}</span></div>${open.checklist.map((x, i) => `<button class="ck ${x.done ? 'done' : ''}" data-a="tick" data-v="${i}"><i>${x.done ? '✓' : ''}</i><span>${esc(x.t)}</span></button>`).join('')}</div>` : '<div class="tcard mu" style="font-size:12.5px">No checklist for your role yet.</div>'}
      <div class="sp"></div><button class="big stop" data-a="costart">Clock out</button>`;
  } else {
    const W = weekStats(clocks, breaks), tabs = `<div class="ttabs"><button class="${st.tab !== 'week' ? 'on' : ''}" data-a="ttab" data-v="home">Home</button><button class="${st.tab === 'week' ? 'on' : ''}" data-a="ttab" data-v="week">My week</button></div>`;
    if (st.tab === 'week') {
      const mx = Math.max(HOUR, ...W.days), D = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      body = `${tabs}<b class="bric" style="font-size:22px">My week</b>
        <div class="tcard"><div class="wbars">${W.days.map((v, i) => `<div><i class="${v ? '' : 'z'}" style="height:${v ? Math.max(4, (v / mx) * 80) : 3}px"></i><span>${D[i]}</span></div>`).join('')}</div></div>
        <div class="tiles t2">${tileH(hm(W.work), 'hours')}${tileH(String(W.shifts), 'shifts')}${tileH(W.list.some((c) => c.ended_at) ? hm(W.avgBreak) : '—', 'avg break')}${tileH(W.pct == null ? '—' : W.pct + '%', 'checklists')}</div>
        ${W.list.length ? `<div class="tcard shl">${W.list.map((c) => `<div><span>${dayName(ms(c.started_at))} · ${tm(ms(c.started_at))}–${c.ended_at ? tm(ms(c.ended_at)) : 'now'}${c.auto_closed ? ' <span class="warn">(auto)</span>' : ''}</span><b class="mono">${hm(worked(c, breaks))}</b></div>`).join('')}</div>` : '<div class="tcard mu" style="font-size:12.5px">No shifts yet this week.</div>'}
        <div class="mu2" style="text-align:center;font-size:11px">No pay figures here · your payslip comes on pay day</div>`;
    } else {
      const pd = settings.next_pay_day ? new Date(settings.next_pay_day + 'T12:00:00') : null;
      body = `${tabs}<div><div class="mu" style="font-size:12px">${new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div><b class="bric" style="font-size:24px">Hey ${esc(first(me.name))} 👋</b><div style="margin-top:6px">${chip(role)}</div></div>
        <div class="tcard"><div style="font-weight:700;margin-bottom:8px">This week</div><div class="tiles">${tileH(hm(W.work), 'worked')}${tileH(String(W.shifts), 'shifts')}${tileH(W.pct == null ? '—' : W.pct + '%', 'checklists')}</div></div>
        <div class="tcard row" style="gap:12px;align-items:flex-start"><div style="font-size:22px">🗓</div><div style="font-size:12.5px;color:var(--mu);line-height:1.5"><b style="color:var(--tx)">${pd ? 'Next pay day: ' + pd.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : 'Pay day'}</b><br>Your payslip shows up here once it’s marked paid.</div></div>
        ${models.length ? `<div class="tcard"><div style="font-weight:700;margin-bottom:8px">Who are you covering?</div><div class="mdl">${models.map((m) => `<button class="${(st.pick || []).includes(m.name) ? 'on' : ''}" data-a="pick" data-v="${esc(m.name)}">${esc(m.name)}</button>`).join('')}</div></div>` : ''}
        <div class="sp"></div><button class="big go" data-a="clockin">Clock in</button>`;
    }
  }
  return `<div class="tw ${pv ? 'pv' : ''}">${head}${body}</div>`;
}
const tileH = (a, b) => `<div class="tile"><b>${esc(a)}</b><div>${esc(b)}</div></div>`;

// =====================================================================================================
// the owner's side
// =====================================================================================================
const NAV = [['live', 'live', 'Live floor'], ['people', 'ppl', 'People'], ['roles', 'dep', 'Departments & roles'], ['wts', 'eye', 'What they see'], ['settings', 'set', 'Settings']];
const SOON = [['cal', 'Schedule', 2], ['inb', 'Hand-ins', 3], ['sop', 'SOPs & checklists', 3], ['dc', 'Discord posts', 2], ['pay', 'Pay', 4]];
function ownerView() {
  if (!NAV.some((n) => n[0] === S.page)) setPage('live');
  const O = S.O, team = O.people.filter((p) => !p.is_owner);
  $('#app').innerHTML = `<div class="app"><div class="nav"><div class="brand"><img src="${LOGO}" alt=""><div><b>${esc(O.settings.team_name || 'SA. Team')}</b><small>the online office</small></div></div>
    ${NAV.map(([k, i, n]) => `<button class="ni ${S.page === k ? 'on' : ''}" data-a="page" data-v="${k}">${svg(i)}${n}</button>`).join('')}
    <div class="nsec">Coming next</div>${SOON.map(([i, n, ph]) => `<button class="ni" disabled title="Phase ${ph}">${svg(i)}${n}<small>P${ph}</small></button>`).join('')}
    <div class="nfoot">${plural(team.filter((p) => p.active).length, 'person')} on the team<br>${team.filter((p) => p.active && !p.last_seen).length ? `<span class="warn">${team.filter((p) => p.active && !p.last_seen).length} never signed in</span><br>` : ''}<button class="btn sm" data-a="signout" style="margin-top:8px">Sign out</button></div></div>
    <div class="main" id="main"></div></div>`;
  paintMain();
}
function paintMain() {
  const m = $('#main'); if (!m) return;
  ({ live: liveView, people: peopleView, roles: rolesView, wts: wtsView, settings: settingsView }[S.page] || liveView)(m);
  tick();
}
const topBar = (t, sub, btns = '') => `<div class="top"><h1>${t}</h1><span class="sub">${sub}</span><span class="sp"></span>${btns}</div>`;
const siteUrl = () => location.origin + location.pathname;

// ---- Live floor ----
function personState(p) {
  const O = S.O, open = O.clocks.find((c) => c.person_id === p.id && !c.ended_at), b = open && O.breaks.find((x) => x.clock_id === open.id && !x.ended_at);
  const last = O.clocks.filter((c) => c.person_id === p.id && c.ended_at).sort((a, z) => ms(z.ended_at) - ms(a.ended_at))[0];
  return { open, b, last };
}
function liveView(m) {
  const O = S.O, team = O.people.filter((p) => !p.is_owner && p.active), t0 = midnight();
  const st = team.map((p) => ({ p, ...personState(p) })), on = st.filter((x) => x.open), br = st.filter((x) => x.b);
  const today = O.clocks.filter((c) => (c.ended_at ? ms(c.ended_at) : Date.now()) > t0);
  const hrs = today.reduce((a, c) => a + workedBetween(c, O.breaks, t0, t0 + DAY), 0);
  const auto = O.clocks.filter((c) => c.auto_closed), notIn = team.filter((p) => !p.last_seen);
  const kpis = [['On now', String(on.length), `of ${team.length} on the team`, 'hot'], ['On break', String(br.length), br.map((x) => first(x.p.name)).join(', ') || 'nobody', br.length ? 'warn' : ''], ['Hours today', (hrs / HOUR).toFixed(1), 'team total', ''], ['Never signed in', String(notIn.length), notIn.length ? notIn.map((p) => first(p.name)).slice(0, 3).join(', ') : 'everyone’s been in', notIn.length ? 'warn' : ''], ['Auto clock-outs', String(auto.length), auto.length ? 'forgot to clock out · check People' : 'none in 2 weeks', auto.length ? 'warn' : '']];
  // activity: today's events, newest first
  const ev = [];
  for (const c of O.clocks) { const p = O.people.find((x) => x.id === c.person_id); if (!p) continue;
    if (ms(c.started_at) >= t0) ev.push([ms(c.started_at), '⏱', `${p.name} clocked in`, (c.models || []).length ? 'covering ' + c.models.join(', ') : '']);
    if (c.ended_at && ms(c.ended_at) >= t0) ev.push([ms(c.ended_at), c.auto_closed ? '⚠' : '⏹', c.auto_closed ? `Auto clock-out: ${p.name}` : `${p.name} clocked out`, c.auto_closed ? 'forgot to clock out · capped at 16h' : `${hm(worked(c, O.breaks))}${c.handover ? ' · “' + c.handover.slice(0, 70) + (c.handover.length > 70 ? '…' : '') + '”' : ''}`]); }
  for (const b of O.breaks) { const p = O.people.find((x) => x.id === b.person_id); if (p && ms(b.started_at) >= t0) ev.push([ms(b.started_at), '☕', `${p.name} started a break`, b.ended_at ? hm(ms(b.ended_at) - ms(b.started_at)) : 'still on it']); }
  ev.sort((a, z) => z[0] - a[0]);
  const span = (c) => [Math.max(ms(c.started_at), t0), c.ended_at ? ms(c.ended_at) : Date.now()];
  const ganttRows = team.filter((p) => today.some((c) => c.person_id === p.id));
  const pct = (t) => (((t - t0) / DAY) * 100).toFixed(2);
  m.innerHTML = `${topBar('Live floor', new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + tm(Date.now()), `<button class="btn" data-a="refresh">Refresh</button><button class="btn dc" data-a="copylink">⧉ Copy the team link</button>`)}
  <div class="body"><div class="kpis">${kpis.map((k) => `<div class="card kpi ${k[3]}"><span>${k[0]}</span><b>${k[1]}</b><small>${esc(k[2])}</small></div>`).join('')}</div>
  ${team.length ? `<div class="live"><div class="card" style="padding:14px"><div class="row"><span class="lbl">Everyone</span><span class="sp"></span><span class="mu2" style="font-size:11.5px">click someone to open them</span></div>
    <div class="pgrid">${st.sort((a, z) => (z.open ? 1 : 0) - (a.open ? 1 : 0)).map(({ p, open, b, last }) => { const r = roleOf(p); return `<button class="pc ${!p.last_seen ? 'flag' : ''}" data-a="openp" data-v="${p.id}"><div class="r1">${av(p.name)}<div style="min-width:0;flex:1"><b>${esc(p.name)}</b> ${chip(r)}<div>${open ? (b ? `<span class="st br"><i></i>Break <span data-t0="${ms(b.started_at)}" data-fmt="hm">${hm(Date.now() - ms(b.started_at))}</span></span>` : `<span class="st on"><i></i><span data-t0="${ms(open.started_at)}" data-off="${brk(open, O.breaks)}" data-fmt="hm">${hm(worked(open, O.breaks))}</span></span>`) : `<span class="st off"><i></i>${!p.last_seen ? 'Hasn’t signed in yet' : last ? 'Off · last on ' + ago(ms(last.ended_at)) : 'Off · no shifts yet'}</span>`}</div></div></div>
      <div class="w">${open ? `On <b>${esc((open.models || []).join(', ') || '—')}</b> since ${tm(ms(open.started_at))}` : `${roleOf(p) ? esc(deptOf(roleOf(p)) ? deptOf(roleOf(p)).name : roleOf(p).name) : 'No role'}${p.discord ? ' · @' + esc(p.discord) : ''}`}</div>
      ${open && ckAll(open) ? `<div><div class="row mu2" style="font-size:11.5px;margin-bottom:4px"><span>Checklist ${ckDone(open)}/${ckAll(open)}</span></div><div class="bar"><i style="width:${(ckDone(open) / ckAll(open)) * 100}%"></i></div></div>` : ''}</button>`; }).join('')}</div></div>
    <div class="card feed"><div class="row" style="margin-bottom:6px"><span class="lbl">Today</span><span class="sp"></span><span class="mu2" style="font-size:11px">updates every 20s</span></div>${ev.length ? ev.slice(0, 40).map((e) => `<div class="fi"><div class="ic">${e[1]}</div><div><b>${esc(e[2])}</b><small>${esc(e[3])}${e[3] ? ' · ' : ''}${tm(e[0])}</small></div></div>`).join('') : '<div class="mu" style="padding:14px 0;font-size:12.5px">Nothing yet today.</div>'}</div></div>
    ${ganttRows.length ? `<div class="card gantt"><div class="row" style="margin-bottom:8px"><span class="lbl">Today</span><span class="sp"></span><span class="mu2" style="font-size:11px">12 AM ··· 6 AM ··· 12 PM ··· 6 PM ··· 12 AM</span></div>${ganttRows.map((p) => `<div class="grow"><span>${esc(first(p.name))}</span><div class="gtrack">${today.filter((c) => c.person_id === p.id).map((c) => { const [a, z] = span(c); return `<div class="gseg" style="left:${pct(a)}%;width:${Math.max(0.4, pct(z) - pct(a))}%;background:${colorOf(p.name)}"></div>`; }).join('')}${O.breaks.filter((b) => b.person_id === p.id && (b.ended_at ? ms(b.ended_at) : Date.now()) > t0).map((b) => `<div class="gseg b" style="left:${pct(Math.max(ms(b.started_at), t0))}%;width:${Math.max(0.3, pct(b.ended_at ? ms(b.ended_at) : Date.now()) - pct(Math.max(ms(b.started_at), t0)))}%"></div>`).join('')}<div class="gnow" style="left:${pct(Date.now())}%"></div></div></div>`).join('')}</div>` : ''}`
  : `<div class="card empty"><div><b style="color:var(--tx);font-size:15px">Nobody on the team yet.</b><br>1 · Departments & roles: make a department and a role (with its checklist).<br>2 · People: add someone. Saving gives you their employee ID to send them.<br>3 · Copy the team link and post it in your staff channel.<br><br><button class="btn pri" data-a="page" data-v="roles">Start with Departments & roles</button></div></div>`}</div>`;
}

// ---- People ----
function peopleView(m) {
  const O = S.O, list = [...O.people].sort((a, z) => (z.is_owner ? 1 : 0) - (a.is_owner ? 1 : 0) || (z.active ? 1 : 0) - (a.active ? 1 : 0) || a.name.localeCompare(z.name));
  if (S.sel !== 'new' && !O.people.some((p) => p.id === S.sel)) S.sel = (list.find((p) => !p.is_owner) || list[0] || {}).id || null;
  const p = S.sel === 'new' ? { id: 'new', name: '', discord: '', role_id: (O.roles[0] || {}).id || null, models: [], active: true, extra_checklist: [], breaks_override: null, note: '' } : O.people.find((x) => x.id === S.sel);
  m.innerHTML = `${topBar('People', plural(O.people.filter((x) => !x.is_owner).length, 'person'), '<button class="btn pri" data-a="newp">+ Add someone</button>')}
  <div class="body"><div class="split"><div class="card lst">${list.map((x) => `<button class="li ${x.id === S.sel ? 'on' : ''}" data-a="selp" data-v="${x.id}" style="${x.active ? '' : 'opacity:.5'}">${av(x.name, 30)}<div style="min-width:0;flex:1"><b>${esc(x.name)}</b>${x.is_owner ? ' <span class="chip" style="color:var(--ac)">Owner</span>' : ''}<small>${roleOf(x) ? esc(roleOf(x).name) : x.is_owner ? 'Owner' : 'No role'} · ${x.is_owner ? 'you' : !x.active ? 'switched off' : x.last_seen ? 'last in ' + ago(ms(x.last_seen)) : '<span class="warn">never signed in</span>'}</small></div></button>`).join('')}${S.sel === 'new' ? `<button class="li on">${av('?', 30)}<b>New person</b></button>` : ''}</div>
  ${p ? personEditor(p) : '<div class="card empty">Pick someone.</div>'}</div></div>`;
}
function personEditor(p) {
  const O = S.O, isNew = p.id === 'new', r = O.roles.find((x) => x.id === p.role_id);
  const hist = isNew ? [] : O.clocks.filter((c) => c.person_id === p.id).slice(0, 30);
  const loc = (t) => { if (!t) return ''; const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  return `<div class="col"><div class="card ed" id="ped" data-id="${p.id}">
    <div class="row">${av(p.name || '?', 44)}<div><b class="bric" style="font-size:20px">${esc(p.name || 'New person')}</b><div class="mu2" style="font-size:12px">${isNew ? 'Saving gives them an employee ID: that’s their sign-in.' : p.is_owner ? 'This is you.' : p.last_seen ? 'Last signed in ' + ago(ms(p.last_seen)) : 'Hasn’t signed in yet: send them their ID and the team link.'}</div></div></div>
    <div class="fr"><span>Name</span><input id="pname" value="${esc(p.name)}" maxlength="60" placeholder="Jay"></div>
    ${isNew ? '' : `<div class="fr"><span>Employee ID<small>their sign-in; shown only when made</small></span><div class="row"><span class="mu" style="font-size:12.5px">${p.has_id ? 'Set' + (p.code_made_at ? ' · made ' + dayName(ms(p.code_made_at)) : '') : '<span class="warn">None</span>'}</span><button class="btn sm" data-a="newid" data-v="${p.id}">${p.has_id ? 'New ID (old one stops working)' : 'Make an ID'}</button></div></div>`}
    ${p.is_owner ? '' : `<div class="fr"><span>Discord @<small>optional, just for you</small></span><input id="pdisc" value="${esc(p.discord || '')}" maxlength="40" placeholder="jaychats"></div>`}
    ${p.is_owner ? '' : `<div class="fr"><span>Role</span><select id="prole"><option value="">No role</option>${O.roles.map((x) => `<option value="${x.id}" ${x.id === p.role_id ? 'selected' : ''}>${esc(x.name)}${deptOf(x) ? ' · ' + esc(deptOf(x).name) : ''}</option>`).join('')}</select></div>
    <div class="fr"><span>Usually covers<small>pre-picked when they clock in</small></span><div class="mchips" id="pmodels">${O.models.length ? O.models.map((x) => `<button class="${(p.models || []).includes(x.name) ? 'on' : ''}" data-a="pmodel" data-v="${esc(x.name)}">${esc(x.name)}</button>`).join('') : '<span class="mu2" style="font-size:12px">Add models in Settings</span>'}</div></div>
    <div class="fr"><span>Breaks</span><select id="pbreaks"><option value="" ${p.breaks_override == null ? 'selected' : ''}>Follow the role (${r ? (r.breaks_on ? 'on' : 'off') : 'on'})</option><option value="on" ${p.breaks_override === true ? 'selected' : ''}>On, just for ${esc(first(p.name) || 'them')}</option><option value="off" ${p.breaks_override === false ? 'selected' : ''}>Off, just for ${esc(first(p.name) || 'them')}</option></select></div>
    <div class="fr" style="align-items:start"><span>Extra checklist steps<small>on top of the ${r ? esc(r.name) : 'role'} checklist${r ? ` (${(r.checklist || []).length})` : ''}</small></span>${stepsEd('pext', p.extra_checklist)}</div>
    <div class="fr"><span>Note<small>only you see it</small></span><input id="pnote" value="${esc(p.note || '')}" maxlength="300"></div>
    <div class="fr"><span>Access</span><label class="row" style="cursor:pointer"><button class="tg ${p.active ? 'on' : ''}" data-a="ptoggle" id="pactive"></button><span class="mu" style="font-size:12.5px">${p.active ? 'On: can sign in and clock in' : 'Off: can’t get in (history kept)'}</span></label></div>`}
    <div id="perr"></div>
    <div class="row"><button class="btn pri" data-a="savep">${isNew ? 'Add to the team' : 'Save'}</button>${isNew ? '<button class="btn" data-a="cancelp">Cancel</button>' : ''}<span class="sp"></span>${!isNew && !p.is_owner ? `<button class="btn" data-a="wtsp" data-v="${p.id}">${svg('eye').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8"')} What they see</button><button class="btn bad" data-a="delp">Remove</button>` : ''}</div></div>
    ${isNew || p.is_owner ? '' : `<div class="card" style="padding:14px 16px"><div class="row" style="margin-bottom:6px"><span class="lbl">Shifts · last 2 weeks</span><span class="sp"></span><span class="mu2" style="font-size:11.5px">fix a time, then Save on that row</span></div>
      ${hist.length ? `<div style="overflow:auto"><table><tr><th>Day</th><th>In</th><th>Out</th><th class="n">Worked</th><th class="n">Breaks</th><th>Checklist</th><th>Handover</th><th></th></tr>${hist.map((c) => `<tr data-cid="${c.id}"><td>${dayName(ms(c.started_at))}${c.auto_closed ? ' <span class="chip" style="color:var(--warn)">auto</span>' : ''}</td><td><input type="datetime-local" class="cin" value="${loc(c.started_at)}" style="height:30px;font-size:12px"></td><td>${c.ended_at ? `<input type="datetime-local" class="cout" value="${loc(c.ended_at)}" style="height:30px;font-size:12px">` : '<span class="st on"><i></i>on now</span>'}</td><td class="n mono">${hm(worked(c, O.breaks))}</td><td class="n mono">${hm(brk(c, O.breaks))}</td><td>${ckAll(c) ? ckDone(c) + '/' + ckAll(c) : '—'}</td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis" title="${esc(c.handover || '')}">${esc(c.handover || '—')}</td><td><button class="btn sm" data-a="fixc" data-v="${c.id}">Save</button> <button class="btn sm bad" data-a="delc" data-v="${c.id}">✕</button></td></tr>`).join('')}</table></div>` : '<div class="mu" style="font-size:12.5px">No shifts in the last 2 weeks.</div>'}</div>`}</div>`;
}
function stepsEd(id, steps) { return `<div class="steps" id="${id}">${(steps || []).map((s, i) => `<div class="step"><input value="${esc(s)}" maxlength="200"><button class="btn sm" data-a="stup" data-v="${i}" title="Up">↑</button><button class="btn sm" data-a="stdel" title="Remove">✕</button></div>`).join('')}<button class="btn sm" data-a="stadd" style="align-self:flex-start">+ Add step</button></div>`; }
const readSteps = (id) => [...document.querySelectorAll(`#${id} .step input`)].map((x) => x.value.trim()).filter(Boolean);

// ---- Departments & roles ----
function rolesView(m) {
  const O = S.O, sel = S.rsel || (O.roles[0] ? 'r:' + O.roles[0].id : O.departments[0] ? 'd:' + O.departments[0].id : null);
  const [kind, id] = sel ? sel.split(':') : [];
  const groups = [...O.departments.map((d) => ({ d, roles: O.roles.filter((r) => r.department_id === d.id) })), { d: null, roles: O.roles.filter((r) => !O.departments.some((d) => d.id === r.department_id)) }];
  let ed = '<div class="card empty"><div>Make a department (Chatting, Content, Marketing…), then the roles in it.<br><br><button class="btn pri" data-a="newd">+ Department</button></div></div>';
  if (kind === 'n' || kind === 'nd') ed = deptEd({ id: 'new', name: '', color: '#a78bfa' });
  else if (kind === 'nr') ed = roleEd({ id: 'new', name: '', department_id: id || (O.departments[0] || {}).id || null, color: '#c4b5fd', breaks_on: true, checklist: [] });
  else if (kind === 'd') { const d = O.departments.find((x) => x.id === id); if (d) ed = deptEd(d); }
  else if (kind === 'r') { const r = O.roles.find((x) => x.id === id); if (r) ed = roleEd(r); }
  m.innerHTML = `${topBar('Departments & roles', `${plural(O.departments.length, 'department')} · ${plural(O.roles.length, 'role')}`, '<button class="btn" data-a="newd">+ Department</button><button class="btn pri" data-a="newr">+ Role</button>')}
  <div class="body"><div class="split"><div class="card lst">${groups.filter((g) => g.d || g.roles.length).map((g) => `${g.d ? `<button class="li ${sel === 'd:' + g.d.id ? 'on' : ''}" data-a="seld" data-v="d:${g.d.id}"><span style="width:10px;height:10px;border-radius:3px;background:${esc(g.d.color)}"></span><b>${esc(g.d.name)}</b><small style="margin-left:auto">${plural(g.roles.length, 'role')}</small></button>` : '<div class="lbl" style="padding:8px 10px 2px">No department</div>'}${g.roles.map((r) => `<button class="li ${sel === 'r:' + r.id ? 'on' : ''}" data-a="seld" data-v="r:${r.id}" style="padding-left:28px">${chip(r)}<small style="margin-left:auto">${plural(O.people.filter((p) => p.role_id === r.id && p.active).length, 'person')}</small></button>`).join('')}`).join('') || '<div class="mu" style="padding:12px;font-size:12.5px">Nothing yet.</div>'}</div>${ed}</div></div>`;
}
const SW = ['#c4b5fd', '#f9a8d4', '#93c5fd', '#86efac', '#fcd34d', '#fdba74', '#a5f3fc', '#fda4af', '#c6ff4d', '#d4d4d8'];
const swatches = (cur) => `<div class="mchips" id="xcolor" data-v="${esc(cur)}">${SW.map((c) => `<button data-a="color" data-v="${c}" style="width:28px;padding:0;background:${c};${c === cur ? 'box-shadow:0 0 0 2px #fff' : ''}"></button>`).join('')}</div>`;
function deptEd(d) {
  const isNew = d.id === 'new';
  return `<div class="card ed" id="ded" data-id="${d.id}"><b class="bric" style="font-size:20px">${isNew ? 'New department' : esc(d.name)}</b>
    <div class="fr"><span>Name</span><input id="dname" value="${esc(d.name)}" maxlength="60" placeholder="Chatting"></div><div class="fr"><span>Colour</span>${swatches(d.color)}</div><div id="derr"></div>
    <div class="row"><button class="btn pri" data-a="saved">${isNew ? 'Make it' : 'Save'}</button>${isNew ? '' : `<button class="btn" data-a="newr" data-v="${d.id}">+ Role in ${esc(d.name)}</button><span class="sp"></span><button class="btn bad" data-a="deld">Delete</button>`}</div></div>`;
}
function roleEd(r) {
  const O = S.O, isNew = r.id === 'new', ppl = O.people.filter((p) => p.role_id === r.id && p.active);
  return `<div class="card ed" id="red" data-id="${r.id}"><div class="row"><b class="bric" style="font-size:20px">${isNew ? 'New role' : esc(r.name)}</b>${isNew ? '' : `<span class="mu2" style="font-size:12px">${plural(ppl.length, 'person')}${ppl.length ? ': ' + ppl.map((p) => esc(first(p.name))).join(', ') : ''}</span>`}</div>
    <div class="fr"><span>Name</span><input id="rname" value="${esc(r.name)}" maxlength="60" placeholder="Chatter"></div>
    <div class="fr"><span>Department</span><select id="rdept"><option value="">None</option>${O.departments.map((d) => `<option value="${d.id}" ${d.id === r.department_id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
    <div class="fr"><span>Colour</span>${swatches(r.color)}</div>
    <div class="fr"><span>Breaks<small>someone can still be set differently</small></span><label class="row" style="cursor:pointer"><button class="tg ${r.breaks_on ? 'on' : ''}" data-a="rtoggle" id="rbreaks"></button><span class="mu" style="font-size:12.5px">${r.breaks_on ? 'On' : 'Off'}</span></label></div>
    <div class="fr" style="align-items:start"><span>Shift checklist<small>every shift starts with these</small></span>${stepsEd('rsteps', r.checklist)}</div>
    <div class="mu2" style="font-size:12px">Checklist changes apply from the next clock-in. Pay for roles comes in phase 4 and is never shown to the team.</div><div id="rerr"></div>
    <div class="row"><button class="btn pri" data-a="saver">${isNew ? 'Make the role' : 'Save'}</button><span class="sp"></span>${isNew ? '' : '<button class="btn bad" data-a="delr">Delete</button>'}</div></div>`;
}

// ---- What they see ----
function teamDataFor(p) {
  const O = S.O;
  return { me: p, role: roleOf(p), settings: O.settings, models: O.models, clocks: O.clocks.filter((c) => c.person_id === p.id), breaks: O.breaks.filter((b) => b.person_id === p.id) };
}
function wtsView(m) {
  const O = S.O, team = O.people.filter((p) => !p.is_owner);
  if (!team.some((p) => p.id === S.wts)) S.wts = (team.find((p) => p.active) || team[0] || {}).id || null;
  const p = team.find((x) => x.id === S.wts);
  if (!p) { m.innerHTML = `${topBar('What they see', 'Built live from your settings')}<div class="body"><div class="card empty">Add someone in People first.</div></div>`; return; }
  const E = teamDataFor(p), r = E.role, can = breaksAllowed(p, r), open = E.clocks.find((c) => !c.ended_at);
  const steps = (r ? r.checklist || [] : []).length, extra = (p.extra_checklist || []).length;
  const sees = [`Their name, “${r ? r.name : 'No role'}” and the date`, `Their own hours, shifts and checklist score this week`, `Clock in / out${can ? ', breaks' : ' (no breaks: ' + (p.breaks_override === false ? 'off just for them' : 'off for the role') + ')'}`, `A checklist of ${plural(steps + extra, 'step')} each shift${extra ? ` (${steps} from the role + ${extra} just for ${first(p.name)})` : ''}`, `Models to pick: ${O.models.map((x) => x.name).join(', ') || 'none set'}${(p.models || []).length ? ` (pre-picked: ${p.models.join(', ')})` : ''}`, O.settings.next_pay_day ? `The next pay day date (${O.settings.next_pay_day})` : 'A pay day card with no date (set one in Settings)', 'Their own handover notes'];
  const hidden = ['Any rate, commission, sales or pay total (until you send payslips in phase 4)', 'Anyone else: names, hours, shifts or notes', 'Live floor, People, Departments & roles, Settings', 'Your private note about them', 'Their own employee ID (nobody can read it back, not even you)'];
  m.innerHTML = `${topBar('What they see', 'Built live from your settings', `<select id="wtsp" style="height:36px">${team.map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}${roleOf(x) ? ' · ' + esc(roleOf(x).name) : ''}${x.active ? '' : ' (off)'}</option>`).join('')}</select><button class="btn ${S.wtsMode === 'phone' ? 'pri' : ''}" data-a="wtsmode" data-v="phone">Phone</button><button class="btn ${S.wtsMode === 'laptop' ? 'pri' : ''}" data-a="wtsmode" data-v="laptop">Laptop</button>`)}
  <div class="body"><div class="wts"><div><div class="${S.wtsMode}" id="pvbox"><div class="scr team" style="min-height:100%">${p.active ? teamView(E, { tab: S.wtsTab || 'home', pick: (p.models || []) }, true) : `<div class="tw pv">${gateBox(`Hey ${esc(first(p.name))}, your access is switched off right now. Talk to Sola.`)}</div>`}</div></div><div class="pv-note">${open ? `${esc(first(p.name))} is on shift right now: this is their live screen.` : `${esc(first(p.name))}’s ${S.wtsTab === 'week' ? 'My week' : 'home'} screen, right now`} · ${S.wtsMode === 'phone' ? '' : 'on a laptop it sits in the middle like this · '}<button class="btn sm" data-a="wtstab" data-v="${S.wtsTab === 'week' ? 'home' : 'week'}">Show ${S.wtsTab === 'week' ? 'Home' : 'My week'}</button></div></div>
  <div class="col" style="gap:14px"><div class="card" style="padding:16px 18px"><div class="lbl" style="margin-bottom:10px">${esc(first(p.name))} sees</div><div class="seen">${sees.map((x) => `<div><b class="ok">✓</b>${esc(x)}</div>`).join('')}</div></div>
  <div class="card" style="padding:16px 18px"><div class="lbl" style="margin-bottom:10px">Hidden from ${esc(first(p.name))}</div><div class="seen">${hidden.map((x) => `<div><b style="color:var(--ac)">🔒</b>${esc(x)}</div>`).join('')}</div></div>
  <div class="mu2" style="font-size:12px;line-height:1.55">Change their role, a checklist step or breaks and this updates on the spot. The lock is in the database, not just on screen: their ID only opens their own data, so nothing else can be dug out of the page either.</div>
  ${!p.last_seen ? `<div class="err" style="color:#fcd34d;background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.3)">${esc(first(p.name))} hasn’t signed in yet.</div>` : ''}</div></div></div>`;
}
const gateBox = (t) => `<div class="gbox" style="margin:60px auto 0"><img src="${LOGO}" alt=""><h1>SA. Team</h1><p class="mu">${t}</p></div>`;

// ---- the ID, shown once ----
function showId(p, id, isNew, own) {
  const msg = `Hey ${first(p.name)}, welcome to SA. Team 👋\nOpen ${siteUrl()} and sign in with your employee ID: ${id}\nKeep it to yourself: it’s your sign-in. Clock in at the start of every shift.`;
  $('#dlg').innerHTML = `<div class="scrim"><div class="dlg"><h2>${own ? 'Your new owner ID' : isNew ? esc(first(p.name)) + '’s employee ID' : 'New ID for ' + esc(first(p.name))}</h2><p>${own ? 'This device already uses it. Save it somewhere safe: it’s shown once.' : 'It’s shown once. Send it to them now (a Discord DM is fine). If it’s lost, press New ID.'}</p>
    <div class="mono" style="font:800 26px 'JetBrains Mono',monospace;letter-spacing:.04em;text-align:center;padding:14px;border:1px solid var(--ln2);border-radius:12px;color:var(--ac)">${esc(id)}</div>
    ${own ? '' : `<textarea readonly rows="4" style="width:100%;margin-top:12px;font-size:12.5px" id="idmsg">${esc(msg)}</textarea>`}
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-a="copyid" data-v="${esc(id)}">Copy ID</button>${own ? '' : `<button class="btn" data-a="copymsg" data-v="${esc(msg)}">Copy welcome message</button>`}<button class="btn pri" data-a="closedlg">Done</button></div></div></div>`;
}

// ---- Settings ----
function settingsView(m) {
  const O = S.O;
  m.innerHTML = `${topBar('Settings', 'Team name, pay day, models, the team link')}<div class="body" style="max-width:860px">
  <div class="card ed"><b class="bric" style="font-size:18px">Basics</b>
    <div class="fr"><span>Team name<small>shown in your sidebar</small></span><input id="sname" value="${esc(O.settings.team_name || 'SA. Team')}" maxlength="40"></div>
    <div class="fr"><span>Next pay day<small>the team sees only the date</small></span><input type="date" id="spay" value="${esc(O.settings.next_pay_day || '')}"></div>
    <div class="row"><button class="btn pri" data-a="saves">Save</button></div></div>
  <div class="card ed"><b class="bric" style="font-size:18px">Models</b><div class="mu2" style="font-size:12px;margin-top:-8px">What people pick when they clock in (“who are you covering?”).</div>
    <div class="steps">${O.models.map((x) => `<div class="step" data-mid="${x.id}"><input value="${esc(x.name)}" maxlength="60"><button class="btn sm" data-a="savem" data-v="${x.id}">Save</button><button class="btn sm bad" data-a="delm" data-v="${x.id}">✕</button></div>`).join('')}
    <div class="step"><input id="newm" placeholder="Add a model, e.g. Paige" maxlength="60"><button class="btn sm pri" data-a="addm">Add</button></div></div></div>
  <div class="card ed"><b class="bric" style="font-size:18px">The team link</b><div class="mu" style="font-size:12.5px">Pin this in your Discord. People sign in with the employee ID you give each of them (People → their name).</div>
    <div class="row"><input readonly value="${esc(siteUrl())}" style="flex:1" class="mono"><button class="btn dc" data-a="copylink">Copy</button></div></div>
  <div class="card ed"><b class="bric" style="font-size:18px">You</b><div class="mu" style="font-size:12.5px">Signed in as the owner on this device. Think your ID got out? Make a new one: the old one stops working everywhere.</div><div class="row"><button class="btn" data-a="newid" data-v="${esc(O.me)}">New owner ID</button><button class="btn" data-a="signout">Sign out on this device</button></div></div></div>`;
}

// =====================================================================================================
// clicks
// =====================================================================================================
async function act(fn, okMsg) { if (S.busy) return; S.busy = true; try { await fn(); if (okMsg) toast(okMsg); } catch (err) { toast(err.message, 4500); } finally { S.busy = false; } }
const reTeam = async () => { await loadMe(); teamPage(); };
const reOwner = async (full = true) => { if (full) await loadOwner(); else await refreshClocks(); ownerView(); };
const A = {
  signin: () => act(async () => { const v = normId(($('#sid') || {}).value); if (v.length < 12) throw new Error('Type your whole ID, like SA-7KQ4-M2PX.'); ID.set(v); await boot(); }),
  signout: () => { ID.set(''); S.who = { state: 'signed_out', has_owner: true }; S.O = S.E = null; S.pick = null; gate('signed_out'); },
  copyid: async (v) => { try { await navigator.clipboard.writeText(v); toast('Copied'); } catch { toast(v, 8000); } },
  copymsg: async (v) => { try { await navigator.clipboard.writeText(v); toast('Message copied: paste it in their DMs'); } catch { toast('Couldn’t copy: select the text and copy it', 4000); } },
  recheck: () => boot(),
  claim: () => act(async () => { const c = ($('#ocode') || {}).value || '', n = ($('#oname') || {}).value || ''; if (!n.trim()) throw new Error('Type your name.'); if (!c.trim()) throw new Error('Type the setup code.'); const r = await rpc('t_claim_owner', { p_code: c.trim(), p_name: n.trim() }); ID.set(r.id); S.newOwnerId = r.id; gate('owner_id'); }),
  // team member
  ttab: (v) => { S.tab = v; teamPage(); },
  pick: (v) => { const k = S.pick.indexOf(v); if (k >= 0) S.pick.splice(k, 1); else S.pick.push(v); teamPage(); },
  clockin: () => act(async () => { if (S.E.models.length && !S.pick.length) throw new Error('Pick who you’re covering first.'); await call('t_clock_in', { p_models: S.pick }); S.co = false; await reTeam(); }, 'Clocked in. Have a good one'),
  breakstart: () => act(async () => { await call('t_break_toggle'); await reTeam(); }, 'Break started'),
  breakend: () => act(async () => { await call('t_break_toggle'); await reTeam(); }, 'Back on shift'),
  tick: (v) => act(async () => { const open = S.E.clocks.find((c) => !c.ended_at); const now = !open.checklist[+v].done; open.checklist = await call('t_tick', { p_idx: +v, p_done: now }); teamPage(); }),
  costart: () => { S.co = true; S.note = ''; teamPage(); },
  cancelco: () => { S.co = false; teamPage(); },
  clockout: () => act(async () => { const note = ($('#handover') || {}).value || ''; const c = await call('t_clock_out', { p_handover: note }); S.co = false; S.tab = 'home'; await reTeam(); toast(`Clocked out · ${hm(ms(c.ended_at) - ms(c.started_at) - (c.break_secs || 0) * 1000)} today. Nice work`, 4000); }),
  // owner
  page: (v) => { setPage(v); ownerView(); softReload(); },
  refresh: () => act(() => reOwner(false), 'Up to date'),
  copylink: async () => { try { await navigator.clipboard.writeText(siteUrl()); toast('Link copied: pin it in Discord'); } catch { toast(siteUrl(), 6000); } },
  openp: (v) => { S.sel = v; setPage('people'); ownerView(); softReload(); },
  selp: (v) => { S.sel = v; paintMain(); },
  newp: () => { S.sel = 'new'; setPage('people'); ownerView(); const x = $('#pname'); if (x) x.focus(); },
  cancelp: () => { S.sel = null; paintMain(); },
  pmodel: (v, el) => el.classList.toggle('on'),
  ptoggle: (v, el) => { el.classList.toggle('on'); el.nextElementSibling.textContent = el.classList.contains('on') ? 'On: can sign in and clock in' : 'Off: can’t get in (history kept)'; },
  stadd: (v, el) => { const d = document.createElement('div'); d.className = 'step'; d.innerHTML = '<input maxlength="200" placeholder="e.g. Reply to all VIPs"><button class="btn sm" data-a="stup" title="Up">↑</button><button class="btn sm" data-a="stdel" title="Remove">✕</button>'; el.before(d); d.querySelector('input').focus(); },
  stdel: (v, el) => el.closest('.step').remove(),
  stup: (v, el) => { const s = el.closest('.step'), p = s.previousElementSibling; if (p && p.classList.contains('step')) s.parentNode.insertBefore(s, p); },
  savep: () => act(async () => {
    const id = $('#ped').dataset.id, me = S.O.people.find((x) => x.id === id) || {};
    const name = $('#pname').value.trim(); if (!name) throw new Error('Give them a name.');
    let a = { p_pid: id === 'new' ? null : id, p_name: name, p_discord: null, p_role: null, p_models: [], p_breaks: null, p_extra: [], p_note: null, p_active: true };
    if (!me.is_owner) {
      const bo = $('#pbreaks').value;
      a = { ...a, p_discord: $('#pdisc').value.trim().replace(/^@/, '') || null, p_role: $('#prole').value || null, p_models: [...document.querySelectorAll('#pmodels button.on')].map((b) => b.dataset.v), p_breaks: bo === 'on' ? true : bo === 'off' ? false : null, p_extra: readSteps('pext'), p_note: $('#pnote').value.trim() || null, p_active: $('#pactive').classList.contains('on') };
    }
    const r = await call('t_save_person', a); S.sel = r.person.id; await reOwner();
    if (r.id) showId(r.person, r.id, true); }, 'Saved'),
  newid: async (v) => { const p = S.O.people.find((x) => x.id === v); if (!p) return; const own = p.id === S.O.me;
    if (!(await ask(own ? 'Make a new owner ID?' : `New ID for ${p.name}?`, own ? 'Your current ID stops working on every device right now. This device switches to the new one.' : `Their current ID stops working right away, on every device. You’ll send ${esc(first(p.name))} the new one.`, 'Make a new ID'))) return;
    act(async () => { const r = await call('t_new_code', { p_pid: p.id }); if (own) ID.set(r.id); await reOwner(); showId(p, r.id, false, own); }); },
  delp: async () => { const p = S.O.people.find((x) => x.id === S.sel); if (!p || !(await ask(`Remove ${p.name}?`, 'They disappear from People and Live floor, their ID stops working, and their shifts leave your lists. To just pause them, switch Access off instead.', 'Remove', true))) return; act(async () => { await call('t_remove_person', { p_pid: p.id }); S.sel = null; await reOwner(); }, 'Removed'); },
  wtsp: (v) => { S.wts = v; setPage('wts'); ownerView(); softReload(); },
  fixc: (v) => act(async () => { const tr = document.querySelector(`tr[data-cid="${v}"]`), a = tr.querySelector('.cin').value, z = tr.querySelector('.cout'); const st = new Date(a).toISOString(), en = z ? new Date(z.value).toISOString() : null; if (en && ms(en) <= ms(st)) throw new Error('Out has to be after In.'); await call('t_fix_clock', { p_cid: v, p_start: st, p_end: en }); await reOwner(false); }, 'Shift fixed'),
  delc: async (v) => { if (!(await ask('Delete this shift?', 'It disappears from their hours and your lists.', 'Delete', true))) return; act(async () => { await call('t_remove_clock', { p_cid: v }); await reOwner(false); }, 'Shift deleted'); },
  // departments & roles
  seld: (v) => { S.rsel = v; paintMain(); },
  newd: () => { S.rsel = 'nd:'; paintMain(); $('#dname').focus(); },
  newr: (v) => { S.rsel = 'nr:' + (v || ''); setPage('roles'); paintMain(); $('#rname').focus(); },
  color: (v, el) => { const box = el.closest('#xcolor'); box.dataset.v = v; box.querySelectorAll('button').forEach((b) => { b.style.boxShadow = b.dataset.v === v ? '0 0 0 2px #fff' : ''; }); },
  rtoggle: (v, el) => { el.classList.toggle('on'); el.nextElementSibling.textContent = el.classList.contains('on') ? 'On' : 'Off'; },
  saved: () => act(async () => { const id = $('#ded').dataset.id, name = $('#dname').value.trim(); if (!name) throw new Error('Name it.'); const r = await call('t_save_department', { p_did: id === 'new' ? null : id, p_name: name, p_color: $('#xcolor').dataset.v }); S.rsel = 'd:' + r.id; await reOwner(); }, 'Saved'),
  deld: async () => { const id = $('#ded').dataset.id, d = S.O.departments.find((x) => x.id === id); if (!d || !(await ask(`Delete ${d.name}?`, 'Its roles stay, under “No department”.', 'Delete', true))) return; act(async () => { await call('t_remove_department', { p_did: id }); S.rsel = null; await reOwner(); }, 'Deleted'); },
  saver: () => act(async () => { const id = $('#red').dataset.id, name = $('#rname').value.trim(); if (!name) throw new Error('Name the role.'); const r = await call('t_save_role', { p_rid: id === 'new' ? null : id, p_name: name, p_dept: $('#rdept').value || null, p_color: $('#xcolor').dataset.v, p_breaks: $('#rbreaks').classList.contains('on'), p_checklist: readSteps('rsteps') }); S.rsel = 'r:' + r.id; await reOwner(); }, 'Saved'),
  delr: async () => { const id = $('#red').dataset.id, r = S.O.roles.find((x) => x.id === id), n = S.O.people.filter((p) => p.role_id === id).length; if (!r || !(await ask(`Delete the ${r.name} role?`, n ? `${plural(n, 'person')} will have no role (and no checklist) until you give them one.` : 'Nobody has it.', 'Delete', true))) return; act(async () => { await call('t_remove_role', { p_rid: id }); S.rsel = null; await reOwner(); }, 'Deleted'); },
  closedlg: () => { $('#dlg').innerHTML = ''; },
  // what they see
  wtsmode: (v) => { S.wtsMode = v; paintMain(); },
  wtstab: (v) => { S.wtsTab = v; paintMain(); },
  // settings
  saves: () => act(async () => { await call('t_save_settings', { p_team_name: $('#sname').value.trim(), p_pay_day: $('#spay').value || null }); await reOwner(); }, 'Saved'),
  addm: () => act(async () => { const n = $('#newm').value.trim(); if (!n) throw new Error('Type a name.'); if (S.O.models.some((x) => x.name.toLowerCase() === n.toLowerCase())) throw new Error('Already there.'); await call('t_save_model', { p_mid: null, p_name: n }); await reOwner(); }, 'Added'),
  savem: (v) => act(async () => { const n = document.querySelector(`[data-mid="${v}"] input`).value.trim(); if (!n) throw new Error('Type a name.'); await call('t_save_model', { p_mid: v, p_name: n }); await reOwner(); }, 'Saved'),
  delm: async (v) => { const x = S.O.models.find((y) => y.id === v); if (!x || !(await ask(`Remove ${x.name}?`, 'Past shifts keep the name; it just stops being a choice at clock-in.', 'Remove', true))) return; act(async () => { await call('t_remove_model', { p_mid: v }); await reOwner(); }, 'Removed'); },
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  if (el.closest('#pvbox')) { e.preventDefault(); return toast('Preview only: this is their screen, not yours'); }
  const f = A[el.dataset.a]; if (f) { e.preventDefault(); f(el.dataset.v, el); }
});
document.addEventListener('change', (e) => { if (e.target.id === 'wtsp') { S.wts = e.target.value; paintMain(); } });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'ocode') A.claim();
  if (e.key === 'Enter' && e.target.id === 'sid') A.signin();
  if (e.key === 'Enter' && e.target.id === 'newm') A.addm();
  if (e.key === 'Enter' && e.target.closest && e.target.closest('.step') && e.target.closest('#pext, #rsteps')) { e.preventDefault(); A.stadd(null, e.target.closest('.steps').querySelector('[data-a="stadd"]')); }
});
document.addEventListener('input', (e) => { if (e.target.id === 'handover') S.note = e.target.value; });

// ---- clocks on screen tick every second; the owner's Live floor re-reads every 20s ----
function tick() {
  document.querySelectorAll('[data-t0]').forEach((el) => { const v = Date.now() - +el.dataset.t0 - (+el.dataset.off || 0); el.textContent = el.dataset.fmt === 'hm' ? hm(v) : hms(v); });
}
setInterval(tick, 1000);
setInterval(() => {
  if (!S.who || S.who.state !== 'ok' || S.busy || document.hidden) return;
  if (S.who.owner && (S.page === 'live' || S.page === 'wts') && !typing()) refreshClocks().then(() => { if (!typing()) paintMain(); }).catch(() => {});
}, 20e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.who && S.who.state === 'ok' && !S.busy) (S.who.owner ? refreshClocks().then(paintMain) : loadMe().then(() => { if (!document.activeElement || document.activeElement.id !== 'handover') teamPage(); })).catch(() => {}); });
boot();
