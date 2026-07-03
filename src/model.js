// Shared helpers + the card shape used everywhere.
export const uid = () => "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
export const nowISO = () => new Date().toISOString();

export function normalizeCard(c = {}) {
  return {
    id: c.id || uid(),
    title: c.title || "Untitled idea",
    description: c.description || "",
    category: c.category || "Chill",
    timeEstimate: c.timeEstimate || "1 hour",
    costLevel: c.costLevel || "Cheap",
    energyLevel: c.energyLevel || "Low",
    location: c.location || "",
    appealTo: c.appealTo || "",
    starterVersion: c.starterVersion || "",
    goal: c.goal || "",
    status: c.status || "Ideas",
    reactions: { randy: null, pearl: null, forrest: null, tricia: null, ...(c.reactions || {}) },
    comments: Array.isArray(c.comments) ? c.comments : [],
    memoryNote: c.memoryNote || "",
    wouldDoAgain: c.wouldDoAgain ?? null,
    createdAt: c.createdAt || nowISO(),
    updatedAt: c.updatedAt || nowISO(),
  };
}
