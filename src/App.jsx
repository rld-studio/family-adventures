import { useState, useEffect, useMemo, useRef } from "react";
import { supabaseConfigured } from "./supabase.js";
import { fetchBoard, saveCard as dbSaveCard, deleteCard as dbDeleteCard, replaceAll as dbReplaceAll, resetBoard as dbResetBoard, seedIfEmpty } from "./db.js";
import { normalizeCard, uid, nowISO } from "./model.js";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const CACHE_KEY = "familyBoard.cache.v1";
const PERSON_KEY = "familyBoard.person";
const AUTH_KEY = "familyBoard.auth";
const BOARD_PASSWORD = import.meta.env.VITE_BOARD_PASSWORD || "familyfun";

const LANES = [
  { id: "Ideas",      label: "Ideas",          color: "#8A8578" },
  { id: "This Week",  label: "This Week",       color: "#2E6E5A" },
  { id: "This Month", label: "This Month",      color: "#EAB13C" },
  { id: "Someday",    label: "Someday",         color: "#7D5BA6" },
  { id: "Done",       label: "Done / Memories", color: "#C4695E" },
];

const PEOPLE = [
  { id: "randy",   label: "Randy",   cls: "randy",   dot: "#2E6E5A" },
  { id: "pearl",   label: "Pearl",   cls: "pearl",   dot: "#7D5BA6" },
  { id: "forrest", label: "Forrest", cls: "forrest", dot: "#C4695E" },
  { id: "tricia",  label: "Tricia",  cls: "tricia",  dot: "#EAB13C" },
];

const REACTIONS = [
  { id: "in",        label: "I'm in",    color: "#2E6E5A" },
  { id: "maybe",     label: "Maybe",     color: "#EAB13C" },
  { id: "not_now",   label: "Not now",   color: "#8A8578" },
  { id: "hard_pass", label: "Hard pass", color: "#C4695E" },
  { id: "my_idea",   label: "My idea",   color: "#7D5BA6" },
];
const RX_MAP = Object.fromEntries(REACTIONS.map(r => [r.id, r]));
const QUICK = ["in", "maybe", "not_now", "hard_pass"];

const CATEGORIES = ["Chill","Games","Board Games","Video Games","Card Games","Adventure","Creative",
  "Collecting","Make Money","Life Skill","Future / College","Food / Coffee","Travel","Sports",
  "House / Organizing","Music / Culture","Local Atlanta","Big Dream"];
const TIMES = ["15 minutes","30 minutes","1 hour","2 hours","Half day","Full day","Weekend","Big trip"];
const COSTS = ["Free","Cheap","Moderate","Expensive","Big trip"];
const ENERGIES = ["Low","Medium","High"];

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */
function useMediaQuery(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = e => setMatch(e.matches);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on));
  }, [query]);
  return match;
}

function Avatar({ person }) {
  const p = PEOPLE.find(x => x.id === person);
  return <div className={"avatar av-" + p.cls}>{p.label[0]}</div>;
}

