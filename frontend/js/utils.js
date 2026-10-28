// Funções utilitárias: escape de HTML, avisos e formatação de datas, notas e horas.

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

export function toast(message, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

export function formatRating(rating) {
  return rating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Cinco estrelas preenchidas na proporção exata da nota, seguidas do valor (ex.: 4,5). */
export function stars(rating, { number = true } = {}) {
  if (rating == null) return "";
  return `<span class="rating" title="${formatRating(rating)} de 5">
    <span class="stars-bar" style="--fill:${(rating / 5) * 100}%" aria-hidden="true">★★★★★</span>${number ? `<span class="rating-value">${formatRating(rating)}</span>` : ""}
  </span>`;
}

export function formatDate(iso, opts = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "";
  const date = iso.length === 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  return date.toLocaleDateString("pt-BR", opts);
}

export function timeAgo(iso) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "agora";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`;
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)} d`;
  return formatDate(iso, { day: "numeric", month: "short" });
}

/** Resenhas compridas aparecem cortadas, com "Ler mais". */
export function isLong(text) {
  return text.length > 420 || text.split("\n").length > 7;
}

export function formatHours(hours) {
  // arredonda para a meia hora mais próxima, como o próprio HowLongToBeat
  const half = Math.round(hours * 2) / 2;
  return `${Math.floor(half)}${half % 1 ? "½" : ""} h`;
}

export function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function dayLabel(iso) {
  const today = todayIso();
  const yesterday = new Date(Date.parse(today + "T12:00:00") - 86400000).toISOString().slice(0, 10);
  if (iso === today) return "Hoje";
  if (iso === yesterday) return "Ontem";
  return formatDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
