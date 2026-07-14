/**
 * Composant de pagination moderne et pro.
 */
import { useEffect, useState } from "react";

/* ── Hook ─────────────────────────────────────────────────────── */
export function usePagination(items = [], pageSize = 10) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [items.length]);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage   = Math.min(page, totalPages - 1);
  const pageItems  = items.slice(safePage * pageSize, safePage * pageSize + pageSize);
  return { page: safePage, setPage, pageItems, totalPages, total: items.length };
}

/* ── UI Component ─────────────────────────────────────────────── */
export default function Pagination({ page, totalPages, onChange, totalItems, pageSize, small = false }) {
  if (totalPages <= 1) return null;

  const pages   = buildPages(page, totalPages);
  const from    = page * (pageSize || 15) + 1;
  const to      = Math.min((page + 1) * (pageSize || 15), totalItems || totalPages * (pageSize || 15));

  return (
    <div style={styles.wrap}>
      {totalItems && (
        <span style={styles.info}>
          <span style={styles.infoRange}>{from}–{to}</span>
          <span style={styles.infoTotal}> sur {totalItems}</span>
        </span>
      )}
      <div style={styles.controls}>
        <NavBtn
          label={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15,18 9,12 15,6"/></svg>}
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          title="Page précédente"
        />
        <div style={styles.pages}>
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={"dot-"+i} style={styles.dots}>···</span>
            ) : (
              <PageBtn key={p} label={String(p + 1)} active={p === page} onClick={() => onChange(p)} small={small} />
            )
          )}
        </div>
        <NavBtn
          label={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>}
          disabled={page === totalPages - 1}
          onClick={() => onChange(page + 1)}
          title="Page suivante"
        />
      </div>
    </div>
  );
}

function PageBtn({ label, active, onClick, small }) {
  const size = small ? 28 : 34;
  return (
    <button
      onClick={onClick}
      className={"pag-btn" + (active ? " pag-active" : "")}
      style={{
        width: size, height: size, borderRadius: 8,
        border: active ? "none" : "1.5px solid var(--bd-1)",
        background: active ? "var(--grd-h)" : "var(--bg-1)",
        color: active ? "#fff" : "var(--tx-2)",
        fontWeight: active ? 700 : 500,
        fontSize: small ? 12 : 13,
        cursor: "pointer", fontFamily: "var(--fb)",
        transition: "all .15s", flexShrink: 0, lineHeight: 1,
        boxShadow: active ? "var(--sh-blue)" : "none",
        transform: active ? "translateY(-1px)" : "none",
      }}
    >
      {label}
    </button>
  );
}

function NavBtn({ label, disabled, onClick, title }) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      style={{
        width: 34, height: 34, borderRadius: 8,
        border: "1.5px solid var(--bd-1)",
        background: disabled ? "var(--bg-2)" : "var(--bg-1)",
        color: disabled ? "var(--tx-4)" : "var(--tx-2)",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all .15s", flexShrink: 0,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  );
}

const styles = {
  wrap:       { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 2px 4px", flexWrap: "wrap", gap: 12 },
  info:       { fontSize: 13, color: "var(--tx-3)" },
  infoRange:  { fontWeight: 700, color: "var(--tx-2)" },
  infoTotal:  { fontWeight: 400 },
  controls:   { display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" },
  pages:      { display: "flex", alignItems: "center", gap: 4 },
  dots:       { fontSize: 13, color: "var(--tx-4)", padding: "0 4px", letterSpacing: 2, userSelect: "none" },
};

function buildPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const set = new Set([0, total - 1, current]);
  if (current > 0)       set.add(current - 1);
  if (current < total-1) set.add(current + 1);
  const sorted = [...set].sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}