function WhoRow({ card }) {
  return (
    <div className="who-row">
      {PEOPLE.map(p => {
        const rx = card.reactions[p.id];
        const info = rx ? RX_MAP[rx] : null;
        return (
          <div className="who-chip" key={p.id} title={p.label + (info ? " · " + info.label : " · no reaction yet")}>
            <Avatar person={p.id} />
            {info
              ? <span className="rx" style={{ color: info.color }}>{info.label}</span>
              : <span className="rx" style={{ color: "var(--ink-faint)" }}>—</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */
function Card({ card, person, onQuickReact, onMove, onOpen, onDelete, onMemory, onAgain }) {
  const inCount = PEOPLE.filter(p => card.reactions[p.id] === "in").length;
  const lit = inCount >= 2;
  const isDone = card.status === "Done";

  return (
    <div className={"card" + (lit ? " lit" : "")}>
      <div className="card-body">
        <span className="card-cat">{card.category}</span>
        <h3>{card.title}</h3>
        {card.description && <p className="card-desc">{card.description}</p>}

        <div className="meta">
          <span>{card.timeEstimate}</span>
          <span>{card.costLevel}</span>
          <span>{card.energyLevel} energy</span>
          {card.location && <span>{card.location}</span>}
        </div>

        {card.starterVersion && (
          <div className="starter">
            <b>Tiny start</b>
            {card.starterVersion}
          </div>
        )}

        <WhoRow card={card} />

        <div className="qr">
          {QUICK.map(rx => (
            <button key={rx} data-rx={rx} data-on={card.reactions[person] === rx}
              onClick={() => onQuickReact(card.id, person, rx)}>
              {RX_MAP[rx].label}
            </button>
          ))}
        </div>
        <div className="qr-hint">Tapping reacts as <b>{PEOPLE.find(p => p.id === person).label}</b>. Open the card for notes and "My idea".</div>

        {isDone && (
          <div className="memory">
            <label>Memory note</label>
            <textarea placeholder="One line about how it went…" defaultValue={card.memoryNote}
              onBlur={e => e.target.value !== card.memoryNote && onMemory(card.id, e.target.value)} />
            <div className="again">
              Would do again?
              <button data-on={card.wouldDoAgain === true} onClick={() => onAgain(card.id, card.wouldDoAgain === true ? null : true)}>Yes</button>
              <button data-on={card.wouldDoAgain === false} onClick={() => onAgain(card.id, card.wouldDoAgain === false ? null : false)}>Nah</button>
            </div>
          </div>
        )}
      </div>

      <div className="card-foot">
        <div className="move-wrap">
          <select value={card.status} onChange={e => onMove(card.id, e.target.value)} aria-label="Move card to lane">
            {LANES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
        {card.comments.length > 0 && <span className="comment-count">{card.comments.length} note{card.comments.length > 1 ? "s" : ""}</span>}
        <button className="icon-btn" title="Open / edit" onClick={() => onOpen(card.id)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
        </button>
        <button className="icon-btn danger" title="Delete" onClick={() => onDelete(card.id)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card editor modal                                                  */
/* ------------------------------------------------------------------ */
function CardModal({ initial, person, onSave, onClose, onDelete }) {
  const isNew = !initial.id;
  const [c, setC] = useState(() => normalizeCard(initial));
  const [commentText, setCommentText] = useState("");
  const set = (k, v) => setC(prev => ({ ...prev, [k]: v }));

  const setReaction = (pid, rx) =>
    setC(prev => ({ ...prev, reactions: { ...prev.reactions, [pid]: prev.reactions[pid] === rx ? null : rx } }));

  const addComment = () => {
    const t = commentText.trim();
    if (!t) return;
    setC(prev => ({ ...prev, comments: [...prev.comments, { id: uid(), author: person, text: t, at: nowISO() }] }));
    setCommentText("");
  };
  const delComment = id => setC(prev => ({ ...prev, comments: prev.comments.filter(x => x.id !== id) }));

  const save = () => onSave({ ...c, title: c.title.trim() || "Untitled idea", updatedAt: nowISO() }, isNew);

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isNew ? "New idea" : "Edit idea"}</h2>
          <button className="icon-btn" onClick={onClose} title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Title</label>
            <input value={c.title} onChange={e => set("title", e.target.value)} placeholder="What's the idea?" autoFocus={isNew} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea value={c.description} onChange={e => set("description", e.target.value)} placeholder="A sentence or two, nothing formal." />
          </div>
          <div className="field">
            <label>Tiny start</label>
            <textarea value={c.starterVersion} onChange={e => set("starterVersion", e.target.value)} placeholder="The smallest, easiest version of this." />
            <div className="hint">Every big idea gets a low-effort starter so it feels less like a whole thing.</div>
          </div>

          <div className="grid2">
            <div className="field">
              <label>Category</label>
              <select value={c.category} onChange={e => set("category", e.target.value)}>
                {CATEGORIES.map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Lane</label>
              <select value={c.status} onChange={e => set("status", e.target.value)}>
                {LANES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid3">
            <div className="field">
              <label>Time</label>
              <select value={c.timeEstimate} onChange={e => set("timeEstimate", e.target.value)}>
                {TIMES.map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Cost</label>
              <select value={c.costLevel} onChange={e => set("costLevel", e.target.value)}>
                {COSTS.map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Energy</label>
              <select value={c.energyLevel} onChange={e => set("energyLevel", e.target.value)}>
                {ENERGIES.map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
          </div>

          <div className="grid2">
            <div className="field">
              <label>Location / area</label>
              <input value={c.location} onChange={e => set("location", e.target.value)} placeholder="Home, Atlanta, North GA…" />
            </div>
            <div className="field">
              <label>Who it might appeal to</label>
              <input value={c.appealTo} onChange={e => set("appealTo", e.target.value)} placeholder="Everyone, Son, Dad + Daughter…" />
            </div>
          </div>

          <div className="field">
            <label>Goal or purpose (optional)</label>
            <input value={c.goal} onChange={e => set("goal", e.target.value)} placeholder="Why it might be worth it." />
          </div>

          <div className="rx-block">
            {PEOPLE.map(p => {
              const isMe = p.id === person;
              return (
                <div key={p.id}>
                  <div className="rx-person">
                    <Avatar person={p.id} />
                    <span className="name">{p.label}{isMe ? " (you)" : ""}</span>
                  </div>
                  <div className="rx-opts">
                    {REACTIONS.map(r => (
                      <button key={r.id} data-rx={r.id} data-on={c.reactions[p.id] === r.id}
                        disabled={!isMe}
                        onClick={() => isMe && setReaction(p.id, r.id)}>{r.label}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="comments">
            <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--ink-soft)" }}>Notes</label>
            {c.comments.length === 0 && <div className="hint" style={{ marginTop: 6 }}>No notes yet.</div>}
            {c.comments.map(cm => (
              <div className="comment" key={cm.id}>
                <button className="c-del" onClick={() => delComment(cm.id)}>remove</button>
                <span className="c-who" style={{ color: PEOPLE.find(p => p.id === cm.author)?.dot }}>
                  {PEOPLE.find(p => p.id === cm.author)?.label || "Someone"}
                </span>
                {cm.text}
              </div>
            ))}
            <div className="add-comment">
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addComment()}
                placeholder={"Add a note as " + PEOPLE.find(p => p.id === person).label + "…"} />
              <button className="btn btn-ghost" onClick={addComment}>Add</button>
            </div>
          </div>

          {c.status === "Done" && (
            <div className="field">
              <label>Memory note</label>
              <textarea value={c.memoryNote} onChange={e => set("memoryNote", e.target.value)} placeholder="How did it go?" />
            </div>
          )}
        </div>

        <div className="modal-foot">
          {!isNew && <button className="icon-btn danger" title="Delete" onClick={() => onDelete(c.id)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>}
          <div className="spacer" />
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>{isNew ? "Add idea" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Login screen                                                       */
/* ------------------------------------------------------------------ */
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [who, setWho] = useState("");
  const [err, setErr] = useState("");

  const submit = e => {
    e.preventDefault();
    if (!who) { setErr("Pick who you are"); return; }
    if (pw !== BOARD_PASSWORD) { setErr("Wrong password"); return; }
    localStorage.setItem(AUTH_KEY, "yes");
    localStorage.setItem(PERSON_KEY, who);
    onLogin(who);
  };

  return (
    <div className="app">
      <div className="screen">
        <form onSubmit={submit} className="login-form">
          <h2>The Family Board</h2>
          <p>Pick who you are and enter the family password.</p>
          <div className="login-people">
            {PEOPLE.map(p => (
              <button type="button" key={p.id} className={"login-person" + (who === p.id ? " active" : "")}
                data-who={p.id} onClick={() => { setWho(p.id); setErr(""); }}>
                <div className={"avatar av-" + p.cls}>{p.label[0]}</div>
                {p.label}
              </button>
            ))}
          </div>
          <input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(""); }}
            placeholder="Family password" className="login-pw" autoFocus />
          {err && <div className="login-err">{err}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Enter</button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */
export default function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem(AUTH_KEY) === "yes");
  const [cards, setCards] = useState(() => {
    try { const c = JSON.parse(localStorage.getItem(CACHE_KEY)); return Array.isArray(c) ? c : null; }
    catch { return null; }
  });
  const [phase, setPhase] = useState(() => (!supabaseConfigured ? "config" : cards ? "ready" : "loading"));
  const [errMsg, setErrMsg] = useState("");
  const [sync, setSync] = useState("ok"); // ok | saving | error

  const [person, setPerson] = useState(() => localStorage.getItem(PERSON_KEY) || "randy");
  const [filters, setFilters] = useState({ q: "", category: "", time: "", cost: "", energy: "", status: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [activeLane, setActiveLane] = useState("Ideas");
  const [editing, setEditing] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef(null);
  const writing = useRef(false);
  const isDesktop = useMediaQuery("(min-width: 821px)");

  const applyServer = next => {
    setCards(next);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
  };
  const cache = next => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {} };

  const load = async () => {
    try {
      await seedIfEmpty();
      applyServer(await fetchBoard());
      setPhase("ready"); setSync("ok");
    } catch (e) {
      if (cards) { setPhase("ready"); setSync("error"); }
      else { setPhase("error"); setErrMsg(e.message); }
    }
  };
  useEffect(() => { if (supabaseConfigured) load(); /* eslint-disable-next-line */ }, []);

  // background sync
  useEffect(() => {
    if (!supabaseConfigured) return;
    const t = setInterval(async () => {
      if (writing.current || document.hidden || editing) return;
      try { applyServer(await fetchBoard()); setSync("ok"); } catch { setSync("error"); }
    }, 6000);
    return () => clearInterval(t);
  }, [editing]);

  useEffect(() => { localStorage.setItem(PERSON_KEY, person); }, [person]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const close = () => setMenuOpen(false);
    if (menuOpen) { window.addEventListener("click", close); return () => window.removeEventListener("click", close); }
  }, [menuOpen]);

  // optimistic local update + a Supabase write
  const run = async (optimistic, write) => {
    writing.current = true;
    setSync("saving");
    setCards(prev => { const next = optimistic(prev); cache(next); return next; });
    try { await write(); setSync("ok"); }
    catch (e) { setSync("error"); setToast("Couldn't sync — will retry"); }
    finally { writing.current = false; }
  };

  /* mutations */
  const quickReact = (id, pid, rx) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const next = card.reactions[pid] === rx ? null : rx;
    const updated = { ...card, reactions: { ...card.reactions, [pid]: next }, updatedAt: nowISO() };
    run(prev => prev.map(c => (c.id === id ? updated : c)), () => dbSaveCard(updated));
  };
  const patchCard = (id, changes) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const updated = { ...card, ...changes, updatedAt: nowISO() };
    run(prev => prev.map(c => (c.id === id ? updated : c)), () => dbSaveCard(updated));
  };
  const move = (id, status) => patchCard(id, { status });
  const setMemory = (id, memoryNote) => patchCard(id, { memoryNote });
  const setAgain = (id, wouldDoAgain) => patchCard(id, { wouldDoAgain });

  const remove = id => {
    if (!window.confirm("Delete this card? This can't be undone.")) return;
    run(prev => prev.filter(c => c.id !== id), () => dbDeleteCard(id));
    setEditing(null);
    setToast("Card deleted");
  };

  const saveCard = (card, isNew) => {
    const full = normalizeCard(card);
    run(prev => (prev.some(c => c.id === full.id) ? prev.map(c => (c.id === full.id ? full : c)) : [full, ...prev]),
      () => dbSaveCard(full));
    setEditing(null);
    setToast(isNew ? "Idea added" : "Saved");
  };

  const openNew = status => setEditing({ status: status || "Ideas" });
  const openEdit = id => setEditing(cards.find(c => c.id === id) || null);

  /* export / import / reset */
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(cards, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "family-board-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click(); URL.revokeObjectURL(url);
    setMenuOpen(false); setToast("Exported JSON");
  };
  const importJSON = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error("bad");
        if (!window.confirm("Replace the shared board with this file? (" + data.length + " cards)")) return;
        const norm = data.map(normalizeCard);
        writing.current = true; setSync("saving"); applyServer(norm);
        try { await dbReplaceAll(norm); applyServer(await fetchBoard()); setSync("ok"); setToast("Imported " + data.length + " cards"); }
        catch { setSync("error"); setToast("Import failed"); }
        finally { writing.current = false; }
      } catch { setToast("That file didn't look right"); }
    };
    reader.readAsText(file);
    e.target.value = "";
    setMenuOpen(false);
  };
  const resetBoard = async () => {
    if (!window.confirm("Reset the shared board back to the starter ideas? Everyone's changes will be lost.")) return;
    setMenuOpen(false);
    writing.current = true; setSync("saving");
    try { await dbResetBoard(); applyServer(await fetchBoard()); setSync("ok"); setToast("Board reset to starter ideas"); }
    catch { setSync("error"); setToast("Reset failed"); }
    finally { writing.current = false; }
  };

  /* filtering */
  const matches = c => {
    const q = filters.q.trim().toLowerCase();
    if (q) {
      const hay = (c.title + " " + c.description + " " + c.starterVersion + " " + c.location + " " + c.appealTo + " " + c.category).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.category && c.category !== filters.category) return false;
    if (filters.time && c.timeEstimate !== filters.time) return false;
    if (filters.cost && c.costLevel !== filters.cost) return false;
    if (filters.energy && c.energyLevel !== filters.energy) return false;
    if (filters.status && c.status !== filters.status) return false;
    return true;
  };
  const visible = useMemo(() => (cards || []).filter(matches), [cards, filters]);
  const byLane = useMemo(() => {
    const m = {}; LANES.forEach(l => (m[l.id] = []));
    visible.forEach(c => (m[c.status] || (m[c.status] = [])).push(c));
    return m;
  }, [visible]);

  const lanesToShow = filters.status ? LANES.filter(l => l.id === filters.status) : LANES;
  const filtersActive = filters.category || filters.time || filters.cost || filters.energy || filters.status;

  useEffect(() => {
    if (!lanesToShow.some(l => l.id === activeLane)) setActiveLane(lanesToShow[0].id);
  }, [filters.status]); // eslint-disable-line

  const emptyText = {
    "Ideas": "Nothing here yet. Add an idea whenever one shows up.",
    "This Week": "Nothing set for this week. Move over anything that got a Maybe or an I'm in.",
    "This Month": "Open for now. Park bigger ideas here when they feel worth it.",
    "Someday": "The someday pile. Big trips and long shots live here, no rush.",
    "Done": "Nothing done yet. When you try something, drop it here and jot a line about it.",
  };

  const clearFilters = () => setFilters({ q: "", category: "", time: "", cost: "", energy: "", status: "" });

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(PERSON_KEY);
    setAuthed(false);
  };

  if (!authed) return <LoginScreen onLogin={who => { setPerson(who); setAuthed(true); }} />;

  /* ---- setup / loading / error screens ---- */
  if (phase === "config") {
    return (
      <div className="app"><div className="screen"><div>
        <h2>Almost there</h2>
        <p>This board needs your Supabase project to sync. Add two values and redeploy:</p>
        <p><code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code></p>
        <p>They're in your Supabase project under Settings → API. The README has the full walkthrough.</p>
      </div></div></div>
    );
  }
  if (phase === "loading") {
    return <div className="app"><div className="screen"><div><div className="spinner" /><p>Loading the board…</p></div></div></div>;
  }
  if (phase === "error") {
    return (
      <div className="app"><div className="screen"><div>
        <h2>Can't reach the board</h2>
        <p>{errMsg}</p>
        <p>Check that the <code>cards</code> table exists and its access policy is set (see the README's SQL).</p>
        <button className="btn btn-primary" onClick={() => { setPhase("loading"); load(); }}>Try again</button>
      </div></div></div>
    );
  }

  const syncLabel = { ok: "Synced", saving: "Saving…", error: "Offline" }[sync];

  const renderLane = lane => {
    const list = byLane[lane.id] || [];
    return (
      <div className={"lane" + (!isDesktop && activeLane === lane.id ? " active" : "")} key={lane.id}>
        {isDesktop && (
          <div className="lane-head">
            <span className="lane-swatch" style={{ background: lane.color }} />
            <h2>{lane.label}</h2>
            <span className="lane-count">{list.length}</span>
            <button className="lane-add" title={"Add to " + lane.label} onClick={() => openNew(lane.id)}>+</button>
          </div>
        )}
        <div className="lane-body">
          {list.length === 0
            ? <div className="empty">{emptyText[lane.id]}</div>
            : list.map(card => (
                <Card key={card.id} card={card} person={person}
                  onQuickReact={quickReact} onMove={move} onOpen={openEdit}
                  onDelete={remove} onMemory={setMemory} onAgain={setAgain} />
              ))}
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-row">
          <div className="brand">
            <h1>The Family <span className="mark">Board</span></h1>
            <p>“What sounds even slightly worth trying?”</p>
          </div>

          <div className="whois">
            <div className="seg">
              <button data-who={person} data-on="true" style={{ cursor: "default" }}>
                <span className="who-dot" style={{ background: "#fff" }} />
                {PEOPLE.find(p => p.id === person)?.label}
              </button>
            </div>
            <button className="btn-logout" onClick={logout} title="Log out">Log out</button>
          </div>

          <div className="sync-pill" data-state={sync} title="This board is shared with the whole family">
            <span className="dot" />{syncLabel}
          </div>

          <button className="btn btn-primary" onClick={() => openNew("Ideas")}>
            <span className="btn-plus">+</span> Add idea
          </button>

          <div className="menu-wrap" onClick={e => e.stopPropagation()}>
            <button className="btn btn-ghost" onClick={() => setMenuOpen(o => !o)} aria-label="Board menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
            </button>
            {menuOpen && (
              <div className="menu">
                <button onClick={exportJSON}>Export board (JSON)</button>
                <button onClick={() => fileRef.current.click()}>Import board (JSON)</button>
                <div className="menu-sep" />
                <button className="danger" onClick={resetBoard}>Reset to starter ideas</button>
                <div className="menu-sep" />
                <div className="legend">
                  {REACTIONS.map(r => (
                    <div className="lg" key={r.id}><span className="d" style={{ background: r.color }} />{r.label}</div>
                  ))}
                </div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={importJSON} />
          </div>
        </div>

        <div className="toolbar">
          <div className="search">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} placeholder="Search ideas…" />
          </div>

          <button className="btn btn-ghost filter-toggle" onClick={() => setShowFilters(s => !s)}>
            Filters{filtersActive ? " •" : ""}
          </button>

          <div className={"filters" + (showFilters ? " open" : "")}>
            <select data-active={!!filters.category} value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
              <option value="">All categories</option>
              {CATEGORIES.map(x => <option key={x}>{x}</option>)}
            </select>
            <select data-active={!!filters.time} value={filters.time} onChange={e => setFilters(f => ({ ...f, time: e.target.value }))}>
              <option value="">Any time</option>
              {TIMES.map(x => <option key={x}>{x}</option>)}
            </select>
            <select data-active={!!filters.cost} value={filters.cost} onChange={e => setFilters(f => ({ ...f, cost: e.target.value }))}>
              <option value="">Any cost</option>
              {COSTS.map(x => <option key={x}>{x}</option>)}
            </select>
            <select data-active={!!filters.energy} value={filters.energy} onChange={e => setFilters(f => ({ ...f, energy: e.target.value }))}>
              <option value="">Any energy</option>
              {ENERGIES.map(x => <option key={x}>{x} energy</option>)}
            </select>
            <select data-active={!!filters.status} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All lanes</option>
              {LANES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            {(filtersActive || filters.q) && <button className="link-clear" onClick={clearFilters}>Clear</button>}
          </div>
        </div>
      </div>

      {!isDesktop && (
        <div className="tabs">
          {lanesToShow.map(l => (
            <button key={l.id} className="tab" data-on={activeLane === l.id} onClick={() => setActiveLane(l.id)}>
              <span className="t-dot" style={{ background: l.color }} />
              {l.label}
              <span className="t-count">{(byLane[l.id] || []).length}</span>
            </button>
          ))}
        </div>
      )}

      {!isDesktop && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button className="btn btn-ghost" onClick={() => openNew(activeLane)}>
            <span className="btn-plus">+</span> Add to {LANES.find(l => l.id === activeLane)?.label}
          </button>
        </div>
      )}

      <div className="board">{lanesToShow.map(renderLane)}</div>

      {editing && (
        <CardModal initial={editing} person={person} onSave={saveCard} onClose={() => setEditing(null)} onDelete={remove} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
