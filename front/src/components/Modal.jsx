export default function Modal({ title, onClose, children, wide, size }) {
  const widths = { normal: 480, lg: 640, wide: 860 };
  const resolvedWidth = wide ? 860 : (widths[size] || 480);

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.box, width: resolvedWidth, maxWidth: "95vw", animation: "modalIn .2s cubic-bezier(0.16,1,0.3,1) both" }}
        onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={s.title}>{title}</h3>
          <button onClick={onClose} style={s.close}>✕</button>
        </div>
        <div style={s.body}>{children}</div>
      </div>
      <style>{`@keyframes modalIn { from{opacity:0;transform:translateY(12px) scale(0.97)} to{opacity:1;transform:none} }`}</style>
    </div>
  );
}

const s = {
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1040, padding:"24px", overflowY:"auto" },
  box: { background:"var(--bg-1,#fff)", borderRadius:16, maxHeight:"92vh", overflowY:"auto", boxShadow:"none", display:"flex", flexDirection:"column", border:"1px solid var(--bd-1,#eef2f8)", margin:"0 auto" },
  header: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 22px", borderBottom:"1px solid var(--bd-1,#eef2f8)", flexShrink:0, background:"linear-gradient(135deg,var(--bg-2,#f8fafc) 0%,var(--bg-1,#fff) 100%)", borderRadius:"16px 16px 0 0", position:"sticky", top:0, zIndex:1 },
  title: { margin:0, fontSize:15, fontWeight:800, color:"var(--tx-1,#1a2332)", letterSpacing:"-0.2px" },
  close: { background:"var(--bg-3,#f1f5f9)", border:"none", cursor:"pointer", fontSize:13, color:"var(--tx-3,#64748b)", width:30, height:30, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s", fontWeight:700, flexShrink:0 },
  body: { padding:"20px 22px", flex:1 },
};