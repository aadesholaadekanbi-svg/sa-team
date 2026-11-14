// SA. Team: sign in with an employee ID, people / departments / roles, clock in and out, breaks, checklists,
// the Live floor, "What they see", and what SA. Management sends: briefs, SOPs and the logins for each person's own accounts. Every call goes to a database function that checks the ID first and
// decides what that person may see or change; this page only asks. Pay never reaches a team member's screen.
'use strict';
const CFG = window.SA_CONFIG || {};
const ERR = { BAD_ID: 'That ID doesn’t work. Check it, or ask Sola for a new one.', OFF: 'Your access is switched off.', NOT_OWNER: 'Only the owner can do that.' };
const raw = window.SA_FAKE ? window.SA_FAKE.rpc : async (n, a) => {
  let r; try { r = await fetch(String(CFG.url || '').replace(/\/+$/, '') + '/rpc/' + n, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a || {}) }); }
  catch { throw new Error('Can’t reach SA. Team. Check your connection.'); }
  const j = await r.json().catch(() => null); if (!r.ok) throw new Error((j && j.message) || 'Something went wrong'); return j;
};
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
const plural = (n, w) => `${n} ${n === 1 ? w : w === 'person' ? 'people' : w + 's'}`;
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
  msg: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2M16 7l3 3M18 5l2 2"/>',
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
  S.E = { me: d.me, role: d.role, settings: d.settings || {}, models: d.models || [], clocks: d.clocks || [], breaks: d.breaks || [], brief: d.brief || null, sops: d.sops || [], accounts: d.accounts || [], reports: d.reports || [], team: d.team || null, lead: d.lead || null, handin_form: d.handin_form || null, pending_handin: d.pending_handin || null, handins: d.handins || [], messages: d.messages || [], week: d.week || null };
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
function teamPage() {
  $('#app').innerHTML = `<div class="team">${teamView(S.E, { tab: S.tab, pick: S.pick, co: S.co, sop: S.sop, show: S.show, stuck: S.stuck, tm: S.tm, fix: S.fix, mk: S.mk, msg: S.msgOpen, hl: S.hl, hv: S.hv })}</div>`; tick();
  const E = S.E, open = E.clocks.find((c) => !c.ended_at);
  if (open && E.brief && !E.brief.seen_at) { E.brief.seen_at = new Date().toISOString(); call('t_brief_seen').catch(() => {}); }
}
function teamView(E, st, pv) {
  const { me, role, settings, models, clocks, breaks } = E;
  const open = clocks.find((c) => !c.ended_at), onBreak = open && breaks.find((b) => b.clock_id === open.id && !b.ended_at);
  const head = `<div class="thead"><img src="${LOGO}" alt=""><b class="bric" style="font-size:16px">SA. Team</b><span class="sp"></span>${pv ? `<span class="chip">${typeof pv === 'string' ? esc(pv) : 'preview'}</span>` : '<button class="btn sm" data-a="signout">Sign out</button>'}</div>`;
  let body;
  const sop = st.sop && (E.sops || []).find((x) => x.id === st.sop);
  if (st.tm && E.team) {
    body = `<button class="btn sm" data-a="tmback" style="align-self:flex-start">← Back</button>${teamPanel(E, st, pv)}`;
  } else if (st.msg) {
    body = `<button class="btn sm" data-a="msgclose" style="align-self:flex-start">← Back</button>${msgBox(E, st)}`;
  } else if (st.hl && E.pending_handin) {
    body = `<button class="btn sm" data-a="hlateno" style="align-self:flex-start">← Back</button><div><b class="bric" style="font-size:22px">Hand-in</b><div class="mu" style="font-size:12.5px">For your shift ${esc(E.pending_handin.shift)}</div></div>
      <div class="tcard">${hiFields(E.handin_form, st.hv)}</div><div class="sp"></div><button class="big go" data-a="hlatesend">Send hand-in</button>`;
  } else if (sop) {
    body = `<button class="btn sm" data-a="sopback" style="align-self:flex-start">← Back</button><div><div class="mu2" style="font-size:11.5px">SOP · updated ${dayName(ms(sop.changed_at))}</div><b class="bric" style="font-size:22px">${esc(sop.title)}</b></div><div class="tcard sopbody">${esc(sop.body || 'Nothing written yet.')}</div>`;
  } else if (open && onBreak) {
    body = `<div class="row"><span class="st br"><i></i>On break</span><span class="sp"></span><span class="mu" style="font-size:12px">${esc((open.models || []).join(', '))}</span></div>
      <div style="text-align:center;margin-top:20px"><div class="timer" data-t0="${ms(onBreak.started_at)}">${hms(Date.now() - ms(onBreak.started_at))}</div><div class="mu2" style="font-size:12px">break since ${tm(ms(onBreak.started_at))}</div></div>
      <div class="sp"></div><button class="big go" data-a="breakend">End break</button>`;
  } else if (open && st.co) {
    body = `<b class="bric" style="font-size:22px">Clock out</b><div class="tiles">${tileH(hm(worked(open, breaks)), 'worked')}${tileH(hm(brk(open, breaks)), 'breaks')}${tileH(ckAll(open) ? ckDone(open) + '/' + ckAll(open) : '—', 'checklist')}</div>
      ${ckAll(open) && ckDone(open) < ckAll(open) ? `<div class="tcard warn" style="font-size:12.5px">${plural(ckAll(open) - ckDone(open), 'checklist step')} not ticked. Fine if there's a reason; say it in the note.</div>` : ''}
      ${E.handin_form && E.handin_form.ask !== false ? `<div class="tcard"><div class="row" style="margin-bottom:6px"><b>Hand-in</b>${E.handin_form.required ? '<span class="chip" style="color:var(--warn)">required</span>' : '<span class="mu2" style="font-size:11.5px">for Sola</span>'}</div>${hiFields(E.handin_form, st.hv)}</div>` : ''}
      <div><div style="font-weight:700;margin-bottom:6px">Handover note</div><textarea id="handover" rows="5" style="width:100%;background:#141414;border-color:#262626" placeholder="What the next person should know: fans waiting, offers made, anything unfinished.">${esc(st.note || '')}</textarea></div>
      <div class="sp"></div><button class="big stop" data-a="clockout">Clock out</button><button class="btn" data-a="cancelco" style="height:40px">Back to my shift</button>`;
  } else if (open) {
    const t0 = ms(open.started_at), off = brk(open, breaks), can = breaksAllowed(me, role);
    body = `<div class="row"><span class="st on"><i></i>On shift</span><span class="sp"></span><span class="mu" style="font-size:12px">${esc((open.models || []).join(', '))}</span></div>
      <div style="text-align:center"><div class="timer" data-t0="${t0}" data-off="${off}">${hms(Date.now() - t0 - off)}</div><div class="mu2" style="font-size:12px">since ${tm(t0)} · break ${hm(off)}</div></div>
      ${can ? '<button class="big dark" data-a="breakstart">☕ Break</button>' : ''}
      ${ckAll(open) ? `<div><div style="font-weight:700;margin-bottom:2px">Checklist <span class="mu2">${ckDone(open)}/${ckAll(open)}</span></div>${open.checklist.map((x, i) => `<button class="ck ${x.done ? 'done' : ''}" data-a="tick" data-v="${i}"><i>${x.done ? '✓' : ''}</i><span>${esc(x.t)}</span></button>`).join('')}</div>` : (E.brief ? '' : '<div class="tcard mu" style="font-size:12.5px">No checklist for your role yet.</div>')}
      ${E.team ? `<button class="tcard row tmbtn" data-a="tmopen" style="width:100%;text-align:left"><span style="font-size:18px">👥</span><span style="flex:1"><b>My team</b><br><span class="mu2" style="font-size:12px">${tmSummary(E.team)}</span></span><span class="mu2">›</span></button>` : ''}
      ${briefBlock(E, st)}${(E.sops || []).length ? `<div class="tcard"><div style="font-weight:700;margin-bottom:4px">SOPs</div>${sopRows(E)}</div>` : ''}
      ${fromSola(E)}<button class="btn" data-a="msgopen" style="height:40px">💬 Message Sola</button>
      <div class="sp"></div><button class="big stop" data-a="costart">Clock out</button>`;
  } else {
    const W = weekStats(clocks, breaks), T = [['home', 'Home'], ...(E.team ? [['team', 'Team']] : []), ...((E.accounts || []).length ? [['accts', 'Accounts']] : []), ...((E.sops || []).length ? [['sops', 'SOPs']] : []), ['week', 'My week'], ['msg', 'Message']], cur = T.some((t) => t[0] === st.tab) ? st.tab : 'home';
    const tabs = `<div class="ttabs">${T.map(([k, n]) => `<button class="${cur === k ? 'on' : ''}" data-a="ttab" data-v="${k}">${n}</button>`).join('')}</div>`;
    if (cur === 'team') {
      body = `${tabs}${teamPanel(E, st, pv)}`;
    } else if (cur === 'accts') {
      body = `${tabs}<b class="bric" style="font-size:22px">My accounts</b><div class="mu" style="font-size:12.5px;margin-top:-8px">The logins for the accounts you work on. Keep them to yourself.</div>${E.accounts.map((a) => acctCard(a, st)).join('')}`;
    } else if (cur === 'msg') {
      body = `${tabs}${msgBox(E, st)}`;
    } else if (cur === 'sops') {
      body = `${tabs}<b class="bric" style="font-size:22px">SOPs</b><div class="tcard">${sopRows(E)}</div>`;
    } else if (cur === 'week') {
      const mx = Math.max(HOUR, ...W.days), D = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      body = `${tabs}<b class="bric" style="font-size:22px">My week</b>${weekCard(E)}
        <div class="tcard"><div class="wbars">${W.days.map((v, i) => `<div><i class="${v ? '' : 'z'}" style="height:${v ? Math.max(4, (v / mx) * 80) : 3}px"></i><span>${D[i]}</span></div>`).join('')}</div></div>
        <div class="tiles t2">${tileH(hm(W.work), 'hours')}${tileH(String(W.shifts), 'shifts')}${tileH(W.list.some((c) => c.ended_at) ? hm(W.avgBreak) : '—', 'avg break')}${tileH(W.pct == null ? '—' : W.pct + '%', 'checklists')}</div>
        ${W.list.length ? `<div class="tcard shl">${W.list.map((c) => `<div><span>${dayName(ms(c.started_at))} · ${tm(ms(c.started_at))}–${c.ended_at ? tm(ms(c.ended_at)) : 'now'}${c.auto_closed ? ' <span class="warn">(auto)</span>' : ''}</span><b class="mono">${hm(worked(c, breaks))}</b></div>`).join('')}</div>` : '<div class="tcard mu" style="font-size:12.5px">No shifts yet this week.</div>'}
        <div class="mu2" style="text-align:center;font-size:11px">No pay figures here · your payslip comes on pay day</div>`;
    } else {
      const pd = settings.next_pay_day ? new Date(settings.next_pay_day + 'T12:00:00') : null;
      body = `${tabs}<div><div class="mu" style="font-size:12px">${new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div><b class="bric" style="font-size:24px">Hey ${esc(first(me.name))} 👋</b><div style="margin-top:6px">${chip(role)}${E.lead ? ` <span class="mu2" style="font-size:12px">reports to ${esc(E.lead.name)}</span>` : ''}</div></div>
        <div class="tcard"><div style="font-weight:700;margin-bottom:8px">This week</div><div class="tiles">${tileH(hm(W.work), 'worked')}${tileH(String(W.shifts), 'shifts')}${tileH(W.pct == null ? '—' : W.pct + '%', 'checklists')}</div></div>
        <div class="tcard row" style="gap:12px;align-items:flex-start"><div style="font-size:22px">🗓</div><div style="font-size:12.5px;color:var(--mu);line-height:1.5"><b style="color:var(--tx)">${pd ? 'Next pay day: ' + pd.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : 'Pay day'}</b><br>Your payslip shows up here once it’s marked paid.</div></div>
        ${nextShiftCard(E)}${E.pending_handin && E.handin_form && E.handin_form.ask !== false ? `<button class="tcard row" data-a="hlate" style="gap:12px;align-items:flex-start;width:100%;text-align:left;border-color:#5a4a14"><div style="font-size:22px">📥</div><div style="font-size:12.5px;color:var(--mu);line-height:1.5;flex:1"><b style="color:var(--tx)">Hand in for your last shift</b><br>${esc(E.pending_handin.shift)} · takes a minute</div><span class="mu2">›</span></button>` : ''}${fromSola(E)}
        ${E.brief ? `<div class="tcard row" style="gap:12px;align-items:flex-start;border-color:#3a4a14"><div style="font-size:22px">📋</div><div style="font-size:12.5px;color:var(--mu);line-height:1.5"><b style="color:var(--tx)">${esc(E.brief.title)}</b><br>${plural(((E.brief.body || {}).accounts || []).length, 'account')} to work on${E.brief.mode === 'clockin' ? ', ready when you clock in' : ''}. Clock in to start.</div></div>` : ''}
        ${models.length && settings.clock_where !== 'discord' ? `<div class="tcard"><div style="font-weight:700;margin-bottom:8px">Who are you covering?</div><div class="mdl">${models.map((m) => `<button class="${(st.pick || []).includes(m.name) ? 'on' : ''}" data-a="pick" data-v="${esc(m.name)}">${esc(m.name)}</button>`).join('')}</div></div>` : ''}
        <div class="sp"></div>${settings.clock_where === 'discord' ? `<div class="tcard" style="text-align:center;border-color:#3b3f8f"><b>Clock in from Discord</b><div class="mu" style="font-size:12.5px;margin-top:4px">Tap <b>▶️ Clock in</b> on the panel${settings.bot_panel ? ' in <b>#' + esc(settings.bot_panel) + '</b>' : ''}. Breaks, clock-out and hand-ins work here too.</div></div>` : '<button class="big go" data-a="clockin">Clock in</button>'}`;
    }
  }
  return `<div class="tw ${pv ? 'pv' : ''}">${head}${body}</div>`;
}
// ---- what SA. Management sends: the brief, logins and SOPs ----
const tkey = (x) => `${x.key}@${x.day == null ? 0 : x.day}`;
const isNew = (s) => Date.now() - ms(s.changed_at) < 3 * DAY;
function sopRows(E) { return (E.sops || []).map((s) => `<button class="sopr" data-a="sopopen" data-v="${esc(s.id)}"><span>📄</span><span style="flex:1">${esc(s.title)}</span>${isNew(s) ? '<span class="chip" style="color:#0a0a0a;background:var(--ac)">updated</span>' : '<span class="mu2" style="font-size:11.5px">open</span>'}</button>`).join(''); }
function acctCard(a, st, inner) {
  const shown = (st.show || []).includes(a.key), has = a.pass != null || a.login != null;
  const row = (lbl, v, k) => `<div class="lrow"><span class="mu2">${lbl}</span><b class="mono">${shown ? esc(v || '—') : lbl === 'Login' && v ? esc(String(v).slice(0, 2)) + '••••' + esc(String(v).includes('@') ? String(v).slice(String(v).indexOf('@')) : '') : '••••••••'}</b>${v ? `<button class="btn sm" data-a="copyv" data-v="${esc(v)}" data-k="${k}">Copy</button>` : ''}</div>`;
  const body = has ? `${row('Login', a.login, 'login')}${row('Password', a.pass, 'password')}${a.twofa ? `<div class="mu2" style="font-size:11.5px">2FA: ${esc(a.twofa)}</div>` : ''}`
    : '<div class="mu2" style="font-size:12px">Login and password show here on their phone.</div>';
  if (inner) return `<div class="lbox">${body}</div>`;
  return `<div class="tcard"><div class="row"><b>${esc(a.handle || 'Account')}</b><span class="mu" style="font-size:12px">${esc(a.platform || '')}</span><span class="sp"></span>${has ? `<button class="btn sm" data-a="showlog" data-v="${esc(a.key)}">${shown ? 'Hide' : 'Show'}</button>` : ''}</div>${body}</div>`;
}
function briefBlock(E, st) {
  const b = E.brief; if (!b) return '';
  const A = (b.body || {}).accounts || [], notes = (b.body || {}).notes || [], R = E.reports || [];
  const card = (x) => {
    const k = tkey(x), ticks = (b.ticks || {})[k] || {}, steps = x.steps || [], acc = (E.accounts || []).find((a) => a.key === x.key);
    const done = R.find((r) => r.acct_key === x.key && r.day == x.day && r.kind === 'done'), stuck = R.find((r) => r.acct_key === x.key && r.day == x.day && r.kind === 'stuck');
    const n = steps.filter((_, i) => ticks[i]).length;
    return `<div class="tcard bacc"><div class="row"><b>${esc(x.handle || 'Account')}</b><span class="mu" style="font-size:12px">${esc(x.platform || '')}${x.day ? ` · day ${esc(x.day)}${x.of ? ' of ' + esc(x.of) : ''}` : ''}${x.status && x.status !== 'warming' ? ' · ' + esc(x.status) : ''}</span><span class="sp"></span>${acc ? `<button class="btn sm" data-a="showlog" data-v="${esc(acc.key)}">${(st.show || []).includes(acc.key) ? 'Hide login' : 'Login 🔑'}</button>` : ''}</div>
      ${x.of ? `<div class="dbar">${Array.from({ length: Math.min(+x.of, 60) }, (_, i) => `<i class="${i < x.day - 1 ? 'g' : i === x.day - 1 ? 'p' : ''}"></i>`).join('')}</div>` : ''}
      ${acc && (st.show || []).includes(acc.key) ? acctCard(acc, st, true) : ''}
      ${steps.length ? `<div class="mu2" style="font-size:11.5px;margin-top:6px">Today ${n}/${steps.length}</div>${steps.map((s, i) => `<button class="ck ${ticks[i] ? 'done' : ''}" data-a="btick" data-v="${esc(k)}|${i}"><i>${ticks[i] ? '✓' : ''}</i><span>${esc(s.t || s)}${s.how ? `<small class="how">${esc(s.how)}</small>` : ''}</span></button>`).join('')}` : ''}
      ${stuck ? `<div class="stuckn">You said: ${esc(stuck.note || 'stuck')}</div>` : ''}
      ${done ? `<div class="donen">✓ Reported done · ${tm(ms(done.at))}</div>`
        : st.stuck === k ? `<textarea id="stucknote" rows="2" maxlength="500" placeholder="What stopped you? (e.g. it asked for a code)" style="width:100%;margin-top:8px"></textarea><div class="row" style="margin-top:6px"><button class="btn sm pri" data-a="bstucksend" data-v="${esc(k)}">Send to Sola</button><button class="btn sm" data-a="bstuckno">Cancel</button></div>`
        : `<div class="row" style="margin-top:8px"><button class="btn sm pri" data-a="bdone" data-v="${esc(k)}">✓ ${x.day ? 'Day ' + esc(x.day) + ' done' : 'Done'}</button><button class="btn sm" data-a="bstuck" data-v="${esc(k)}">Something stopped me</button></div>`}</div>`;
  };
  return `<div><div class="row" style="margin-bottom:6px"><b style="font-size:15px">${esc(b.title)}</b><span class="chip" style="color:var(--blue);background:#60a5fa22">from Sola · ${tm(ms(b.sent_at))}</span></div>
    ${A.length ? A.map(card).join('') : '<div class="tcard mu" style="font-size:12.5px">No accounts on your brief today.</div>'}
    ${notes.length ? `<div class="tcard" style="margin-top:2px"><div style="font-weight:700;margin-bottom:4px">Rules</div>${notes.map((t) => `<div class="mu" style="font-size:12.5px;padding:2px 0">• ${esc(t)}</div>`).join('')}</div>` : ''}</div>`;
}
// ---- a lead's “My team”: only the people and the parts their role was given ----
const SCOPE = { self: 'Only themselves', people: 'Their people', dept: 'Their department', all: 'Everyone' };
const SCOPE_SUB = { people: 'people who report to you', dept: 'your department', all: 'everyone on the team' };
const POWERS = [['live', 'Live floor: who’s on, breaks, timers'], ['handins', 'Hand-ins: Done / Stuck reports'], ['progress', 'Checklist + brief progress'], ['hours', 'Hours this week (never pay)'], ['fixclock', 'Fix forgotten clock-outs'], ['handover', 'Handover notes']];
function tmSummary(T) { const on = T.powers.live ? T.people.filter((p) => T.clocks.some((c) => c.person_id === p.id && !c.ended_at)).length : null; return `${plural(T.people.length, 'person')}${on != null ? ` · ${on} on now` : ''}`; }
function teamPanel(E, st, pv) { const T = E.team, pw = T.powers, wk = weekStart();
  const card = (p) => { const cl = T.clocks.filter((c) => c.person_id === p.id), open = cl.find((c) => !c.ended_at), br = open && T.breaks.find((b) => b.clock_id === open.id && !b.ended_at), last = cl.find((c) => c.ended_at);
    const brief = (T.briefs || []).find((b) => b.person_id === p.id), bt = brief ? brief.accounts.reduce((t, a) => t + a.steps, 0) : 0, bd = brief ? brief.accounts.reduce((t, a) => t + Object.values((brief.ticks || {})[`${a.key}@${a.day == null ? 0 : a.day}`] || {}).filter(Boolean).length, 0) : 0;
    const hrs = cl.reduce((t, c) => t + workedBetween(c, T.breaks, wk, wk + 7 * DAY), 0), ho = cl.find((c) => c.handover);
    const lt = pw.live && (T.late || []).find((x) => x.person_id === p.id);
    return `<div class="tcard tmp"><div class="row">${av(p.name, 30)}<div style="flex:1;min-width:0"><b>${esc(p.name)}</b> ${p.role ? `<span class="chip" style="color:${esc(p.role.color)};background:${esc(p.role.color)}22">${esc(p.role.name)}</span>` : ''}${lt ? ` <span class="chip" style="color:var(--bad);background:#f8717122">${lt.kind === 'late' ? 'late' : 'no-show'}</span>` : ''}
      ${pw.live ? `<div>${open ? (br ? `<span class="st br"><i></i>Break <span data-t0="${ms(br.started_at)}" data-fmt="hm">${hm(Date.now() - ms(br.started_at))}</span></span>` : `<span class="st on"><i></i>On · <span data-t0="${ms(open.started_at)}" data-off="${(open.break_secs || 0) * 1000}" data-fmt="hm">${hm(Date.now() - ms(open.started_at))}</span></span>`) : `<span class="st off"><i></i>${last ? 'Off · last on ' + ago(ms(last.ended_at)) : p.last_seen ? 'Off' : 'Hasn’t signed in yet'}</span>`}</div>` : ''}</div>${pw.hours ? `<b class="mono" style="font-size:12.5px">${hm(hrs)}</b>` : ''}</div>
      ${pw.progress ? `${open && ckAll(open) ? `<div class="mu2" style="font-size:11.5px;margin-top:8px">Checklist ${ckDone(open)}/${ckAll(open)}</div><div class="bar"><i style="width:${(ckDone(open) / ckAll(open)) * 100}%"></i></div>` : ''}${brief && bt ? `<div class="mu2" style="font-size:11.5px;margin-top:8px">Brief ${bd}/${bt}${brief.seen_at ? '' : ' · not opened yet'}</div><div class="bar"><i style="width:${(bd / bt) * 100}%"></i></div>` : ''}` : ''}
      ${pw.handover && ho ? `<div class="mu" style="font-size:12px;margin-top:8px">“${esc(ho.handover.slice(0, 140))}${ho.handover.length > 140 ? '…' : ''}” <span class="mu2">· ${ago(ms(ho.ended_at))}</span></div>` : ''}
      ${pw.fixclock ? cl.filter((c) => c.auto_closed).map((c) => st.fix === c.id ? `<div class="fixb"><div class="mu2" style="font-size:11.5px">Fix ${dayName(ms(c.started_at))}: when did they really start and stop?</div><div class="row" style="gap:6px;margin-top:6px"><input type="datetime-local" id="fx-in" value="${locT(c.started_at)}"><input type="datetime-local" id="fx-out" value="${locT(c.ended_at)}"></div><div class="row" style="margin-top:6px"><button class="btn sm pri" data-a="fxsave" data-v="${c.id}">Save</button><button class="btn sm" data-a="fxno">Cancel</button></div></div>`
        : `<div class="row fixr"><span class="warn" style="font-size:12px">⚠ Forgot to clock out ${dayName(ms(c.started_at))} (capped at 16h)</span><button class="btn sm" data-a="fxopen" data-v="${c.id}">Fix</button></div>`).join('') : ''}</div>`; };
  const ev = pw.handins ? (T.reports || []) : [], HI = pw.handins ? (T.handins || []) : [];
  return `<div><b class="bric" style="font-size:22px">My team</b><div class="mu" style="font-size:12.5px">${SCOPE_SUB[T.scope] || ''} · ${plural(T.people.length, 'person')}</div></div>
    ${T.people.map(card).join('')}
    ${pw.handins ? `<div class="tcard"><div style="font-weight:700;margin-bottom:6px">Hand-ins</div>${ev.length ? ev.map((r) => { const p = T.people.find((x) => x.id === r.person_id); return `<div class="row" style="font-size:12.5px;padding:5px 0;border-top:1px solid #1f1f1f;align-items:flex-start"><span>${r.kind === 'done' ? '✅' : '⚠'}</span><span style="flex:1"><b>${esc(p ? first(p.name) : '?')}</b> · ${esc(r.handle || 'account')}${r.day ? ' day ' + r.day : ''} ${r.kind === 'done' ? 'done' : 'stuck'}${r.note ? `<div class="mu2">“${esc(r.note)}”</div>` : ''}</span><span class="mu2">${tm(ms(r.at))}</span></div>`; }).join('') : '<div class="mu2" style="font-size:12.5px">Nothing in the last 2 days.</div>'}
      ${HI.map((h) => { const p = T.people.find((x) => x.id === h.person_id); return `<div style="font-size:12.5px;padding:6px 0;border-top:1px solid #1f1f1f"><b>📥 ${esc(p ? first(p.name) : '?')}</b> <span class="mu2">${esc(h.shift || '')}${h.late ? ' · late' : ''}</span><div class="mu">${(h.fields || []).map((x) => `${esc(x.label)}: <b style="color:var(--tx)">${esc(hiVal(x, h.values[x.k]))}</b>`).join(' · ')}</div></div>`; }).join('')}</div>` : ''}
    <div class="mu2" style="font-size:11.5px;text-align:center">Sola decides what you see here. Never: pay, rates or other people’s logins.</div>`; }
const locT = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// the same view, worked out on the owner's side for What they see
function visibleFor(p) { const O = S.O, r = (O.roles || []).find((x) => x.id === p.role_id); if (!r || (r.scope || 'self') === 'self' || !Object.keys(r.powers || {}).length) return [];
  const P = O.people.filter((x) => !x.gone);
  if (r.scope === 'people') { const out = new Set(), walk = (id) => P.filter((x) => x.lead_id === id).forEach((x) => { if (!out.has(x.id) && x.id !== p.id) { out.add(x.id); walk(x.id); } }); walk(p.id); return [...out]; }
  if (r.scope === 'dept') return P.filter((x) => !x.is_owner && x.id !== p.id && r.department_id && ((O.roles.find((y) => y.id === x.role_id) || {}).department_id === r.department_id)).map((x) => x.id);
  return P.filter((x) => !x.is_owner && x.id !== p.id).map((x) => x.id); }
function teamFor(p) { const O = S.O, r = (O.roles || []).find((x) => x.id === p.role_id), ids = visibleFor(p); if (!r || !ids.length) return null; const pw = r.powers || {};
  return { scope: r.scope, powers: pw, people: O.people.filter((x) => ids.includes(x.id)).map((x) => { const rr = O.roles.find((y) => y.id === x.role_id); return { id: x.id, name: x.name, active: x.active, last_seen: x.last_seen, role: rr ? { name: rr.name, color: rr.color } : null }; }),
    clocks: O.clocks.filter((c) => ids.includes(c.person_id)).map((c) => ({ ...c, checklist: pw.progress ? c.checklist : null, handover: pw.handover ? c.handover : null })), breaks: pw.live ? O.breaks.filter((b) => ids.includes(b.person_id)) : [],
    briefs: pw.progress ? (O.briefs || []).filter((b) => ids.includes(b.person_id)).map((b) => ({ person_id: b.person_id, title: b.title, seen_at: b.seen_at, ticks: b.ticks, accounts: ((b.body || {}).accounts || []).map((a) => ({ key: a.key, handle: a.handle, day: a.day == null ? null : a.day, steps: (a.steps || []).length })) })) : [],
    reports: pw.handins ? (O.reports || []).filter((x) => ids.includes(x.person_id) && Date.now() - ms(x.at) < 2 * DAY) : [],
    handins: pw.handins ? (O.handins || []).filter((h) => ids.includes(h.person_id) && Date.now() - ms(h.at) < 7 * DAY) : [], late: pw.live ? (O.late || []).filter((x) => ids.includes(x.person_id)) : [] }; }
const tileH = (a, b) => `<div class="tile"><b>${esc(a)}</b><div>${esc(b)}</div></div>`;
// ---- hand-in fields, messages, the schedule (team member side) ----
function hiFields(f, v) { v = v || {};
  return (f.fields || []).map((x) => `<div class="hif"><label>${esc(x.label)}</label>${x.type === 'ratio' ? `<div class="row" style="gap:6px"><input id="hi-${esc(x.k)}-a" inputmode="decimal" placeholder="e.g. 665" value="${esc((v[x.k] || {}).a || '')}"><span class="mu2">/</span><input id="hi-${esc(x.k)}-b" inputmode="decimal" placeholder="e.g. 600" value="${esc((v[x.k] || {}).b || '')}"></div>`
    : x.type === 'text' ? `<textarea id="hi-${esc(x.k)}" rows="2" maxlength="1000">${esc(v[x.k] || '')}</textarea>` : `<input id="hi-${esc(x.k)}" ${x.type === 'number' ? 'inputmode="decimal"' : ''} placeholder="${x.type === 'link' ? 'https://…' : ''}" value="${esc(v[x.k] || '')}">`}</div>`).join(''); }
function readHi(f, root) { const q = (id) => (root || document).querySelector('#' + id), out = {}; let any = false;
  for (const x of (f && f.fields) || []) { if (x.type === 'ratio') { const a = (q(`hi-${x.k}-a`) || {}).value, b = (q(`hi-${x.k}-b`) || {}).value; if (a || b) { out[x.k] = { a: +String(a).replace(',', '.'), b: +String(b).replace(',', '.') }; any = true; } }
    else { const e = q('hi-' + x.k), v = e ? e.value.trim() : ''; if (v) { out[x.k] = x.type === 'number' ? +v.replace(',', '.') : v; any = true; } } }
  return any ? out : null; }
const hiVal = (x, v) => (v == null ? '—' : x.type === 'ratio' ? `${v.a} / ${v.b} → ${(v.a / v.b).toFixed(2)}` : String(v));
const KIND = { update: ['Update', 'var(--ac)'], question: ['Question', 'var(--blue)'], problem: ['Problem', 'var(--bad)'] };
const kindChip = (k) => { const x = KIND[k] || KIND.update; return `<span class="chip" style="color:${x[1]};background:${x[1].replace('var(--ac)', '#c6ff4d')}22">${x[0]}</span>`; };
function msgBox(E, st) { const k = st.mk || 'update', M = E.messages || [];
  return `<div><b class="bric" style="font-size:22px">Message Sola</b><div class="mu" style="font-size:12.5px">Short and about work. Replies show up here.</div></div>
    <div class="tcard"><div class="mdl" style="margin-bottom:8px">${Object.entries(KIND).map(([v, [n]]) => `<button class="${k === v ? 'on' : ''}" data-a="msgkind" data-v="${v}">${n}</button>`).join('')}</div>
    <textarea id="msgtext" rows="4" maxlength="280" style="width:100%" placeholder="${k === 'problem' ? 'What’s wrong? e.g. IG wants a phone check on @paige.fit' : k === 'question' ? 'What do you need to know?' : 'What’s new?'}"></textarea><div class="row" style="margin-top:6px"><small class="mu2" id="msgn">0 / 280</small><span class="sp"></span><button class="btn pri" data-a="msgsend">Send</button></div></div>
    ${M.length ? `<div class="tcard"><div style="font-weight:700;margin-bottom:4px">Your messages</div>${M.map((m) => `<div class="msgr"><div class="row">${kindChip(m.kind)}<span class="mu2" style="font-size:11.5px">${dayName(ms(m.at))} · ${tm(ms(m.at))}</span>${m.done_at && !m.reply ? '<span class="ok" style="font-size:11.5px">✓ seen</span>' : ''}</div><div style="font-size:13px;margin-top:3px">${esc(m.text)}</div>${m.reply ? `<div class="reply"><b>Sola:</b> ${esc(m.reply)}</div>` : ''}</div>`).join('')}</div>` : ''}`; }
function fromSola(E) { const R = [...(E.messages || []).filter((m) => m.reply).map((m) => ({ at: m.reply_at, t: m.reply, re: m.text })), ...(E.handins || []).filter((h) => h.reply).map((h) => ({ at: h.reply_at, t: h.reply, re: 'Hand-in · ' + h.shift }))].filter((x) => Date.now() - ms(x.at) < 3 * DAY).sort((a, z) => ms(z.at) - ms(a.at)).slice(0, 3);
  return R.length ? `<div class="tcard" style="border-color:#1e3a5f"><div style="font-weight:700;margin-bottom:4px">From Sola</div>${R.map((x) => `<div class="msgr"><div style="font-size:13px">${esc(x.t)}</div><div class="mu2" style="font-size:11px">re: ${esc(String(x.re).slice(0, 60))} · ${ago(ms(x.at))}</div></div>`).join('')}</div>` : ''; }
const sTime = (date, hmv, tz) => { try { return new Date(SAT.toUtc(date, hmv, tz)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch { return hmv; } };
function nextShiftCard(E) { const W = E.week; if (!W) return ''; const me = E.me.id, now = Date.now();
  const up = W.shifts.filter((x) => x.person_id === me).map((x) => { const [a, z] = SAT.window(x, x.date, W.tz); return { ...x, a, z }; }).filter((x) => x.z > now).sort((a, z) => a.a - z.a)[0];
  if (!up) return '';
  const on = up.a <= now, late = !on ? false : !E.clocks.some((c) => !c.ended_at);
  return `<div class="tcard row" style="gap:12px;align-items:flex-start${late ? ';border-color:#5a2a2a' : ''}"><div style="font-size:22px">⏰</div><div style="font-size:12.5px;color:var(--mu);line-height:1.5"><b style="color:var(--tx)">${on ? (late ? 'Your shift started ' + ago(up.a).replace(' ago', '') + ' ago' : 'You’re on shift') : 'Next shift: ' + (up.date === SAT.today(W.tz) ? 'today' : dayName(up.a))}</b><br>${new Date(up.a).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–${new Date(up.z).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${up.what ? ' · ' + esc(up.what) : ''}</div></div>`; }
function weekCard(E) { const W = E.week; if (!W) return ''; const mine = W.shifts.filter((x) => x.person_id === E.me.id), D = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const row = (pid, nm) => `<div class="wkr"><b>${esc(nm)}</b>${W.days.map((d, i) => { const x = W.shifts.find((y) => y.person_id === pid && y.date === d); return `<span class="${x ? 'on' : ''}" title="${x ? esc(x.start + '–' + x.end + (x.what ? ' · ' + x.what : '')) : ''}">${x ? esc(sTime(d, x.start, W.tz).replace(':00', '').replace(' ', '').toLowerCase()) : '·'}</span>`; }).join('')}</div>`;
  return `<div class="tcard"><div class="row" style="margin-bottom:6px"><b>Schedule</b><span class="sp"></span><span class="mu2" style="font-size:11.5px">this week</span></div>
    ${mine.length ? mine.map((x) => `<div class="row" style="font-size:13px;padding:4px 0;border-top:1px solid #1f1f1f"><span style="width:44px" class="mu">${D[SAT.monDow(x.date)]}</span><b>${esc(sTime(x.date, x.start, W.tz))}–${esc(sTime(x.date, x.end, W.tz))}</b><span class="mu2">${esc(x.what || '')}</span></div>`).join('') : '<div class="mu2" style="font-size:12.5px">No shifts set for you this week.</div>'}
    ${W.see_team && W.people.length > 1 ? `<details style="margin-top:8px"><summary class="mu" style="font-size:12.5px;cursor:pointer">Team this week</summary><div class="wkh"><b></b>${D.map((d) => `<span>${d[0]}</span>`).join('')}</div>${W.people.map((p) => row(p.id, p.name)).join('')}</details>` : ''}</div>`; }

// =====================================================================================================
// the owner's side
// =====================================================================================================
const NAV = [['live', 'live', 'Live floor'], ['people', 'ppl', 'People'], ['roles', 'dep', 'Departments & roles'], ['sched', 'cal', 'Schedule'], ['handins', 'inb', 'Hand-ins'], ['msgs', 'msg', 'Messages'], ['sops', 'sop', 'Briefs & SOPs'], ['discord', 'dc', 'Discord posts'], ['bot', 'dc', 'Discord bot'], ['wts', 'eye', 'What they see'], ['settings', 'set', 'Settings']];
const SOON = [['pay', 'Pay', 4]];
const badge = (k) => { const O = S.O; if (!O) return 0; if (k === 'handins') return (O.handins || []).filter((h) => !h.reviewed_at).length; if (k === 'msgs') return (O.messages || []).filter((m) => !m.done_at).length; if (k === 'sched') return (O.late || []).length; return 0; };
function ownerView() {
  if (!NAV.some((n) => n[0] === S.page)) setPage('live');
  const O = S.O, team = O.people.filter((p) => !p.is_owner);
  $('#app').innerHTML = `<div class="app"><div class="nav"><div class="brand"><img src="${LOGO}" alt=""><div><b>${esc(O.settings.team_name || 'SA. Team')}</b><small>the online office</small></div></div>
    ${NAV.map(([k, i, n]) => { const b = badge(k); return `<button class="ni ${S.page === k ? 'on' : ''}" data-a="page" data-v="${k}">${svg(i)}${n}${b ? `<small class="nb ${k === 'sched' ? 'warn' : ''}">${b}</small>` : ''}</button>`; }).join('')}
    <div class="nsec">Coming next</div>${SOON.map(([i, n, ph]) => `<button class="ni" disabled title="Phase ${ph}">${svg(i)}${n}<small>P${ph}</small></button>`).join('')}
    <div class="nfoot">${plural(team.filter((p) => p.active).length, 'person')} on the team<br>${team.filter((p) => p.active && !p.last_seen).length ? `<span class="warn">${team.filter((p) => p.active && !p.last_seen).length} never signed in</span><br>` : ''}<button class="btn sm" data-a="signout" style="margin-top:8px">Sign out</button></div></div>
    <div class="main" id="main"></div></div>`;
  paintMain();
}
function paintMain() {
  const m = $('#main'); if (!m) return;
  ({ live: liveView, people: peopleView, roles: rolesView, sched: schedView, handins: handinsView, msgs: msgsView, sops: sopsView, discord: discordView, bot: botView, wts: wtsView, settings: settingsView }[S.page] || liveView)(m);
  tick();
}
const myTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } };
const payDay = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '—');
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
  const kpis = [['On now', String(on.length), `of ${team.length} on the team`, 'hot'], ['On break', String(br.length), br.map((x) => first(x.p.name)).join(', ') || 'nobody', br.length ? 'warn' : ''], ['Hours today', (hrs / HOUR).toFixed(1), 'team total', ''], ['Never signed in', String(notIn.length), notIn.length ? notIn.map((p) => first(p.name)).slice(0, 3).join(', ') : 'everyone’s been in', notIn.length ? 'warn' : ''], ['Auto clock-outs', String(auto.length), auto.length ? 'forgot to clock out · check People' : 'none in 2 weeks', auto.length ? 'warn' : ''], ['Late / no-show', String((O.late || []).length), (O.late || []).length ? O.late.map((x) => first(x.name)).slice(0, 3).join(', ') : 'from the Schedule', (O.late || []).length ? 'warn' : '']];
  // activity: today's events, newest first
  const ev = [];
  for (const c of O.clocks) { const p = O.people.find((x) => x.id === c.person_id); if (!p) continue;
    if (ms(c.started_at) >= t0) ev.push([ms(c.started_at), '⏱', `${p.name} clocked in`, (c.models || []).length ? 'covering ' + c.models.join(', ') : '']);
    if (c.ended_at && ms(c.ended_at) >= t0) ev.push([ms(c.ended_at), c.auto_closed ? '⚠' : '⏹', c.auto_closed ? `Auto clock-out: ${p.name}` : `${p.name} clocked out`, c.auto_closed ? 'forgot to clock out · capped at 16h' : `${hm(worked(c, O.breaks))}${c.handover ? ' · “' + c.handover.slice(0, 70) + (c.handover.length > 70 ? '…' : '') + '”' : ''}`]); }
  for (const b of O.breaks) { const p = O.people.find((x) => x.id === b.person_id); if (p && ms(b.started_at) >= t0) ev.push([ms(b.started_at), '☕', `${p.name} started a break`, b.ended_at ? hm(ms(b.ended_at) - ms(b.started_at)) : 'still on it']); }
  for (const r of O.reports || []) { const p = O.people.find((x) => x.id === r.person_id); if (p && ms(r.at) >= t0) ev.push([ms(r.at), r.kind === 'done' ? '✅' : '⚠', `${p.name}: ${r.handle || 'account'}${r.day ? ' day ' + r.day : ''} ${r.kind === 'done' ? 'done' : 'stuck'}`, r.note || '']); }
  ev.sort((a, z) => z[0] - a[0]);
  const span = (c) => [Math.max(ms(c.started_at), t0), c.ended_at ? ms(c.ended_at) : Date.now()];
  const ganttRows = team.filter((p) => today.some((c) => c.person_id === p.id));
  const pct = (t) => (((t - t0) / DAY) * 100).toFixed(2);
  m.innerHTML = `${topBar('Live floor', new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + tm(Date.now()), `<button class="btn" data-a="refresh">Refresh</button><button class="btn dc" data-a="copylink">⧉ Copy the team link</button>`)}
  <div class="body"><div class="kpis">${kpis.map((k) => `<div class="card kpi ${k[3]}"><span>${k[0]}</span><b>${k[1]}</b><small>${esc(k[2])}</small></div>`).join('')}</div>
  ${team.length ? `<div class="live"><div class="card" style="padding:14px"><div class="row"><span class="lbl">Everyone</span><span class="sp"></span><span class="mu2" style="font-size:11.5px">click someone to open them</span></div>
    <div class="pgrid">${st.sort((a, z) => (z.open ? 1 : 0) - (a.open ? 1 : 0)).map(({ p, open, b, last }) => { const r = roleOf(p); return `<button class="pc ${!p.last_seen ? 'flag' : ''}" data-a="openp" data-v="${p.id}"><div class="r1">${av(p.name)}<div style="min-width:0;flex:1"><b>${esc(p.name)}</b> ${chip(r)}<div>${open ? (b ? `<span class="st br"><i></i>Break <span data-t0="${ms(b.started_at)}" data-fmt="hm">${hm(Date.now() - ms(b.started_at))}</span></span>` : `<span class="st on"><i></i><span data-t0="${ms(open.started_at)}" data-off="${brk(open, O.breaks)}" data-fmt="hm">${hm(worked(open, O.breaks))}</span></span>`) : `<span class="st off"><i></i>${!p.last_seen ? 'Hasn’t signed in yet' : last ? 'Off · last on ' + ago(ms(last.ended_at)) : 'Off · no shifts yet'}</span>`}${lateChip(p.id)}</div></div></div>
      <div class="w">${open ? `On <b>${esc((open.models || []).join(', ') || '—')}</b> since ${tm(ms(open.started_at))}${open.src === 'discord' ? ' <span class="src discord">Discord</span>' : ''}` : `${roleOf(p) ? esc(deptOf(roleOf(p)) ? deptOf(roleOf(p)).name : roleOf(p).name) : 'No role'}${p.discord ? ' · @' + esc(p.discord) : ''}`}</div>
      ${open && ckAll(open) ? `<div><div class="row mu2" style="font-size:11.5px;margin-bottom:4px"><span>Checklist ${ckDone(open)}/${ckAll(open)}</span></div><div class="bar"><i style="width:${(ckDone(open) / ckAll(open)) * 100}%"></i></div></div>` : ''}</button>`; }).join('')}</div></div>
    <div class="card feed"><div class="row" style="margin-bottom:6px"><span class="lbl">Today</span><span class="sp"></span><span class="mu2" style="font-size:11px">updates every 20s</span></div>${ev.length ? ev.slice(0, 40).map((e) => `<div class="fi"><div class="ic">${e[1]}</div><div><b>${esc(e[2])}</b><small>${esc(e[3])}${e[3] ? ' · ' : ''}${tm(e[0])}</small></div></div>`).join('') : '<div class="mu" style="padding:14px 0;font-size:12.5px">Nothing yet today.</div>'}</div></div>
    ${ganttRows.length ? `<div class="card gantt"><div class="row" style="margin-bottom:8px"><span class="lbl">Today</span><span class="sp"></span><span class="mu2" style="font-size:11px">12 AM ··· 6 AM ··· 12 PM ··· 6 PM ··· 12 AM</span></div>${ganttRows.map((p) => `<div class="grow"><span>${esc(first(p.name))}</span><div class="gtrack">${today.filter((c) => c.person_id === p.id).map((c) => { const [a, z] = span(c); return `<div class="gseg" style="left:${pct(a)}%;width:${Math.max(0.4, pct(z) - pct(a))}%;background:${colorOf(p.name)}"></div>`; }).join('')}${O.breaks.filter((b) => b.person_id === p.id && (b.ended_at ? ms(b.ended_at) : Date.now()) > t0).map((b) => `<div class="gseg b" style="left:${pct(Math.max(ms(b.started_at), t0))}%;width:${Math.max(0.3, pct(b.ended_at ? ms(b.ended_at) : Date.now()) - pct(Math.max(ms(b.started_at), t0)))}%"></div>`).join('')}<div class="gnow" style="left:${pct(Date.now())}%"></div></div></div>`).join('')}</div>` : ''}`
  : `<div class="card empty"><div><b style="color:var(--tx);font-size:15px">Nobody on the team yet.</b><br>1 · Departments & roles: make a department and a role (with its checklist).<br>2 · People: add someone. Saving gives you their employee ID to send them.<br>3 · Copy the team link and post it in your staff channel.<br><br><button class="btn pri" data-a="page" data-v="roles">Start with Departments & roles</button></div></div>`}</div>`;
}

const lateChip = (pid) => { const x = (S.O.late || []).find((y) => y.person_id === pid); return x ? ` <span class="chip" style="color:var(--bad);background:#f8717122">${x.kind === 'late' ? 'late ' + hm(Date.now() - ms(x.due)) : 'no-show'}</span>` : ''; };
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
    ${p.lead_id ? `<div class="fr"><span>Reports to<small>from SA. Management</small></span><span class="mu" style="font-size:13px">${esc((O.people.find((x) => x.id === p.lead_id) || {}).name || '—')}</span></div>` : ''}
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
  <div class="body"><div class="split"><div class="card lst">${groups.filter((g) => g.d || g.roles.length).map((g) => `${g.d ? `<button class="li ${sel === 'd:' + g.d.id ? 'on' : ''}" data-a="seld" data-v="d:${g.d.id}"><span style="width:10px;height:10px;border-radius:3px;background:${esc(g.d.color)}"></span><b>${esc(g.d.name)}</b><small style="margin-left:auto">${plural(g.roles.length, 'role')}</small></button>` : '<div class="lbl" style="padding:8px 10px 2px">No department</div>'}${g.roles.map((r) => `<button class="li ${sel === 'r:' + r.id ? 'on' : ''}" data-a="seld" data-v="r:${r.id}" style="padding-left:28px">${chip(r)}<small style="margin-left:auto">${r.ext_id ? 'L' + (r.level || 1) + ' · ' : ''}${(r.scope || 'self') !== 'self' && Object.keys(r.powers || {}).length ? '👁 ' + SCOPE[r.scope].toLowerCase() + ' · ' : ''}${plural(O.people.filter((p) => p.role_id === r.id && p.active).length, 'person')}</small></button>`).join('')}`).join('') || '<div class="mu" style="padding:12px;font-size:12.5px">Nothing yet.</div>'}</div>${ed}</div></div>`;
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
  const syn = !!r.ext_id, sc = r.scope || 'self', pw = r.powers || {};
  return `<div class="card ed" id="red" data-id="${r.id}"><div class="row"><b class="bric" style="font-size:20px">${isNew ? 'New role' : esc(r.name)}</b>${syn ? '<span class="sync">synced</span>' : ''}${isNew ? '' : `<span class="mu2" style="font-size:12px">${syn ? `level ${r.level || 1} · ` : ''}${plural(ppl.length, 'person')}${ppl.length ? ': ' + ppl.map((p) => esc(first(p.name))).join(', ') : ''}</span>`}</div>
    ${syn ? '<div class="mu2" style="font-size:12px;margin-top:-6px">Name, department and level come from SA. Management: change them there. Checklist, breaks and authority are set here.</div>' : ''}
    <div class="fr"><span>Name</span><input id="rname" value="${esc(r.name)}" maxlength="60" placeholder="Chatter" ${syn ? 'disabled' : ''}></div>
    <div class="fr"><span>Department</span><select id="rdept" ${syn ? 'disabled' : ''}><option value="">None</option>${O.departments.map((d) => `<option value="${d.id}" ${d.id === r.department_id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
    <div class="fr"><span>Colour</span>${swatches(r.color)}</div>
    <div class="fr"><span>Breaks<small>someone can still be set differently</small></span><label class="row" style="cursor:pointer"><button class="tg ${r.breaks_on ? 'on' : ''}" data-a="rtoggle" id="rbreaks"></button><span class="mu" style="font-size:12.5px">${r.breaks_on ? 'On' : 'Off'}</span></label></div>
    <div class="fr" style="align-items:start"><span>Shift checklist<small>every shift starts with these</small></span>${stepsEd('rsteps', r.checklist)}</div>
    <div class="mu2" style="font-size:12px">Checklist changes apply from the next clock-in. Pay for roles comes in phase 4 and is never shown to the team.</div>
    ${isNew ? '' : `<div style="padding-top:6px"><b style="font-size:15px">Authority</b> <span class="mu2" style="font-size:12.5px">what this role sees beyond their own shift</span></div>
    <div class="fr"><span>They can see<small>who counts as “theirs”</small></span><div class="seg3" id="rscope" data-v="${sc}">${Object.entries(SCOPE).map(([k, n]) => `<button class="${sc === k ? 'on' : ''}" data-a="rscope" data-v="${k}">${n}</button>`).join('')}</div></div>
    <div class="mu2" style="font-size:12px;margin:-6px 0 0">Their people = whoever reports to them in SA. Management (and their people’s people).</div>
    <div class="fr" style="align-items:start"><span>And they get<small>pick any</small></span><div class="pw2" id="rpowers">${POWERS.map(([k, n]) => `<label class="ck2"><input type="checkbox" data-k="${k}" ${pw[k] ? 'checked' : ''}>${n}</label>`).join('')}</div></div>
    <div class="lockr">🔒 Never, whatever you tick: pay, rates, commission, logins, your notes, Settings, People editing.</div>`}<div id="rerr"></div>
    <div class="row"><button class="btn pri" data-a="saver">${isNew ? 'Make the role' : 'Save'}</button>${isNew ? '' : `<button class="btn" data-a="rwts" data-v="${r.id}">${svg('eye').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8"')} What a ${esc(r.name)} sees</button>`}<span class="sp"></span>${isNew || syn ? '' : '<button class="btn bad" data-a="delr">Delete</button>'}</div></div>`;
}

// ---- Schedule ----
const h12 = (hmv) => { const [h, m] = String(hmv || '0:0').split(':').map(Number), a = h >= 12 ? 'p' : 'a', hh = h % 12 || 12; return m ? `${hh}:${pad(m)}${a}` : `${hh}${a}`; };
const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function schedView(m) {
  const O = S.O, tz = O.settings.tz || 'America/Chicago', today = SAT.today(tz), days = SAT.weekOf(SAT.addDays(today, 7 * (S.wkOff || 0)));
  const team = O.people.filter((p) => !p.is_owner && p.active), R = O.sched || {};
  const cell = (p, d) => { const x = SAT.shiftOn(O.shifts || [], O.shiftx || [], p.id, d), r = roleOf(p), c = r ? r.color : '#c6ff4d';
    return `<button class="shc ${x ? 'on' : ''} ${d === today ? 'td' : ''}" data-a="shedit" data-v="${p.id}|${d}" style="${x ? `background:${c}1f;border-color:${c}66;color:${c}` : ''}">${x ? `${h12(x.start)}–${h12(x.end)}${x.what ? `<small>${esc(x.what)}</small>` : ''}${x.one ? '<i title="just this day">•</i>' : ''}` : '+'}</button>`; };
  const onNow = team.filter((p) => O.clocks.some((c) => c.person_id === p.id && !c.ended_at));
  m.innerHTML = `${topBar('Schedule', `Week of ${new Date(days[0] + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })} · shifts show on their home screen`, `<button class="btn" data-a="wk" data-v="-1">‹</button><button class="btn" data-a="wk" data-v="0" ${S.wkOff ? '' : 'disabled'}>This week</button><button class="btn" data-a="wk" data-v="1">›</button>`)}
  <div class="body"><div class="schl"><div class="card" style="padding:14px 16px;overflow:auto">${team.length ? `<div class="sgrid"><div></div>${days.map((d, i) => `<div class="sgh ${d === today ? 'td' : ''}">${DOWS[i]} ${+d.slice(8)}</div>`).join('')}
    ${team.map((p) => `<div class="row" style="gap:8px;min-width:0">${av(p.name, 28)}<div style="min-width:0"><b style="font-size:13px">${esc(p.name)}</b><div class="mu2" style="font-size:11px">${esc((roleOf(p) || {}).name || 'No role')}</div></div></div>${days.map((d) => cell(p, d)).join('')}`).join('')}</div>
    <div class="mu2" style="font-size:12px;margin-top:12px">Click a box to add or change a shift: the time, plus a model or platform. It repeats every week unless you make it “just this day” (•). Times are ${esc(tz.replace('_', ' '))} time.</div>`
    : '<div class="mu" style="font-size:12.5px">Add people first (People).</div>'}</div>
    <div class="col" style="gap:14px"><div class="card" style="padding:14px 16px"><div class="lbl" style="margin-bottom:6px">Right now · ${tm(Date.now())}</div>
      ${(O.late || []).map((x) => `<div class="row" style="padding:6px 0;border-top:1px solid #1f1f1f;font-size:13px">${av(x.name, 26)}<span style="flex:1"><b>${esc(first(x.name))}</b> <span class="chip" style="color:var(--bad);background:#f8717122">${x.kind === 'late' ? 'late ' + hm(Date.now() - ms(x.due)) : 'no-show'}</span><div class="mu2" style="font-size:11.5px">was due ${tm(ms(x.due))}${x.what ? ' · ' + esc(x.what) : ''} · not clocked in</div></span></div>`).join('')}
      ${onNow.map((p) => { const c = O.clocks.find((x) => x.person_id === p.id && !x.ended_at); return `<div class="row" style="padding:6px 0;border-top:1px solid #1f1f1f;font-size:13px">${av(p.name, 26)}<span style="flex:1"><b>${esc(first(p.name))}</b> <span class="chip" style="color:var(--ok);background:#4ade8022">on · since ${tm(ms(c.started_at))}</span></span></div>`; }).join('')}
      ${!(O.late || []).length && !onNow.length ? '<div class="mu2" style="font-size:12.5px">Nobody on, nobody late.</div>' : ''}</div>
      <div class="card ed" style="padding:14px 16px"><div class="lbl">Rules</div>
        <div class="fr"><span>Late after<small>minutes past the start</small></span><input id="slate" type="number" min="1" max="120" value="${esc(R.late_min || 10)}" style="width:90px"></div>
        <label class="row" style="cursor:pointer;font-size:13px"><button class="tg ${R.see_team ? 'on' : ''}" data-a="tgl" id="sseet"></button>People can see teammates’ shifts</label>
        <label class="row" style="cursor:pointer;font-size:13px"><button class="tg ${R.only_shift ? 'on' : ''}" data-a="tgl" id="sonly"></button>Clock-in only during their shift<small class="mu2">(30 min early is fine)</small></label>
        <div class="row"><button class="btn pri" data-a="schedrules">Save rules</button></div></div></div></div></div>`;
}
function shiftDlg(pid, date) {
  const O = S.O, p = O.people.find((x) => x.id === pid), x = SAT.shiftOn(O.shifts || [], O.shiftx || [], pid, date), dn = DOWS[SAT.monDow(date)], nice = new Date(date + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const opts = [...new Set([...O.models.map((m) => m.name), 'Instagram', 'TikTok', 'X / Twitter', 'Reddit', 'Snapchat', 'Threads'])];
  $('#dlg').innerHTML = `<div class="scrim" id="dlgscrim"><div class="dlg"><h2>${esc(first(p.name))} · ${esc(nice)}</h2>
    <div class="row" style="gap:8px;margin:12px 0"><label class="col" style="gap:4px;flex:1"><span class="mu2" style="font-size:12px">Start</span><input type="time" id="shs" value="${esc(x ? x.start : '09:00')}"></label><label class="col" style="gap:4px;flex:1"><span class="mu2" style="font-size:12px">End</span><input type="time" id="she" value="${esc(x ? x.end : '13:00')}"></label></div>
    <label class="col" style="gap:4px"><span class="mu2" style="font-size:12px">Covering (model or platform, optional)</span><input id="shw" list="shwl" maxlength="60" value="${esc(x ? x.what : '')}" placeholder="e.g. Instagram"><datalist id="shwl">${opts.map((o) => `<option value="${esc(o)}">`).join('')}</datalist></label>
    <div class="seg3" id="shsc" data-v="${x && x.one ? 'once' : 'week'}" style="margin-top:12px"><button class="${x && x.one ? '' : 'on'}" data-a="rscope2" data-v="week">Every ${dn}</button><button class="${x && x.one ? 'on' : ''}" data-a="rscope2" data-v="once">Just ${esc(nice)}</button></div>
    <div class="mu2" style="font-size:12px;margin-top:6px">An end time before the start runs past midnight (6p–12a).</div>
    <div class="row" style="justify-content:flex-end;margin-top:14px">${x ? '<button class="btn bad" data-a="shdel">Remove</button><span class="sp"></span>' : ''}<button class="btn" data-a="closedlg">Cancel</button><button class="btn pri" data-a="shsave">Save</button></div></div></div>`;
  S.shd = { pid, date };
  $('#dlgscrim').onclick = (e) => { if (e.target.id === 'dlgscrim') $('#dlg').innerHTML = ''; };
}

// ---- Hand-ins ----
const FTYPES = [['number', 'Number'], ['text', 'Text'], ['link', 'Link'], ['ratio', 'Ratio (a / b)']];
function handinsView(m) {
  const O = S.O, all = O.handins || [], open = all.filter((h) => !h.reviewed_at), list = S.hAll ? all : open;
  const roles = O.roles.filter((r) => !r.gone), rid = roles.some((r) => r.id === S.hRole) ? S.hRole : (roles.find((r) => O.people.some((p) => p.role_id === r.id && p.active)) || roles[0] || {}).id;
  S.hRole = rid; const r = roles.find((x) => x.id === rid), f = S.hDraft && S.hDraft.rid === rid ? S.hDraft : { rid, ...(r && r.handin ? JSON.parse(JSON.stringify(r.handin)) : { fields: [], ask: true, required: false }) }; S.hDraft = f;
  const card = (h) => { const p = O.people.find((x) => x.id === h.person_id) || { name: '?' }, rr = roleOf(p);
    return `<div class="card hcard" style="padding:14px 16px"><div class="row">${av(p.name, 30)}<b>${esc(p.name)}</b>${chip(rr)}<span class="mu2" style="font-size:12px">${esc(h.shift || '')} · ${ago(ms(h.at))}</span>${h.late ? '<span class="chip" style="color:var(--warn)">late hand-in</span>' : ''}<span class="sp"></span>${h.reviewed_at ? '<span class="ok" style="font-size:12px">✓ reviewed</span>' : `<button class="btn sm pri" data-a="hrev" data-v="${h.id}">✓ Reviewed</button>`}</div>
      <div class="hgrid">${(h.fields || []).map((x) => `<div class="hv"><small>${esc(x.label)}</small>${x.type === 'link' && h.values[x.k] ? `<a href="${esc(h.values[x.k])}" target="_blank" rel="noopener">${esc(String(h.values[x.k]).replace(/^https?:\/\//, '').slice(0, 40))}</a>` : `<b>${esc(hiVal(x, h.values[x.k]))}</b>`}</div>`).join('')}</div>
      ${h.reply ? `<div class="reply"><b>You:</b> ${esc(h.reply)}</div>` : `<div class="row" style="margin-top:10px"><input id="hr-${h.id}" placeholder="Reply to ${esc(first(p.name))} (shows on their home screen)…" maxlength="500" style="flex:1"><button class="btn sm" data-a="hreply" data-v="${h.id}">Send</button></div>`}</div>`; };
  m.innerHTML = `${topBar('Hand-ins', 'What people hand in at the end of a shift', `<span class="seg2"><button class="${S.hAll ? '' : 'on'}" data-a="hall" data-v="0">To review ${open.length}</button><button class="${S.hAll ? 'on' : ''}" data-a="hall" data-v="1">All</button></span>`)}
  <div class="body"><div class="schl"><div class="col" style="gap:12px">${list.length ? list.map(card).join('') : `<div class="card empty"><div>${S.hAll ? 'No hand-ins in the last 2 weeks.' : 'Nothing to review.'}<br><span class="mu2">Build a form for a role on the right; people fill it in when they clock out.</span></div></div>`}</div>
    <div class="col" style="gap:14px"><div class="card ed" style="padding:14px 16px"><div class="lbl">Hand-in form · per role</div><div class="mu2" style="font-size:12px;margin-top:-6px">You build it. Each role gets its own.</div>
      ${roles.length ? `<select id="hrole">${roles.map((x) => `<option value="${x.id}" ${x.id === rid ? 'selected' : ''}>${esc(x.name)}${x.handin && (x.handin.fields || []).length ? ` (${x.handin.fields.length})` : ''}</option>`).join('')}</select>
      <div id="hfields" class="col" style="gap:6px">${f.fields.map((x, i) => `<div class="row hfr" data-i="${i}"><input value="${esc(x.label)}" maxlength="60" placeholder="e.g. Posts made" style="flex:1"><select>${FTYPES.map(([k, n]) => `<option value="${k}" ${x.type === k ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="btn sm" data-a="hfdel" data-v="${i}">✕</button></div>`).join('') || '<div class="mu2" style="font-size:12.5px">No fields yet: this role isn’t asked for a hand-in.</div>'}</div>
      <button class="btn sm" data-a="hfadd" style="align-self:flex-start">+ Add field</button>
      <label class="row" style="cursor:pointer;font-size:13px"><button class="tg ${f.ask !== false ? 'on' : ''}" data-a="tgl" id="hask"></button>Ask at clock-out</label>
      <label class="row" style="cursor:pointer;font-size:13px"><button class="tg ${f.required ? 'on' : ''}" data-a="tgl" id="hreq"></button>Required to clock out</label>
      <div class="row"><button class="btn pri" data-a="hfsave">Save form</button><span class="mu2" style="font-size:12px">${O.people.filter((p) => p.role_id === rid && p.active).length} ${r ? esc(r.name) : ''}${O.people.filter((p) => p.role_id === rid && p.active).length === 1 ? '' : 's'}</span></div>` : '<div class="mu2">Make a role first.</div>'}</div>
      <div class="card" style="padding:14px 16px"><div class="lbl">Also lands in</div><div class="mu" style="font-size:12.5px;margin-top:6px">SA. Management → Report log (source: SA. Team), and with their lead if the lead’s role has the Hand-ins power.</div></div></div></div></div>`;
}
const readHForm = () => { const f = S.hDraft; f.fields = [...document.querySelectorAll('#hfields .hfr')].map((r) => { const i = +r.dataset.i, old = f.fields[i] || {}; return { k: old.k, label: r.querySelector('input').value.trim(), type: r.querySelector('select').value }; }); const a = $('#hask'), q = $('#hreq'); if (a) f.ask = a.classList.contains('on'); if (q) f.required = q.classList.contains('on'); return f; };

// ---- Messages ----
function msgsView(m) {
  const O = S.O, all = O.messages || [], open = all.filter((x) => !x.done_at), list = S.mAll ? all : open;
  m.innerHTML = `${topBar('Messages', 'Short work messages from the team', `<span class="seg2"><button class="${S.mAll ? '' : 'on'}" data-a="mall" data-v="0">Open ${open.length}</button><button class="${S.mAll ? 'on' : ''}" data-a="mall" data-v="1">All</button></span>`)}
  <div class="body" style="max-width:900px"><div class="card" style="padding:6px 18px">${list.length ? list.map((x) => { const p = O.people.find((y) => y.id === x.person_id) || { name: '?' };
    return `<div class="mrow">${av(p.name, 32)}<div style="flex:1;min-width:0"><div class="row"><b>${esc(p.name)}</b>${kindChip(x.kind)}<span class="mu2" style="font-size:12px">${dayName(ms(x.at))} · ${tm(ms(x.at))}</span><span class="sp"></span>${x.done_at ? `<button class="btn sm" data-a="mdone" data-v="${x.id}|0">Reopen</button>` : `<button class="btn sm" data-a="mdone" data-v="${x.id}|1">✓ Done</button>`}</div>
      <div style="font-size:13.5px;margin-top:3px">${esc(x.text)}</div>${x.reply ? `<div class="reply"><b>You:</b> ${esc(x.reply)}</div>` : `<div class="row" style="margin-top:8px"><input id="mr-${x.id}" placeholder="Reply (they see it on their home screen)…" maxlength="500" style="flex:1"><button class="btn sm" data-a="mreply" data-v="${x.id}">Reply</button></div>`}</div></div>`; }).join('')
    : `<div class="mu" style="padding:22px 0;font-size:13px">${S.mAll ? 'No messages in the last 2 weeks.' : 'Nothing open.'} People write to you from the Message tab on their screen.</div>`}</div>
    <div class="mu2" style="font-size:12px;margin-top:10px">Every message also lands in SA. Management’s Report log (source: SA. Team). Message text never goes to Discord.</div></div>`;
}

// ---- Discord posts ----
const EVS = [['clock', 'Clock in / out', '“Maki clocked in · Instagram”'], ['breaks', 'Breaks', 'start / end of breaks'], ['late', 'Late / no-show', 'from the Schedule, after your late rule'], ['stuck', '“Something stopped me”', 'from briefs · never the note itself'], ['handin', 'Hand-in submitted', 'just “Maki handed in”, never the numbers'], ['recap', 'Daily recap', 'hours, hand-ins in/missing, open problems'], ['payday', 'Pay day reminder', 'the day before · date only'], ['announce', 'Your announcements', 'write one below, it posts as your team name']];
const CHS = [['main', 'Main'], ['alerts', 'Alerts'], ['announce', 'Announce']];
function discordView(m) {
  const O = S.O, d = O.discord || { hooks: {}, ev: {} };
  m.innerHTML = `${topBar('Discord posts', 'SA. Team posts work updates to your Discord by itself')}<div class="body"><div class="schl">
  <div class="col" style="gap:14px"><div class="card ed" style="padding:14px 16px"><div class="lbl">Channels</div><div class="mu2" style="font-size:12px;margin-top:-6px">Discord → the channel → Edit → Integrations → Webhooks → New Webhook → Copy Webhook URL. One link is enough.</div>
    ${CHS.map(([k, n]) => `<div class="fr"><span>${n}${d.hooks[k] ? `<small>saved · ends ${esc(d.hooks[k].slice(-4))}</small>` : ''}</span><div class="row"><input id="dh-${k}" class="mono" style="flex:1;font-size:12px" placeholder="${d.hooks[k] ? 'saved (paste a new link to replace)' : 'https://discord.com/api/webhooks/…'}"><button class="btn sm" data-a="dtest" data-v="${k}" ${d.hooks[k] ? '' : 'disabled'}>Test</button>${d.hooks[k] ? `<button class="btn sm bad" data-a="dclear" data-v="${k}">✕</button>` : ''}</div></div>`).join('')}
    <div class="fr"><span>Your Discord user ID<small>only for @mentions on alerts</small></span><input id="dmen" placeholder="${d.mention ? 'saved ' + esc(d.mention) : 'e.g. 123456789012345678'}" style="max-width:260px"></div></div>
  <div class="card ed" style="padding:14px 16px"><div class="lbl">What gets posted</div>${EVS.map(([k, n, sub]) => { const e = d.ev[k] || {}; return `<div class="evr" data-k="${k}"><button class="tg ${e.on ? 'on' : ''}" data-a="tgl"></button><div style="flex:1"><b style="font-size:13px">${n}</b><div class="mu2" style="font-size:11.5px">${sub}</div></div>${k === 'recap' || k === 'payday' ? `<input type="time" class="evt" value="${esc(e.time || (k === 'recap' ? '23:00' : '09:00'))}" style="width:110px">` : ''}${k === 'stuck' ? `<label class="row mu" style="font-size:12px;gap:4px"><input type="checkbox" class="evm" ${e.mention ? 'checked' : ''}>@ me</label>` : ''}<select class="evc">${CHS.map(([c, cn]) => `<option value="${c}" ${e.ch === c ? 'selected' : ''}>#${cn.toLowerCase()}</option>`).join('')}</select></div>`; }).join('')}
    <div class="row"><button class="btn pri" data-a="dsave">Save</button><span class="mu2" style="font-size:12px">Times are ${esc((O.settings.tz || '').replace('_', ' '))} time.</span></div></div></div>
  <div class="col" style="gap:14px"><div class="card ed" style="padding:14px 16px"><div class="lbl">Write an announcement</div><textarea id="dann" rows="4" maxlength="1800" placeholder="e.g. New rule from Monday: hand-ins are required before clock-out."></textarea>
    <div class="row"><label class="row mu" style="font-size:12.5px;gap:6px;cursor:pointer"><input type="checkbox" id="devery">@everyone</label><span class="sp"></span><button class="btn pri" data-a="dpost">Post</button></div>
    ${(O.announcements || []).length ? `<div class="mu2" style="font-size:12px">Last: ${O.announcements.map((a) => `“${esc(a.text.slice(0, 50))}${a.text.length > 50 ? '…' : ''}” · ${ago(ms(a.at))}`).join('<br>')}</div>` : ''}</div>
    <div class="card" style="padding:14px 16px"><div class="lbl">Never posted</div><div class="mu" style="font-size:12.5px;margin-top:6px">Pay, rates, earnings · account logins · message text · hand-in numbers · notes from “something stopped me” · anything from briefs/SOPs.</div></div>
    <div class="card" style="padding:14px 16px"><div class="lbl">Timed posts</div><div class="mu" style="font-size:12.5px;margin-top:6px">Late alerts, the recap and the pay day reminder are checked every 5 minutes by the SA. Team server (its Cron Trigger).</div></div></div></div></div>`;
}

// ---- Discord bot: clock in from Discord, linking, DM reminders, What they see in Discord ----
const BDM = [['soon', 'Shift starting soon', 'if they’re not clocked in yet', 'min', 'min before'], ['late', 'Late', 'after your late rule (Schedule)'], ['handin', 'Hand-in missing', 'with a “Hand it in” button', 'after', 'min after clock-out'], ['payday', 'Pay day', 'the period + hours logged, never money'], ['reply', 'Your replies', 'when you reply to their message']];
const dcUrl = () => String((window.SA_CONFIG || {}).url || '').replace(/\/$/, '') + '/discord';
const chName = (id) => { const b = (S.O && S.O.bot) || {}; if (b.panel && b.panel.channel_id === id) return b.panel.channel_name || 'clock-in'; const c = ((S.botChk || {}).channels || []).find((x) => x.id === id); return c ? c.name : 'clock-in'; };
const dmd = (t) => esc(t || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/&lt;#(\d+)&gt;/g, (_, id) => `<span class="dcm">#${esc(chName(id))}</span>`).replace(/\n/g, '<br>');
const BST = { 1: 'blu', 2: 'gry', 3: 'grn', 4: 'red', 5: 'gry' };
function dcButtons(rows, live) {
  return (rows || []).map((r) => `<div class="dcrow">${(r.components || []).map((c) => `<button class="dcb ${BST[c.style] || 'gry'}" ${live ? (c.style === 5 ? 'data-a="bpvlink"' : `data-a="bpv" data-v="${esc(c.custom_id)}"`) : 'disabled'}>${c.emoji ? esc(c.emoji.name) + ' ' : ''}${esc(c.label)}${c.style === 5 ? ' ↗' : ''}</button>`).join('')}</div>`).join('');
}
function dcMsg(d, o = {}) {
  const em = (d.embeds || []).map((e) => `<div class="dce" style="border-color:#${((e.color || 0xc6ff4d) >>> 0).toString(16).padStart(6, '0')}">${e.title ? `<b>${dmd(e.title)}</b>` : ''}${e.description ? `<div>${dmd(e.description)}</div>` : ''}${(e.fields || []).map((f) => `<div><b>${esc(f.name)}</b> ${esc(f.value)}</div>`).join('')}${e.footer ? `<small>${esc(e.footer.text)}</small>` : ''}</div>`).join('');
  return `<div class="dcmsg${o.eph ? ' eph' : ''}"><div class="dcav">SA</div><div class="dcb0"><div class="dch"><b>${esc((S.O.settings || {}).team_name || 'SA. Team')}</b><span class="dcbot">APP</span><small>${o.when || 'Today'}</small>${o.pin ? '<small>📌 pinned</small>' : ''}</div>
    ${d.content ? `<div class="dct">${dmd(d.content)}</div>` : ''}${em}${dcButtons(d.components, o.live)}${o.eph ? '<div class="dceph">👁 Only you can see this · <u>Dismiss message</u></div>' : ''}</div></div>`;
}
const BEV = [['clock', 'Clock in / out'], ['breaks', 'Breaks'], ['handin', 'Hand-in submitted'], ['late', 'Late / no-show'], ['stuck', 'Something stopped me'], ['recap', 'Daily recap'], ['payday', 'Pay day reminder'], ['announce', 'Your announcements']];
const PANELS = [['onb', '🔗 Onboarding panel', 'Link my Discord · Open SA. Team'], ['clk', '🕒 Clock-in panel', 'Clock in · Break · Clock out · My week · My hours · Message Sola · Something stopped me']];
function botView(m) {
  const O = S.O, b = O.bot || { dm: {}, panels: {}, route: {}, clean: {}, channels: [] }, ck = S.botChk, people = O.people.filter((p) => !p.gone).sort((x, y) => (x.is_owner ? 1 : 0) - (y.is_owner ? 1 : 0)), team = people.filter((p) => !p.is_owner);
  const st = !ck ? `<span class="mu2">Not checked yet · press <b>Check</b></span>` : !ck.token ? `<span class="warn">No bot key yet.</span> <span class="mu2">${esc(ck.message || '')}</span>` : !ck.ok ? `<span class="bad">${esc(ck.message || 'Not working')}</span>` : `<span class="ok">✅ Connected as <b>${esc(ck.bot.name)}</b></span> <span class="mu2">· key ends ${esc(ck.token_end)}${ck.servers.length ? ' · in ' + esc(ck.servers.join(', ')) : ' · not in a server yet'}</span>${ck.app_ok ? '' : '<br><span class="warn">The Application ID above isn’t this bot’s. Copy it again from the Developer Portal.</span>'}`;
  const cmds = ck && ck.commands ? ck.commands : null, cmdOk = cmds && cmds.join() === 'link';
  const chs = (ck && ck.channels && ck.channels.length ? ck.channels : b.channels) || [], many = new Set(chs.map((c) => c.server)).size > 1;
  const chOpts = (sel, blank) => `${blank ? `<option value="">${blank}</option>` : ''}${chs.map((c) => `<option value="${c.id}" data-n="${esc(c.name)}" ${sel === c.id ? 'selected' : ''}>#${esc(c.name)}${many ? ' · ' + esc(c.server) : ''}</option>`).join('')}`;
  const ev = b.ev_on || {}, route = b.route || {}, clean = b.clean || {}, cl = b.clean_last;
  const pv = S.bpv || (S.bpv = { pid: (team[0] || people[0] || {}).id, steps: [], res: null, ch: 'clk' });
  const pvp = people.find((p) => p.id === pv.pid);
  const linkCell = (p) => { const waiting = p.link_code && ms(p.link_exp) > Date.now();
    return `<tr><td><b>${esc(p.name)}</b>${p.is_owner ? ' <span class="mu2">(you)</span>' : ''}<div>${chip(O.roles.find((r) => r.id === p.role_id))}</div></td><td>${p.discord_id ? `<span class="mono">@${esc(p.discord_name || 'linked')}</span>` : '<span class="mu2">—</span>'}</td>
      <td>${p.discord_id ? '<span class="ok">✅ linked</span>' : waiting ? `<span class="warn">code <b class="mono">${esc(p.link_code)}</b> · waiting</span>` : '<span class="mu2">not linked</span>'}</td>
      <td style="text-align:right">${p.discord_id ? `<button class="btn sm bad" data-a="bunlink" data-v="${p.id}">Unlink</button>` : `<button class="btn sm" data-a="bcode" data-v="${p.id}">${waiting ? 'New code' : 'Code'}</button>`}</td></tr>`; };
  const r = pv.res, rep = r && r.reply, isModal = rep && rep.type === 9, pans = (r && r.panels) || {}, pch = (k) => (b.panels && b.panels[k] && b.panels[k].channel_name) || (k === 'onb' ? 'onboarding' : 'clock-in');
  const need = !chs.length ? `<div class="mu2" style="font-size:12px">Press <b>Check</b> (above) to load your channels.</div>` : '';
  m.innerHTML = `${topBar('Discord bot', 'clock in, hand in and message from Discord · same records as the website')}<div class="body"><div class="schl bgrid">
  <div class="col" style="gap:14px">
    <div class="card ed" style="padding:14px 16px"><div class="lbl">1 · Connect the bot</div>
      <div class="fr"><span>Application ID<small>Developer Portal → General Information</small></span><input id="bapp" class="mono" value="${esc(b.app_id || '')}" placeholder="e.g. 1234567890123456789"></div>
      <div class="fr"><span>Public Key<small>same page, just under it</small></span><input id="bpub" class="mono" placeholder="${b.has_key ? 'saved ' + esc(b.public_key) + ' (paste to replace)' : '64 letters and numbers'}"></div>
      <div class="fr"><span>Interactions Endpoint URL<small>paste this into the Portal, same page</small></span><div class="row"><input class="mono" readonly value="${esc(dcUrl())}" style="flex:1;font-size:12px"><button class="btn sm" data-a="bcopyurl">Copy</button></div></div>
      <div class="fr"><span>Bot key<small>never here: Cloudflare secret BOT_TOKEN</small></span><div style="font-size:12.5px;line-height:1.5">${st}</div></div>
      <div class="fr"><span>Commands<small>only /link, as a backup</small></span><div class="row" style="font-size:12.5px">${cmds ? (cmdOk ? '<span class="ok">✅ set up</span>' : `<span class="warn">${cmds.length > 1 ? 'old commands still there: set up again' : 'not set up yet'}</span>`) : '<span class="mu2">check first</span>'}<span class="sp"></span><button class="btn sm" data-a="bcmds" ${ck && ck.ok ? '' : 'disabled'}>${cmdOk ? 'Set up again' : 'Set up commands'}</button></div></div>
      <div class="fr"><span>Invite the bot<small>to your Discord server, once</small></span><div class="row" style="font-size:12.5px">${b.app_id ? `<a class="btn sm" id="binv" href="https://discord.com/oauth2/authorize?client_id=${esc(b.app_id)}&scope=bot%20applications.commands&permissions=93184" target="_blank" rel="noopener">Open invite link ↗</a><span class="mu2">pick your server → Authorize</span>` : '<span class="mu2">save the Application ID first</span>'}</div></div>
      <div class="row"><button class="btn pri" data-a="bsave">Save</button><button class="btn" data-a="bcheck">Check</button><span class="mu2" style="font-size:12px">Check also refreshes your channel list.</span></div></div>
    <div class="card ed" style="padding:14px 16px"><div class="lbl">2 · Panels</div><div class="mu2" style="font-size:12px;margin-top:-6px">Each panel lives in its own channel, pinned. Post again after changes: it edits the same message.</div>
      ${PANELS.map(([k, n, sub]) => { const pn = (b.panels || {})[k]; return `<div class="evr" style="align-items:flex-start"><div style="flex:1"><b style="font-size:13px">${n}</b><div class="mu2" style="font-size:11.5px">${sub}</div><div style="font-size:11.5px;margin-top:3px">${pn ? `<span class="ok">#${esc(pn.channel_name || 'channel')}${pn.pinned ? ' · pinned' : ' · not pinned (pin it yourself)'} · ${ago(ms(pn.at))}</span>` : '<span class="mu2">not posted yet</span>'}</div></div>
        ${chs.length ? `<select id="bpch-${k}" style="width:150px">${chOpts(pn ? pn.channel_id : (chs.find((c) => c.name === (k === 'onb' ? 'onboarding' : 'clock-in')) || {}).id)}</select>` : ''}<button class="btn sm ${pn ? '' : 'pri'}" data-a="bpanel" data-v="${k}" ${chs.length ? '' : 'disabled'}>${pn ? 'Refresh' : 'Post'}</button></div>`; }).join('')}${need}</div>
    <div class="card ed" style="padding:14px 16px"><div class="lbl">3 · Where posts go</div><div class="mu2" style="font-size:12px;margin-top:-6px">The bot posts them in the channel you pick. “Webhook” uses the old Discord posts page.</div>
      ${BEV.map(([k, n]) => `<div class="evr broute" data-k="${k}"><button class="tg ${ev[k] ? 'on' : ''}" data-a="tgl"></button><div style="flex:1"><b style="font-size:13px">${n}</b></div><select class="brch" style="width:170px">${chOpts(route[k], 'Webhook (Discord posts)')}</select></div>`).join('')}
      <div class="row"><button class="btn pri" data-a="broutes">Save</button></div></div>
    <div class="card ed" style="padding:14px 16px"><div class="lbl">Where people clock in</div>
      <div class="seg3" style="margin-top:4px">${[['both', 'Website + Discord'], ['discord', 'Discord only'], ['web', 'Website only']].map(([v, t]) => `<button class="${b.where === v ? 'on' : ''}" data-a="bwhere" data-v="${v}">${t}</button>`).join('')}</div>
      <div class="mu2" style="font-size:12px;margin-top:8px">${b.where === 'discord' ? 'The website’s Clock in button points them to the Discord panel. Breaks, clock-out, hand-ins and messages still work on both.' : b.where === 'web' ? 'Discord buttons point them to the website. DMs still work.' : 'Either one. Every record says where it came from.'}</div></div>
    <div class="card ed" style="padding:14px 16px"><div class="lbl">DM reminders from the bot</div><div class="mu2" style="font-size:12px;margin-top:-6px">Private DMs, only to linked people, checked every 5 minutes.</div>
      ${BDM.map(([k, n, sub, f, unit]) => { const e = b.dm[k] || {}; return `<div class="evr bdm" data-k="${k}"><button class="tg ${e.on ? 'on' : ''}" data-a="tgl"></button><div style="flex:1"><b style="font-size:13px">${n}</b><div class="mu2" style="font-size:11.5px">${sub}</div></div>${f ? `<input type="number" class="bdmn" min="1" max="600" value="${esc(e[f] || (f === 'min' ? 15 : 30))}" style="width:70px"><span class="mu2" style="font-size:12px">${unit}</span>` : ''}</div>`; }).join('')}
      <div class="row"><button class="btn pri" data-a="bsave">Save</button></div></div>
  </div>
  <div class="col" style="gap:14px">
    <div class="card" style="padding:14px 16px"><div class="lbl">People</div><div class="mu2" style="font-size:12px;margin:4px 0 8px">Give each person a code once: they tap <b>🔗 Link my Discord</b> in #${esc(pch('onb'))} and type it. Codes last 7 days. Unlinked people still use the website.</div>
      <table class="tbl btbl"><tbody>${people.map(linkCell).join('')}</tbody></table></div>
    <div class="card ed" style="padding:14px 16px"><div class="lbl">Channel cleanup</div><div class="mu2" style="font-size:12px;margin-top:-6px">Every night from 4 AM. Pinned posts are never touched. Discord only lets bots clear messages younger than 14 days, so 13 days is the longest: anything you want longer stays on Keep.</div>
      ${chs.length ? `<table class="tbl btbl bclean"><tbody>${chs.map((c) => { const x = clean[c.id] || {}; return `<tr data-ch="${c.id}"><td><b>#${esc(c.name)}</b>${many ? `<div class="mu2" style="font-size:11px">${esc(c.server)}</div>` : ''}</td><td><select class="bcd">${[['0', 'Keep'], ['1', '1 day'], ['3', '3 days'], ['7', '7 days'], ['13', '13 days']].map(([v, t]) => `<option value="${v}" ${String(x.days || 0) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></td><td><select class="bcw"><option value="bot" ${x.what !== 'all' ? 'selected' : ''}>bot posts</option><option value="all" ${x.what === 'all' ? 'selected' : ''}>everything</option></select></td><td style="text-align:right">${x.days ? `<button class="btn sm" data-a="bcleannow" data-v="${c.id}">Clean now</button>` : ''}</td></tr>`; }).join('')}</tbody></table>
        <div class="row" style="margin-top:8px"><button class="btn pri" data-a="bcleansave">Save</button><span class="mu2" style="font-size:12px">${cl ? `Last run ${ago(ms(cl.at))}: ${cl.runs.map((x) => `${x.n} cleared in #${esc(x.name)}${x.err ? ' (' + esc(x.err) + ')' : ''}`).join(' · ')}` : 'Not run yet'}</span></div>` : need}</div>
    <div class="card" style="padding:14px 16px"><div class="row"><div class="lbl">What they see in Discord</div><span class="sp"></span><select id="bpvp" style="max-width:160px">${people.map((p) => `<option value="${p.id}" ${p.id === pv.pid ? 'selected' : ''}>${esc(p.name)}${p.is_owner ? ' (you)' : ''}</option>`).join('')}</select></div>
      <div class="mu2" style="font-size:12px;margin:6px 0 8px">Practice: click the buttons as ${esc(first(pvp ? pvp.name : ''))}. Built live from your settings. Nothing is saved, nobody gets a post.${pvp && !pvp.discord_id ? ' <span class="warn">(not linked yet: real taps would ask them to link first)</span>' : ''}</div>
      <div class="dcwin" id="dcwin"><div class="dcchan">${['onb', 'clk'].map((k) => `<button class="dctab ${pv.ch === k ? 'on' : ''}" data-a="bpvch" data-v="${k}"># ${esc(pch(k))}</button>`).join('')}</div>
        ${r ? dcMsg(pans[pv.ch] || r.panel, { pin: true, live: true }) : '<div class="mu2" style="padding:14px">Loading…</div>'}
        ${rep && rep.type === 4 ? dcMsg(rep.data, { eph: true, live: true }) : ''}
        ${isModal ? `<div class="dcmod"><b>${esc(rep.data.title)}</b>${rep.data.components.map((row) => { const c = row.components[0]; return `<label>${esc(c.label)}${c.required ? ' <span style="color:#f23f43">*</span>' : ''}${c.style === 2 ? `<textarea data-k="${esc(c.custom_id)}" rows="2" placeholder="${esc(c.placeholder || '')}"></textarea>` : `<input data-k="${esc(c.custom_id)}" placeholder="${esc(c.placeholder || '')}">`}</label>`; }).join('')}<div class="row" style="justify-content:flex-end"><button class="dcb gry" data-a="bpvx">Cancel</button><button class="dcb blu" data-a="bpvsub" data-v="${esc(rep.data.custom_id)}">Submit</button></div></div>` : ''}
        <div class="dccmd"><span class="mu2" style="font-size:12px;align-self:center">Replies here are private to them and vanish on reload.</span><span class="sp"></span><button data-a="bpvreset">↺ Start over</button></div></div></div>
    <div class="card" style="padding:14px 16px"><div class="lbl">Last 2 days · from where</div>${(O.bot_feed || []).length ? `<div class="bfeed">${O.bot_feed.slice(0, 14).map((x) => `<div><b>${esc(x.who)}</b><span>${esc(x.what)}</span><small>${tm(ms(x.at))}</small><span class="src ${x.src}">${x.src === 'discord' ? 'Discord' : 'Website'}</span></div>`).join('')}</div>` : '<div class="mu2" style="font-size:12.5px;margin-top:6px">Nothing yet.</div>'}</div>
  </div></div></div>`;
  if (!r && pv.pid && !pv.loading) bpvRun();
}
async function bpvRun(step) {
  const pv = S.bpv; if (!pv || !pv.pid) return; if (step) pv.steps.push(step); pv.loading = true;
  try { pv.res = await call('t_bot_preview', { p_pid: pv.pid, p_steps: pv.steps }); } catch (e) { toast(e.message, 4000); if (step) pv.steps.pop(); } finally { pv.loading = false; }
  if (S.page === 'bot') paintMain();
}
function codeDlg(p, c) {
  const B0 = S.O.bot || {}, P0 = B0.panels || {}; const msg = `Hey ${first(p.name)} 👋 Link your Discord to SA. Team: in our server, open #${(P0.onb && P0.onb.channel_name) || 'onboarding'} → tap 🔗 Link my Discord → type ${c.code} (works once, for 7 days). Then clock in from #${(P0.clk && P0.clk.channel_name) || 'clock-in'}.`;
  $('#dlg').innerHTML = `<div class="scrim" id="dlgscrim"><div class="dlg"><h2>${esc(first(p.name))}’s Discord code</h2><div class="bcode mono">${esc(c.code)}</div><p class="mu" style="font-size:12.5px">Lasts 7 days. Send it to ${esc(first(p.name))} privately. Once they’ve linked, the code stops working.</p>
    <textarea id="bcmsg" rows="3" readonly style="width:100%">${esc(msg)}</textarea><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-a="closedlg">Close</button><button class="btn pri" data-a="bcmcopy">Copy message</button></div></div></div>`;
  $('#dlgscrim').onclick = (e) => { if (e.target.id === 'dlgscrim') $('#dlg').innerHTML = ''; };
}

// ---- Briefs & SOPs (sent from SA. Management) ----
function sopsView(m) {
  const O = S.O, sops = O.sops || [], briefs = O.briefs || [], team = O.people.filter((p) => !p.is_owner && p.active);
  const sel = sops.find((x) => x.id === S.sopSel) || sops[0];
  const row = (p) => { const b = briefs.find((x) => x.person_id === p.id), R = (O.reports || []).filter((r) => r.person_id === p.id && ms(r.at) >= midnight());
    if (!b) return `<tr><td>${esc(p.name)}</td><td colspan="4" class="mu2">No brief sent</td></tr>`;
    const A = (b.body || {}).accounts || [], all = A.reduce((t, x) => t + (x.steps || []).length, 0), dn = A.reduce((t, x) => t + Object.values((b.ticks || {})[tkey(x)] || {}).filter(Boolean).length, 0);
    return `<tr><td><b>${esc(p.name)}</b><div class="mu2" style="font-size:11.5px">${esc(b.title)}</div></td><td>${ago(ms(b.sent_at))}${b.mode === 'clockin' ? ' · at clock-in' : ''}</td><td>${b.seen_at ? `<span class="ok">seen ${tm(ms(b.seen_at))}</span>` : '<span class="mu2">not seen yet</span>'}</td><td class="mono">${all ? dn + '/' + all : '—'}</td><td>${R.map((r) => `<span class="chip" style="color:${r.kind === 'done' ? 'var(--ok)' : 'var(--warn)'}">${esc(r.handle || '')} ${r.kind}</span>`).join(' ') || '<span class="mu2">—</span>'}</td></tr>`; };
  m.innerHTML = `${topBar('Briefs & SOPs', 'Sent from SA. Management · they see these after signing in')}<div class="body">
    ${!sops.length && !briefs.length ? '<div class="card empty"><div><b style="color:var(--tx);font-size:15px">Nothing sent yet.</b><br>In SA. Management, open <b>Briefs</b>, link SA. Team with your owner ID, then press <b>Send</b>.<br>Your SOPs, warm-up plans and rules sync over by themselves after that.</div></div>' : ''}
    ${briefs.length ? `<div class="card" style="padding:14px 16px"><div class="lbl" style="margin-bottom:8px">Today’s briefs</div><table><tr><th>Who</th><th>Sent</th><th>Seen</th><th>Ticked</th><th>Reports today</th></tr>${team.map(row).join('')}</table></div>` : ''}
    ${sops.length ? `<div class="split" style="margin-top:14px"><div class="card lst">${sops.map((x) => `<button class="li ${sel && x.id === sel.id ? 'on' : ''}" data-a="sopsel" data-v="${esc(x.id)}"><span>📄</span><div style="min-width:0;flex:1"><b>${esc(x.title)}</b><small>${x.everyone ? 'everyone' : 'only when attached to a brief'} · ${ago(ms(x.changed_at))}</small></div></button>`).join('')}</div>
      <div class="card ed">${sel ? `<b class="bric" style="font-size:20px">${esc(sel.title)}</b><div class="mu2" style="font-size:12px;margin-top:-8px">Edit it in SA. Management: changes sync here by themselves.</div><div class="sopbody">${esc(sel.body)}</div>` : ''}</div></div>` : ''}</div>`;
}

// ---- What they see ----
function teamDataFor(p) {
  const O = S.O;
  const brief = (O.briefs || []).find((b) => b.person_id === p.id) || null;
  return { me: p, role: roleOf(p), settings: O.settings, models: O.models, clocks: O.clocks.filter((c) => c.person_id === p.id), breaks: O.breaks.filter((b) => b.person_id === p.id),
    team: teamFor(p), lead: (() => { const l = O.people.find((x) => x.id === p.lead_id); return l ? { name: l.name } : null; })(), brief, sops: (O.sops || []).filter((s) => s.everyone || p.sop_all || (p.sop_access || []).includes(s.id) || (brief && (brief.sops || []).includes(s.id))), accounts: (O.accounts || []).filter((a) => a.person_id === p.id), reports: (O.reports || []).filter((r) => r.person_id === p.id && Date.now() - ms(r.at) < 2 * DAY),
    ...extrasFor(p) };
}
function extrasFor(p) {
  const O = S.O, r = roleOf(p), form = r && r.handin && (r.handin.fields || []).length ? r.handin : null, tz = O.settings.tz || 'America/Chicago', R = O.sched || {};
  const last = O.clocks.filter((c) => c.person_id === p.id && c.ended_at && Date.now() - ms(c.ended_at) < 2 * DAY).sort((a, z) => ms(z.started_at) - ms(a.started_at))[0];
  const pend = form && form.ask !== false && last && !(O.handins || []).some((h) => h.clock_id === last.id) ? { clock_id: last.id, shift: dayName(ms(last.started_at)) + ' ' + tm(ms(last.started_at)) + '–' + tm(ms(last.ended_at)) } : null;
  const pids = R.see_team ? O.people.filter((x) => x.active && !x.is_owner).map((x) => x.id) : [p.id], days = SAT.weekOf(SAT.today(tz));
  const shifts = days.flatMap((d) => pids.map((pid) => { const x = SAT.shiftOn(O.shifts || [], O.shiftx || [], pid, d); return x ? { person_id: pid, date: d, ...x } : null; }).filter(Boolean));
  return { handin_form: form, pending_handin: pend, handins: (O.handins || []).filter((h) => h.person_id === p.id && Date.now() - ms(h.at) < 7 * DAY), messages: (O.messages || []).filter((m) => m.person_id === p.id && Date.now() - ms(m.at) < 7 * DAY),
    week: { days, shifts, people: pids.map((id) => ({ id, name: first((O.people.find((x) => x.id === id) || {}).name) })), see_team: !!R.see_team, only_shift: !!R.only_shift, tz } };
}
// ---- practice ("Try it"): their real screen code, their real setup, nothing saved ----
function pracNew(p) {
  const E = teamDataFor(p), closed = E.clocks.filter((c) => c.ended_at);
  S.prac = { pid: p.id, E: { ...E, clocks: closed.map((c) => ({ ...c })), breaks: E.breaks.filter((b) => closed.some((c) => c.id === b.clock_id)).map((b) => ({ ...b })), brief: E.brief ? JSON.parse(JSON.stringify({ ...E.brief, ticks: {} })) : null, reports: [] }, st: { tab: 'home', pick: (p.models || []).filter((m) => S.O.models.some((x) => x.name === m)), co: false, note: '', show: [], sop: null, stuck: null }, done: { home: true } };
}
const pracOpen = () => S.prac.E.clocks.find((c) => !c.ended_at);
const PA = {
  ttab: (v) => { S.prac.st.tab = v; if (v === 'msg') S.prac.st.msg = false; if (v === 'team') S.prac.done.team = true; if (v === 'week' && S.prac.done.clockout) S.prac.done.week = true; if (v === 'accts') S.prac.done.accts = true; },
  pick: (v) => { const k = S.prac.st.pick.indexOf(v); if (k >= 0) S.prac.st.pick.splice(k, 1); else S.prac.st.pick.push(v); },
  clockin: () => {
    const P = S.prac, E = P.E; if (E.models.length && !P.st.pick.length) return toast('Pick who you’re covering first.', 2500);
    const steps = [...((E.role && E.role.checklist) || []), ...(E.me.extra_checklist || [])];
    E.clocks.unshift({ id: 'practice-' + Date.now(), person_id: E.me.id, started_at: new Date().toISOString(), ended_at: null, models: [...P.st.pick], checklist: steps.map((t) => ({ t, done: false })), handover: null, break_secs: 0, auto_closed: false });
    P.done.pick = true; P.done.clockin = true; toast('Clocked in (practice). Have a good one');
  },
  breakstart: () => { const c = pracOpen(); S.prac.E.breaks.push({ id: 'pb-' + Date.now(), clock_id: c.id, person_id: c.person_id, started_at: new Date().toISOString(), ended_at: null }); S.prac.done.brk = true; toast('Break started (practice)'); },
  breakend: () => { const b = S.prac.E.breaks.find((x) => !x.ended_at); if (b) b.ended_at = new Date().toISOString(); toast('Back on shift (practice)'); },
  tick: (v) => { const c = pracOpen(); c.checklist[+v].done = !c.checklist[+v].done; },
  costart: () => { S.prac.st.co = true; S.prac.st.note = ''; },
  sopopen: (v) => { S.prac.st.sop = v; S.prac.done.sop = true; },
  tmopen: () => { S.prac.st.tm = true; S.prac.done.team = true; },
  tmback: () => { S.prac.st.tm = false; S.prac.st.fix = null; },
  fxopen: (v) => { S.prac.st.fix = v; },
  fxno: () => { S.prac.st.fix = null; },
  fxsave: () => { S.prac.st.fix = null; toast('Shift fixed (practice, not saved)'); },
  sopback: () => { S.prac.st.sop = null; },
  showlog: (v) => { const s = S.prac.st.show, k = s.indexOf(v); if (k >= 0) s.splice(k, 1); else s.push(v); },
  copyv: () => toast('Copies on their phone (practice)'),
  btick: (v) => { const [k, i] = v.split('|'), t = S.prac.E.brief.ticks; t[k] = t[k] || {}; t[k][i] = !t[k][i]; S.prac.done.brief = true; },
  bdone: (v) => { const x = S.prac.E.brief.body.accounts.find((a) => tkey(a) === v); S.prac.E.reports.unshift({ id: 'pr' + Date.now(), acct_key: x.key, day: x.day, kind: 'done', handle: x.handle, at: new Date().toISOString() }); S.prac.done.brief = true; toast(`Reported ${x.handle || 'it'} done (practice, Sola doesn’t get it)`, 3200); },
  bstuck: (v) => { S.prac.st.stuck = v; },
  bstuckno: () => { S.prac.st.stuck = null; },
  bstucksend: (v) => { const t = document.querySelector('#pvbox #stucknote'), note = t ? t.value.trim() : ''; if (!note) return toast('Say what stopped you.'); const x = S.prac.E.brief.body.accounts.find((a) => tkey(a) === v); S.prac.E.reports.unshift({ id: 'ps' + Date.now(), acct_key: x.key, day: x.day, kind: 'stuck', note, handle: x.handle, at: new Date().toISOString() }); S.prac.st.stuck = null; S.prac.done.brief = true; toast('Sent (practice)'); },
  cancelco: () => { S.prac.st.co = false; },
  msgkind: (v) => { S.prac.st.mk = v; },
  msgopen: () => { S.prac.st.msg = true; },
  msgclose: () => { S.prac.st.msg = false; },
  msgsend: () => { const t = document.querySelector('#pvbox #msgtext'), v = t ? t.value.trim() : ''; if (!v) return toast('Write something first.'); S.prac.E.messages = [{ id: 'pm' + Date.now(), kind: S.prac.st.mk || 'update', text: v, at: new Date().toISOString() }, ...(S.prac.E.messages || [])]; S.prac.st.msg = false; S.prac.done.msg = true; toast('Sent (practice, Sola doesn’t get it)'); },
  hlate: () => { S.prac.st.hl = true; },
  hlateno: () => { S.prac.st.hl = false; },
  hlatesend: () => { S.prac.st.hl = false; S.prac.E.pending_handin = null; toast('Hand-in sent (practice)'); },
  clockout: () => {
    const P = S.prac, c = pracOpen(), now = new Date().toISOString(); const t = document.querySelector('#pvbox #handover'), f = P.E.handin_form;
    if (f && f.ask !== false && f.required && !readHi(f, document.querySelector('#pvbox'))) return toast('Fill in the hand-in first (it’s required for this role).', 3500);
    P.E.breaks.filter((b) => b.clock_id === c.id && !b.ended_at).forEach((b) => { b.ended_at = now; });
    c.break_secs = Math.round(P.E.breaks.filter((b) => b.clock_id === c.id).reduce((a, b) => a + ms(b.ended_at) - ms(b.started_at), 0) / 1000);
    c.ended_at = now; c.handover = t ? t.value.trim() || null : null; P.st.co = false; P.st.tab = 'home'; P.done.clockout = true;
    toast(`Clocked out · ${hm(ms(c.ended_at) - ms(c.started_at) - c.break_secs * 1000)} (practice, not saved)`, 3500);
  },
};
function wtsView(m) {
  const O = S.O, team = O.people.filter((p) => !p.is_owner);
  if (!team.some((p) => p.id === S.wts)) S.wts = (team.find((p) => p.active) || team[0] || {}).id || null;
  const p = team.find((x) => x.id === S.wts);
  if (!p) { m.innerHTML = `${topBar('What they see', 'Built live from your settings')}<div class="body"><div class="card empty">Add someone in People first.</div></div>`; return; }
  const live = teamDataFor(p), r = live.role, can = breaksAllowed(p, r), open = live.clocks.find((c) => !c.ended_at), nm = esc(first(p.name));
  const steps = (r ? r.checklist || [] : []).length, extra = (p.extra_checklist || []).length;
  const sees = [`Their name, “${r ? r.name : 'No role'}” and the date`, `Their own hours, shifts and checklist score this week`, `Clock in / out${can ? ', breaks' : ' (no breaks: ' + (p.breaks_override === false ? 'off just for them' : 'off for the role') + ')'}`, `A checklist of ${plural(steps + extra, 'step')} each shift${extra ? ` (${steps} from the role + ${extra} just for ${first(p.name)})` : ''}`, `Models to pick: ${O.models.map((x) => x.name).join(', ') || 'none set'}${(p.models || []).length ? ` (pre-picked: ${p.models.join(', ')})` : ''}`, O.settings.next_pay_day ? `The next pay day date (${O.settings.next_pay_day})` : 'A pay day card with no date (set one in Settings)', 'Their own handover notes',
    live.brief ? `Today’s brief from SA. Management: ${plural(((live.brief.body || {}).accounts || []).length, 'account')}, with Done / Something stopped me buttons` : 'No brief yet (send one from SA. Management → Briefs)',
    live.accounts.length ? `Logins for their own ${plural(live.accounts.length, 'account')}: ${live.accounts.map((a) => a.handle).join(', ')}` : 'No account logins (none assigned to them in SA. Management)',
    live.sops.length ? `SOPs: ${live.sops.map((x) => x.title).join(', ')}` : 'No SOPs',
    (() => { const n = live.week.shifts.filter((x) => x.person_id === p.id).length; return n ? `Their schedule: ${plural(n, 'shift')} this week${live.week.see_team ? ' (and teammates’ shifts)' : ''}` : 'No shifts on the Schedule this week'; })(),
    live.handin_form ? `A hand-in at clock-out: ${live.handin_form.fields.map((x) => x.label).join(', ')}${live.handin_form.required ? ' (required)' : ''}` : 'No hand-in (none set for their role)',
    'Message Sola (Update / Question / Problem) and your replies',
    live.team ? `My team: ${plural(live.team.people.length, 'person')} (${SCOPE[live.team.scope].toLowerCase()}) · ${POWERS.filter(([k]) => live.team.powers[k]).map(([, n]) => n.split(':')[0].replace(' (never pay)', '').toLowerCase()).join(', ')}` : 'Only their own shift (no authority)'];
  const hidden = ['Any rate, commission, sales or pay total (until you send payslips in phase 4)', 'Anyone else: names, hours, shifts or notes', 'Anyone else’s accounts, logins or brief', 'Live floor, People, Departments & roles, Settings', 'Your private note about them', 'Their own employee ID (nobody can read it back, not even you)'];
  const tryOn = !!S.wtsTry && p.active;
  if (tryOn && (!S.prac || S.prac.pid !== p.id)) pracNew(p);
  const seg = `<span class="seg2"><button class="${tryOn ? '' : 'on'}" data-a="wtstry" data-v="0">Live</button><button class="${tryOn ? 'on' : ''}" data-a="wtstry" data-v="1" ${p.active ? '' : 'disabled title="Their access is off"'}>▶ Try it</button></span>`;
  const head = topBar('What they see', 'Built live from your settings', `<select id="wtsp" style="height:36px">${team.map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}${roleOf(x) ? ' · ' + esc(roleOf(x).name) : ''}${x.active ? '' : ' (off)'}</option>`).join('')}</select>${seg}<button class="btn ${S.wtsMode === 'phone' ? 'pri' : ''}" data-a="wtsmode" data-v="phone">Phone</button><button class="btn ${S.wtsMode === 'laptop' ? 'pri' : ''}" data-a="wtsmode" data-v="laptop">Laptop</button>${tryOn ? '<button class="btn" data-a="pracreset">↺ Reset practice</button>' : ''}`);
  const screen = !p.active ? `<div class="tw pv">${gateBox(`Hey ${nm}, your access is switched off right now. Talk to Sola.`)}</div>`
    : tryOn ? teamView(S.prac.E, S.prac.st, 'as ' + first(p.name)) : teamView(live, { tab: S.wtsTab || 'home', pick: (p.models || []) }, true);
  const note = tryOn ? `Click anything: it works like on ${nm}’s phone. Nothing you do here is saved.`
    : `${open ? `${nm} is on shift right now: this is their live screen.` : `${nm}’s ${S.wtsTab === 'week' ? 'My week' : 'home'} screen, right now`} · <button class="btn sm" data-a="wtstab" data-v="${S.wtsTab === 'week' ? 'home' : 'week'}">Show ${S.wtsTab === 'week' ? 'Home' : 'My week'}</button>`;
  const seesBox = `<div class="card" style="padding:16px 18px"><div class="lbl" style="margin-bottom:10px">${nm} sees</div><div class="seen">${sees.map((x) => `<div><b class="ok">✓</b>${esc(x)}</div>`).join('')}</div></div>
    <div class="card" style="padding:16px 18px"><div class="lbl" style="margin-bottom:10px">Hidden from ${nm}</div><div class="seen">${hidden.map((x) => `<div><b style="color:var(--ac)">🔒</b>${esc(x)}</div>`).join('')}</div></div>`;
  let right;
  if (tryOn) {
    const D = S.prac.done, pd = O.settings.next_pay_day ? new Date(O.settings.next_pay_day + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : null;
    const usual = (p.models || []).filter((x) => O.models.some((y) => y.name === x));
    const L = [
      ['home', 'Home screen', `“Hey ${first(p.name)}”, ${r ? r.name : 'no role'}, ${pd ? 'next pay day ' + pd : 'no pay day set (Settings)'}. No money anywhere.`, !r ? 'No role yet: give them one in People.' : ''],
      ['pick', 'Picked who they’re covering', O.models.length ? (usual.length ? `${usual.join(', ')} already picked (their usual). Change it if you like, then Clock in.` : 'Nothing pre-picked: set their usual models in People to save them a tap.') : 'No models set yet (Settings), so this step is skipped.', ''],
      ['clockin', `Clock in: ${plural(steps + extra, 'checklist step')}`, steps + extra ? `${steps} from ${r ? r.name : 'the role'}${extra ? ` + ${extra} just for ${first(p.name)}` : ''}.` : '', steps + extra ? '' : `No checklist: add steps to ${r ? r.name : 'their role'} in Departments & roles.`],
      ...(live.brief ? [['brief', `Today’s brief: ${plural(((live.brief.body || {}).accounts || []).length, 'account')}`, 'While clocked in: tick a step, press Day N done or Something stopped me. In practice nothing reaches SA. Management.', ((live.brief.body || {}).accounts || []).length ? '' : 'The brief has no accounts: assign some in SA. Management.']] : []),
      ...(live.team ? [['team', `My team: ${plural(live.team.people.length, 'person')}`, `Open Team (or “My team” on shift): ${SCOPE[live.team.scope].toLowerCase()}, only what you ticked for ${r ? r.name : 'the role'}.`, '']] : []),
      ...(live.accounts.length ? [['accts', `Accounts tab: ${plural(live.accounts.length, 'login')}`, 'Off shift, open Accounts. Their real passwords only show on their phone.', '']] : []),
      ['brk', can ? 'Break works' : 'No Break button', can ? `Breaks are on ${p.breaks_override === true ? 'just for ' + first(p.name) : 'for ' + (r ? r.name + 's' : 'everyone without a role')}. Try it while clocked in.` : `Breaks are off ${p.breaks_override === false ? 'just for ' + first(p.name) : 'for ' + (r ? r.name + 's' : 'them')}, so the button doesn’t show.`, ''],
      ['clockout', 'Clock out', `Unticked steps get a warning${live.handin_form && live.handin_form.ask !== false ? ', the hand-in (' + live.handin_form.fields.length + ' fields)' : ''}, then the handover note.`, ''],
      ['msg', 'Message Sola', 'Off shift: open the Message tab (on shift: 💬 Message Sola) and send one. In practice it goes nowhere.', ''],
      ['week', 'My week', 'After clocking out, open My week: the practice shift shows with its hours and checklist %.', ''],
    ];
    if (!O.models.length) D.pick = true;
    if (!can && D.clockin) D.brk = true;
    const n = L.filter((x) => D[x[0]]).length, next = L.findIndex((x) => !D[x[0]]);
    right = `<div class="card" style="padding:16px 18px"><div class="row" style="margin-bottom:6px"><span class="lbl">Test run for ${nm}</span><span class="sp"></span><span class="mu2" style="font-size:12px" id="pracn">${n} of ${L.length} checked</span></div>
      <div class="tl">${L.map(([k, t, d, warn], i) => `<div data-step="${k}"><i class="${D[k] ? '' : i === next ? 'now' : 'o'}">${D[k] ? '✓' : i + 1}</i><div>${esc(t)}<small>${esc(d)}</small>${warn ? `<small class="warn">${esc(warn)}</small>` : ''}</div></div>`).join('')}</div>
      ${n === L.length ? `<div class="ok" style="font-size:12.5px;font-weight:700;margin-top:8px">All checked: ${nm}’s setup works end to end.</div>` : ''}</div>
      <div class="card" style="padding:14px 18px;display:flex;gap:12px;align-items:center"><div style="font-size:20px">🛠</div><div style="font-size:12.5px;color:var(--mu);line-height:1.5"><b style="color:var(--tx)">Spot something wrong?</b> Fix it in People or Departments &amp; roles, come back, press <b style="color:var(--tx)">Reset practice</b> and run it again. Nothing here touches ${nm}’s real hours.</div></div>
      <details class="card" style="padding:14px 18px"><summary class="lbl" style="cursor:pointer">Sees / hidden from ${nm} · ${sees.length} seen · ${hidden.length} hidden</summary><div class="col" style="gap:14px;margin-top:12px">${seesBox}</div></details>`;
  } else {
    right = `${seesBox}<div class="mu2" style="font-size:12px;line-height:1.55">Change their role, a checklist step or breaks and this updates on the spot. The lock is in the database, not just on screen: their ID only opens their own data, so nothing else can be dug out of the page either. Press <b style="color:var(--tx)">▶ Try it</b> to click through a whole shift as ${nm}.</div>`;
  }
  m.innerHTML = `${head}<div class="body"><div class="wts"><div><div class="${S.wtsMode}" id="pvbox"><div class="scr team" style="position:relative">${tryOn ? '<span class="prac">PRACTICE · NOT SAVED</span>' : ''}${screen}</div></div><div class="pv-note">${note}</div></div>
  <div class="col" style="gap:14px">${right}${!p.last_seen ? `<div class="err" style="color:#fcd34d;background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.3)">${nm} hasn’t signed in yet.</div>` : ''}</div></div></div>`;
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
    ${O.settings.pay_synced ? `<div class="fr"><span>Pay day<small>the team sees only the date</small></span><div><div class="row" style="border:1px solid var(--ln2);border-radius:10px;padding:8px 12px"><span style="flex:1">${esc(O.settings.pay_label)}</span><span class="chip" style="color:#0a0a0a;background:var(--ac)">next: ${esc(payDay(O.settings.next_pay_day))}</span></div><div class="mu2" style="font-size:12px;margin-top:6px">🔗 Synced from SA. Management (Team pay → Pay schedule) · then ${(O.settings.pay_next || []).slice(1).map(payDay).join(', ')}</div></div></div>`
      : `<div class="fr"><span>Next pay day<small>the team sees only the date</small></span><div><input type="date" id="spay" value="${esc(O.settings.next_pay_day || '')}"><div class="mu2" style="font-size:12px;margin-top:6px">Or set a pay schedule in SA. Management (Team pay) and it fills in by itself.</div></div></div>`}
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
  signout: () => { ID.set(''); S.who = { state: 'signed_out', has_owner: true }; S.O = S.E = null; S.pick = null; S.show = []; S.sop = null; gate('signed_out'); },
  copyid: async (v) => { try { await navigator.clipboard.writeText(v); toast('Copied'); } catch { toast(v, 8000); } },
  copymsg: async (v) => { try { await navigator.clipboard.writeText(v); toast('Message copied: paste it in their DMs'); } catch { toast('Couldn’t copy: select the text and copy it', 4000); } },
  recheck: () => boot(),
  claim: () => act(async () => { const c = ($('#ocode') || {}).value || '', n = ($('#oname') || {}).value || ''; if (!n.trim()) throw new Error('Type your name.'); if (!c.trim()) throw new Error('Type the setup code.'); const r = await rpc('t_claim_owner', { p_code: c.trim(), p_name: n.trim() }); ID.set(r.id); S.newOwnerId = r.id; gate('owner_id'); }),
  // team member
  ttab: (v) => { S.tab = v; S.sop = null; teamPage(); },
  sopopen: (v) => { S.sop = v; teamPage(); window.scrollTo(0, 0); },
  sopback: () => { S.sop = null; teamPage(); },
  tmopen: () => { S.tm = true; teamPage(); window.scrollTo(0, 0); },
  tmback: () => { S.tm = false; S.fix = null; teamPage(); },
  fxopen: (v) => { S.fix = v; teamPage(); },
  fxno: () => { S.fix = null; teamPage(); },
  fxsave: (v) => act(async () => { const a = $('#fx-in').value, z = $('#fx-out').value; if (!a || !z) throw new Error('Set both times.'); await call('t_lead_fix_clock', { p_cid: v, p_start: new Date(a).toISOString(), p_end: new Date(z).toISOString() }); S.fix = null; await reTeam(); }, 'Shift fixed'),
  showlog: (v) => { S.show = S.show || []; const k = S.show.indexOf(v); if (k >= 0) S.show.splice(k, 1); else S.show.push(v); teamPage(); },
  copyv: async (v, el) => { try { await navigator.clipboard.writeText(v); toast((el && el.dataset.k === 'password' ? 'Password' : 'Login') + ' copied'); } catch { toast('Couldn’t copy: tap Show and copy it by hand', 4000); } },
  btick: (v) => act(async () => { const [k, i] = v.split('|'), t = (S.E.brief.ticks || {})[k] || {}; S.E.brief.ticks = await call('t_brief_tick', { p_key: k, p_idx: +i, p_done: !t[i] }); teamPage(); }),
  bdone: (v) => act(async () => { const r = await call('t_report', { p_key: v, p_kind: 'done', p_note: null }); S.E.reports = [r, ...(S.E.reports || []).filter((x) => x.id !== r.id)]; teamPage(); toast(`Sent to Sola: ${r.handle || 'account'} done`); }),
  bstuck: (v) => { S.stuck = v; teamPage(); const t = $('#stucknote'); if (t) t.focus(); },
  bstuckno: () => { S.stuck = null; teamPage(); },
  bstucksend: (v) => act(async () => { const note = ($('#stucknote') || {}).value || ''; if (!note.trim()) throw new Error('Say what stopped you.'); const r = await call('t_report', { p_key: v, p_kind: 'stuck', p_note: note.trim() }); S.E.reports = [r, ...(S.E.reports || [])]; S.stuck = null; teamPage(); toast('Sent to Sola'); }),
  msgkind: (v) => { const t = ($('#msgtext') || {}).value; S.mk = v; teamPage(); const x = $('#msgtext'); if (x && t) x.value = t; },
  msgopen: () => { S.msgOpen = true; teamPage(); window.scrollTo(0, 0); const x = $('#msgtext'); if (x) x.focus(); },
  msgclose: () => { S.msgOpen = false; teamPage(); },
  msgsend: () => act(async () => { const t = (($('#msgtext') || {}).value || '').trim(); if (!t) throw new Error('Write something first.'); const m = await call('t_msg_send', { p_kind: S.mk || 'update', p_text: t }); S.E.messages = [m, ...(S.E.messages || [])]; S.msgOpen = false; teamPage(); }, 'Sent to Sola'),
  hlate: () => { S.hl = true; S.hv = null; teamPage(); window.scrollTo(0, 0); },
  hlateno: () => { S.hl = false; teamPage(); },
  hlatesend: () => act(async () => { const v = readHi(S.E.handin_form); if (!v) throw new Error('Fill something in first.'); await call('t_handin_late', { p_cid: S.E.pending_handin.clock_id, p_values: v }); S.hl = false; S.hv = null; await reTeam(); }, 'Hand-in sent'),
  pick: (v) => { const k = S.pick.indexOf(v); if (k >= 0) S.pick.splice(k, 1); else S.pick.push(v); teamPage(); },
  clockin: () => act(async () => { if (S.E.models.length && !S.pick.length) throw new Error('Pick who you’re covering first.'); await call('t_clock_in', { p_models: S.pick }); S.co = false; await reTeam(); }, 'Clocked in. Have a good one'),
  breakstart: () => act(async () => { await call('t_break_toggle'); await reTeam(); }, 'Break started'),
  breakend: () => act(async () => { await call('t_break_toggle'); await reTeam(); }, 'Back on shift'),
  tick: (v) => act(async () => { const open = S.E.clocks.find((c) => !c.ended_at); const now = !open.checklist[+v].done; open.checklist = await call('t_tick', { p_idx: +v, p_done: now }); teamPage(); }),
  costart: () => { S.co = true; S.note = ''; teamPage(); },
  cancelco: () => { S.co = false; teamPage(); },
  clockout: () => act(async () => { const note = ($('#handover') || {}).value || '', f = S.E.handin_form, hv = f && f.ask !== false ? readHi(f) : null;
    if (f && f.required && f.ask !== false && f.fields.length && !hv) throw new Error('Fill in your hand-in first.');
    const c = await call('t_clock_out', { p_handover: note, p_handin: hv }); S.co = false; S.hv = null; S.tab = 'home'; await reTeam(); toast(`Clocked out · ${hm(ms(c.ended_at) - ms(c.started_at) - (c.break_secs || 0) * 1000)} today. Nice work`, 4000); }),
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
  saver: () => act(async () => { const id = $('#red').dataset.id, name = $('#rname').value.trim(); if (!name) throw new Error('Name the role.'); const r = await call('t_save_role', { p_rid: id === 'new' ? null : id, p_name: name, p_dept: $('#rdept').value || null, p_color: $('#xcolor').dataset.v, p_breaks: $('#rbreaks').classList.contains('on'), p_checklist: readSteps('rsteps') });
    if (id !== 'new' && $('#rscope')) { const pw = {}; document.querySelectorAll('#rpowers input').forEach((x) => { if (x.checked) pw[x.dataset.k] = true; }); await call('t_role_authority', { p_rid: r.id, p_scope: $('#rscope').dataset.v, p_powers: pw }); }
    S.rsel = 'r:' + r.id; await reOwner(); }, 'Saved'),
  rscope: (v, el) => { const b = el.closest('#rscope'); b.dataset.v = v; b.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === v)); },
  rwts: (v) => { const p = S.O.people.find((x) => x.role_id === v && !x.is_owner && x.active) || S.O.people.find((x) => x.role_id === v && !x.is_owner); if (!p) return toast('Nobody has this role yet. Give someone the role in People (or SA. Management), then look.', 4500); S.wts = p.id; S.wtsTry = false; setPage('wts'); ownerView(); },
  delr: async () => { const id = $('#red').dataset.id, r = S.O.roles.find((x) => x.id === id), n = S.O.people.filter((p) => p.role_id === id).length; if (!r || !(await ask(`Delete the ${r.name} role?`, n ? `${plural(n, 'person')} will have no role (and no checklist) until you give them one.` : 'Nobody has it.', 'Delete', true))) return; act(async () => { await call('t_remove_role', { p_rid: id }); S.rsel = null; await reOwner(); }, 'Deleted'); },
  closedlg: () => { $('#dlg').innerHTML = ''; },
  // what they see
  wtsmode: (v) => { S.wtsMode = v; paintMain(); },
  sopsel: (v) => { S.sopSel = v; paintMain(); },
  wtstry: (v) => { S.wtsTry = v === '1'; if (S.wtsTry) S.prac = null; paintMain(); },
  pracreset: () => { S.prac = null; paintMain(); toast('Practice reset'); },
  wtstab: (v) => { S.wtsTab = v; paintMain(); },
  // schedule
  wk: (v) => { S.wkOff = +v === 0 ? 0 : (S.wkOff || 0) + +v; paintMain(); },
  shedit: (v) => { const [pid, d] = v.split('|'); shiftDlg(pid, d); },
  rscope2: (v, el) => { const b = el.closest('#shsc'); b.dataset.v = v; b.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === v)); },
  shsave: () => act(async () => { const d = S.shd, a = $('#shs').value, z = $('#she').value; if (!a || !z) throw new Error('Set both times.'); await call('t_shift_save', { p_pid: d.pid, p_date: d.date, p_start: a, p_end: z, p_what: $('#shw').value.trim(), p_scope: $('#shsc').dataset.v }); $('#dlg').innerHTML = ''; await reOwner(); }, 'Shift saved'),
  shdel: () => act(async () => { const d = S.shd; await call('t_shift_remove', { p_pid: d.pid, p_date: d.date, p_scope: $('#shsc').dataset.v }); $('#dlg').innerHTML = ''; await reOwner(); }, 'Removed'),
  tgl: (v, el) => el.classList.toggle('on'),
  schedrules: () => act(async () => { await call('t_sched_rules', { p_rules: { late_min: +$('#slate').value || 10, see_team: $('#sseet').classList.contains('on'), only_shift: $('#sonly').classList.contains('on') }, p_tz: myTz() }); await reOwner(); }, 'Rules saved'),
  // hand-ins
  hall: (v) => { S.hAll = v === '1'; paintMain(); },
  hfadd: () => { readHForm(); S.hDraft.fields.push({ label: '', type: 'number' }); paintMain(); const r = [...document.querySelectorAll('#hfields .hfr input')].pop(); if (r) r.focus(); },
  hfdel: (v) => { readHForm(); S.hDraft.fields.splice(+v, 1); paintMain(); },
  hfsave: () => act(async () => { const f = readHForm(); await call('t_handin_form', { p_rid: f.rid, p_form: { fields: f.fields.filter((x) => x.label), ask: f.ask, required: f.required } }); S.hDraft = null; await reOwner(); }, 'Form saved'),
  hrev: (v) => act(async () => { await call('t_handin_review', { p_hid: v, p_reply: null }); await reOwner(false); }, 'Marked reviewed'),
  hreply: (v) => act(async () => { const t = ($('#hr-' + v) || {}).value || ''; if (!t.trim()) throw new Error('Write a reply.'); await call('t_handin_review', { p_hid: v, p_reply: t.trim() }); await reOwner(false); }, 'Reply sent'),
  // messages
  mall: (v) => { S.mAll = v === '1'; paintMain(); },
  mdone: (v) => act(async () => { const [id, d] = v.split('|'); await call('t_msg_done', { p_mid: id, p_done: d === '1' }); await reOwner(false); }),
  mreply: (v) => act(async () => { const t = ($('#mr-' + v) || {}).value || ''; if (!t.trim()) throw new Error('Write a reply.'); await call('t_msg_reply', { p_mid: v, p_text: t.trim() }); await reOwner(false); }, 'Reply sent'),
  // discord
  dsave: () => act(async () => { const hooks = {}; CHS.forEach(([k]) => { const v = $('#dh-' + k).value.trim(); if (v) hooks[k] = v; }); const ev = {};
    document.querySelectorAll('.evr').forEach((r) => { const k = r.dataset.k, t = r.querySelector('.evt'), mm = r.querySelector('.evm'); ev[k] = { on: r.querySelector('.tg').classList.contains('on'), ch: r.querySelector('.evc').value, ...(t ? { time: t.value } : {}), ...(mm ? { mention: mm.checked } : {}) }; });
    const men = $('#dmen').value.trim(); await call('t_discord_save', { p_hooks: hooks, p_ev: ev, ...(men ? { p_mention: men } : {}) }); await reOwner(); }, 'Saved'),
  dclear: (v) => act(async () => { await call('t_discord_save', { p_hooks: { [v]: '' } }); await reOwner(); }, 'Removed'),
  dtest: (v) => act(async () => { await call('t_discord_test', { p_ch: v }); }, 'Test post sent: check Discord'),
  dpost: () => act(async () => { const t = $('#dann').value.trim(); if (!t) throw new Error('Write the announcement.'); await call('t_announce', { p_text: t, p_everyone: $('#devery').checked }); await reOwner(); }, 'Posted'),
  // settings
  saves: () => act(async () => { const a = { p_team_name: $('#sname').value.trim(), p_tz: myTz() }; if ($('#spay')) a.p_pay_day = $('#spay').value || null; await call('t_save_settings', a); await reOwner(); }, 'Saved'),
  addm: () => act(async () => { const n = $('#newm').value.trim(); if (!n) throw new Error('Type a name.'); if (S.O.models.some((x) => x.name.toLowerCase() === n.toLowerCase())) throw new Error('Already there.'); await call('t_save_model', { p_mid: null, p_name: n }); await reOwner(); }, 'Added'),
  savem: (v) => act(async () => { const n = document.querySelector(`[data-mid="${v}"] input`).value.trim(); if (!n) throw new Error('Type a name.'); await call('t_save_model', { p_mid: v, p_name: n }); await reOwner(); }, 'Saved'),
  delm: async (v) => { const x = S.O.models.find((y) => y.id === v); if (!x || !(await ask(`Remove ${x.name}?`, 'Past shifts keep the name; it just stops being a choice at clock-in.', 'Remove', true))) return; act(async () => { await call('t_remove_model', { p_mid: v }); await reOwner(); }, 'Removed'); },
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  if (el.closest('#pvbox')) { e.preventDefault(); if (S.wtsTry && S.prac && PA[el.dataset.a]) { PA[el.dataset.a](el.dataset.v, el); return paintMain(); } return toast(S.wtsTry ? 'That one only works on their own phone' : 'Preview only: press ▶ Try it to click through it'); }
  const f = A[el.dataset.a]; if (f) { e.preventDefault(); f(el.dataset.v, el); }
});
document.addEventListener('change', (e) => { if (e.target.id === 'wtsp') { S.wts = e.target.value; S.prac = null; paintMain(); } if (e.target.id === 'hrole') { S.hRole = e.target.value; S.hDraft = null; paintMain(); } });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'ocode') A.claim();
  if (e.key === 'Enter' && e.target.id === 'sid') A.signin();
  if (e.key === 'Enter' && e.target.id === 'newm') A.addm();
  if (e.key === 'Enter' && e.target.closest && e.target.closest('.step') && e.target.closest('#pext, #rsteps')) { e.preventDefault(); A.stadd(null, e.target.closest('.steps').querySelector('[data-a="stadd"]')); }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'handover') S.note = e.target.value;
  if (e.target.id === 'msgtext') { const n = $('#msgn'); if (n) n.textContent = e.target.value.length + ' / 280'; }
  if (/^hi-/.test(e.target.id || '') && !e.target.closest('#pvbox')) { const f = S.E && S.E.handin_form; if (f) S.hv = readHi(f) || {}; }
});

// ---- clocks on screen tick every second; the owner's Live floor re-reads every 20s ----
function tick() {
  document.querySelectorAll('[data-t0]').forEach((el) => { const v = Date.now() - +el.dataset.t0 - (+el.dataset.off || 0); el.textContent = el.dataset.fmt === 'hm' ? hm(v) : hms(v); });
}
setInterval(tick, 1000);
setInterval(() => {
  if (!S.who || S.who.state !== 'ok' || S.busy || document.hidden) return;
  if (S.who.owner && (S.page === 'live' || S.page === 'wts') && !typing()) refreshClocks().then(() => { if (!typing()) paintMain(); }).catch(() => {});
}, 20e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.who && S.who.state === 'ok' && !S.busy) (S.who.owner ? refreshClocks().then(paintMain) : loadMe().then(() => { if (!document.activeElement || !['handover', 'stucknote'].includes(document.activeElement.id)) teamPage(); })).catch(() => {}); });
boot();
// Discord bot page actions (after A exists)
Object.assign(A, {
  bsave: () => act(async () => { const dm = {}; document.querySelectorAll('.bdm').forEach((r) => { const k = r.dataset.k, n = r.querySelector('.bdmn'); dm[k] = { on: r.querySelector('.tg').classList.contains('on'), ...(n ? { [k === 'soon' ? 'min' : 'after']: n.value } : {}) }; });
    const pub = $('#bpub').value.trim(); await call('t_bot_save', { p_app_id: $('#bapp').value.trim(), ...(pub ? { p_public_key: pub } : {}), p_dm: dm, p_site: siteUrl() }); S.bpv && (S.bpv.res = null); await reOwner(); }, 'Saved'),
  bcheck: () => act(async () => { S.botChk = await call('t_bot_check'); paintMain(); if (S.botChk.ok && !S.botChk.servers.length) toast('Connected, but the bot isn’t in a server yet: use the invite link (steps file)', 5000); }),
  bcmds: () => act(async () => { const r = await call('t_bot_commands'); if (!r.ok) throw new Error(r.message); S.botChk = { ...S.botChk, commands: r.commands }; paintMain(); }, 'Commands set up: type / in Discord to see them'),
  bpanel: (k) => act(async () => { const sel = $('#bpch-' + k); if (!sel) throw new Error('Press Check first to load your channels.'); const nm = sel.selectedOptions[0].dataset.n;
    const r = await call('t_bot_post_panel', { p_kind: k, p_channel: sel.value, p_channel_name: nm }); if (!r.ok) throw new Error(r.message); S.bpv && (S.bpv.res = null); await reOwner(); if (r.note) toast(r.note, 5000); else toast(r.updated ? 'Panel refreshed' : 'Panel posted and pinned'); }),
  broutes: () => act(async () => { const route = {}, on = {}; document.querySelectorAll('.broute').forEach((x) => { route[x.dataset.k] = x.querySelector('.brch').value; on[x.dataset.k] = x.querySelector('.tg').classList.contains('on'); }); await call('t_bot_save', { p_route: route, p_on: on }); await reOwner(); }, 'Saved'),
  bcleansave: () => act(async () => { const c = {}; document.querySelectorAll('.bclean tr[data-ch]').forEach((x) => { c[x.dataset.ch] = { days: +x.querySelector('.bcd').value, what: x.querySelector('.bcw').value }; }); await call('t_bot_save', { p_clean: c }); await reOwner(); }, 'Saved'),
  bcleannow: (v) => act(async () => { const r = await call('t_bot_clean_now', { p_channel: v }); if (!r.ok) throw new Error(r.message); await reOwner(); toast(`Cleared ${r.n} post${r.n === 1 ? '' : 's'}`); }),
  bpvch: (v) => { S.bpv.ch = v; S.bpv.res = S.bpv.res ? { ...S.bpv.res, reply: null } : null; paintMain(); },
  bwhere: (v) => act(async () => { await call('t_bot_save', { p_where: v }); await reOwner(); }, 'Saved'),
  bcode: (v) => act(async () => { const p = S.O.people.find((x) => x.id === v), c = await call('t_bot_code', { p_pid: v }); await reOwner(); codeDlg(p, c); }),
  bcmcopy: async () => { try { await navigator.clipboard.writeText($('#bcmsg').value); toast('Copied'); } catch { $('#bcmsg').select(); } },
  bunlink: async (v) => { const p = S.O.people.find((x) => x.id === v); if (!(await ask(`Unlink ${first(p.name)}’s Discord?`, 'Their Discord buttons stop working until you give them a new code. Their records stay.', 'Unlink', true))) return; act(async () => { await call('t_bot_unlink', { p_pid: v }); await reOwner(); }, 'Unlinked'); },
  bcopyurl: async () => { try { await navigator.clipboard.writeText(dcUrl()); toast('Copied: paste it into Interactions Endpoint URL'); } catch { toast(dcUrl(), 6000); } },
  bpv: (v) => bpvRun({ id: v }),
  bpvlink: () => toast('That opens SA. Team in their browser'),
  bpvsub: (v) => { const vals = {}; document.querySelectorAll('.dcmod [data-k]').forEach((x) => { vals[x.dataset.k] = x.value; }); bpvRun({ id: v, vals }); },
  bpvx: () => { S.bpv.res = { ...S.bpv.res, reply: null }; paintMain(); },
  bpvreset: () => { S.bpv.steps = []; S.bpv.res = null; paintMain(); },
});
document.addEventListener('change', (e) => { if (e.target.id === 'bpvp') { S.bpv = { pid: e.target.value, steps: [], res: null, ch: (S.bpv || {}).ch || 'clk' }; paintMain(); } });
