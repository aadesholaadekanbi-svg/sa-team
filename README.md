# SA. Team

The online office for the SA. team: clock in and out from a link pinned in Discord, breaks, shift checklists,
and a live floor for the owner. Phase 1 of 4 (schedule + Discord posts, hand-ins + SOPs, and pay come next).

- `index.html`, `app.js`, `style.css`: the whole site (no build step). GitHub Pages serves it as it is.
- `config.js`: the database address and its public key. Both are meant to be public; who can read or change
  what is enforced inside the database, per person.
- `vendor/supabase.js`: the Supabase client (v2.45.4), kept here so the site doesn't depend on another CDN.
- `.github/workflows/keep-alive.yml`: a daily ping so the free database never pauses.

Team members never see pay, rates, commission or anyone else's data. The owner sees everything, plus
"What they see": any team member's screen, live.
