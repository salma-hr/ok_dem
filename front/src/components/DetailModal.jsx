// src/pages/components/DetailModal.jsx
import React from 'react';

export default function DetailModal({ checklist, onClose }) {
  if (!checklist) return null;

  const isCritical = checklist.suspicionStatut === "TRES_SUSPECT";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[2000] flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-700 flex items-center justify-between">
          <div>
            <div className="font-mono text-sm text-slate-400">CHECKLIST #{checklist.id}</div>
            <h2 className="text-2xl font-bold">{checklist.machineNom}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-auto max-h-[calc(92vh-80px)]">
          <div className="flex gap-8">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Score IA</div>
              <div className={`text-7xl font-bold ${isCritical ? 'text-red-500' : 'text-amber-500'}`}>
                {Math.round(checklist.suspicionScore || 0)}
              </div>
            </div>
            <div className="pt-6">
              <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-2xl text-sm font-semibold ${isCritical ? 'bg-red-950 text-red-400' : 'bg-amber-950 text-amber-400'}`}>
                {isCritical ? '🚨 TRÈS SUSPECT' : '⚠️ SUSPECT'}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-3">Facteurs de suspicion</div>
            <div className="flex flex-wrap gap-2">
              {checklist.suspicionFacteurs?.map((f, i) => (
                <div key={i} className="bg-slate-800 px-4 py-2 rounded-2xl text-sm">
                  {f}
                </div>
              )) || <p className="text-slate-400">Aucun facteur détecté</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-slate-400">Opérateur</div>
              <div className="font-medium mt-1">{checklist.operateurNom}</div>
            </div>
            <div>
              <div className="text-slate-400">Date</div>
              <div className="font-medium mt-1">{checklist.date || checklist.dateCreation}</div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-white text-black font-semibold rounded-2xl hover:bg-slate-200 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}