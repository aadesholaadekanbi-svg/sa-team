# SA. Team

The online office for the SA. team: clock in and out from a link pinned in Discord, breaks, shift checklists, a schedule,
end-of-shift hand-ins, short messages to Sola, Discord posts, and a live floor for the owner.

- `index.html`, `app.js`, `style.css`, `shared.js`: the whole site (no build step). GitHub Pages serves it as it is.
- `config.js`: the address of the SA. Team server (a Cloudflare Worker). Public on purpose: who can read or change
  what is enforced inside the Worker, per person.

Team members never see pay, rates, commission or anyone else's data. The owner sees everything, plus
"What they see": any team member's screen, live.
