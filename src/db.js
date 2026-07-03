import { supabase } from "./supabase.js";
import { RAW_SEED } from "./seed.js";
import { normalizeCard } from "./model.js";

// One row per card: { id text pk, data jsonb, created_at, updated_at }.
// Per-row storage means two people reacting to different cards never clash.

export async function fetchBoard() {
  const { data, error } = await supabase
    .from("cards")
    .select("data, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(r => normalizeCard(r.data));
}

export async function saveCard(card) {
  const { error } = await supabase
    .from("cards")
    .upsert({ id: card.id, data: card, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function deleteCard(id) {
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

async function deleteAll() {
  const { error } = await supabase.from("cards").delete().neq("id", "__none__");
  if (error) throw new Error(error.message);
}

function seedRows() {
  const base = Date.now();
  return RAW_SEED.map((c, i) => {
    const created = new Date(base - i * 1000).toISOString();
    const card = normalizeCard({ ...c, createdAt: created });
    return { id: card.id, data: card, created_at: created };
  });
}

export async function seedIfEmpty() {
  const { count, error } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  if ((count || 0) === 0) {
    const { error: e2 } = await supabase.from("cards").insert(seedRows());
    if (e2) throw new Error(e2.message);
  }
}

export async function replaceAll(cards) {
  await deleteAll();
  if (cards.length) {
    const rows = cards.map(c => ({ id: c.id, data: c }));
    const { error } = await supabase.from("cards").insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function resetBoard() {
  await deleteAll();
  const { error } = await supabase.from("cards").insert(seedRows());
  if (error) throw new Error(error.message);
}
