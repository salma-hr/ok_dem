import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, SafeAreaView,
  Image, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth }  from '../context/AuthContext';
import { useI18n }  from '../context/I18nContext';
import {
  getCriteresByProcessus, verifierEtatChecklist,
  getAllChecklists, soumettreChecklist,
} from '../api';
import { Colors, Shadows, Radius } from '../theme/colors';
import StepperBar   from '../components/StepperBar';
import HeaderBar    from '../components/HeaderBar';
import SuccessScreen from './SuccessScreen';

/* ── Constants ─────────────────────────────────────── */
const RESULT_ORDER = ['VERT', 'ROUGE', 'NA'];
const RESULT_LABELS = { VERT: '1', ROUGE: '0', NA: 'NA' };

const RESULTS = {
  VERT:  { bg: '#f0fdf4', color: '#15803d', border: '#86efac', dot: '#16a34a' },
  JAUNE: { bg: '#fefce8', color: '#a16207', border: '#fde047', dot: '#ca8a04' },
  ROUGE: { bg: '#fff1f2', color: '#be123c', border: '#fda4af', dot: '#e11d48' },
  NA:    { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1', dot: '#94a3b8' },
};

const TYPES = {
  SECURITE:  { color: '#dc2626', bg: '#fff1f2', icon: '🛡️' },
  QUALITE:   { color: '#059669', bg: '#f0fdf4', icon: '🎯' },
  TECHNIQUE: { color: '#2563eb', bg: '#eff6ff', icon: '⚙️' },
};

const NC_FLAG = {
  rouge: { bg: '#ef4444', text: '#fff', shadow: 'rgba(239,68,68,0.35)' },
  jaune: { bg: '#f59e0b', text: '#111827', shadow: 'rgba(245,158,11,0.35)' },
};

function normalizeCouleur(raw) {
  const v = String(raw || '').trim().toLowerCase();
  return v === 'jaune' ? 'jaune' : 'rouge';
}

function resolveImageUrl(rawUrl, baseURL) {
  if (!rawUrl) return null;
  const clean = rawUrl.trim().replace(/\\/g, '/');
  if (!clean) return null;
  if (clean.startsWith('data:image/')) return clean;
  if (/^https?:\/\//i.test(clean)) return clean;
  const uploadsIdx = clean.toLowerCase().indexOf('/uploads/');
  if (uploadsIdx >= 0) return `${baseURL.replace(/\/api\/?$/, '')}${clean.slice(uploadsIdx)}`;
  if (clean.startsWith('uploads/')) return `${baseURL.replace(/\/api\/?$/, '')}/${clean}`;
  if (clean.startsWith('/')) return `${baseURL.replace(/\/api\/?$/, '')}${clean}`;
  return `${baseURL.replace(/\/api\/?$/, '')}/${clean}`;
}

/* ═══════════════════════════════════════════════════
   CRITERE CARD
   ═══════════════════════════════════════════════════ */
const CritereCard = React.memo(({ critere, index, reponse, onChange, onComment, isAr, t, baseURL }) => {
  const rep   = reponse || { valeur: 'VERT', commentaire: '' };
  const rv    = RESULTS[rep.valeur] || RESULTS.VERT;
  const couleur   = normalizeCouleur(critere.couleur || critere.flag_color || critere.flagColor);
  const isRouge   = rep.valeur === 'ROUGE' && couleur === 'rouge';
  const isJaune   = rep.valeur === 'ROUGE' && couleur === 'jaune';
  const isNC      = isRouge || isJaune;
  const ncFlag    = NC_FLAG[couleur] || NC_FLAG.rouge;
  const imageUrl  = resolveImageUrl(critere.image, baseURL);
  const nom  = isAr ? (critere.nomAr || critere.nom || '—') : (critere.nom || critere.nomAr || '—');
  const desc = isAr ? (critere.descriptionAr || critere.description || '') : (critere.description || '');

  const borderColor = isJaune ? '#f59e0b' : isRouge ? '#ef4444' : '#16a34a';

  return (
    <View style={[S.critCard, { borderLeftColor: borderColor, shadowColor: isNC ? ncFlag.bg : '#0f172a' }]}>
      {/* Header */}
      <View style={S.critHeader}>
        <View style={S.critIndex}>
          <Text style={S.critIndexText}>{index + 1}</Text>
        </View>

        <View style={S.critInfo}>
          <Text style={[S.critNom, isAr && S.rtl]}>{nom}</Text>
          {!!desc && <Text style={[S.critDesc, isAr && S.rtl]} numberOfLines={3}>{desc}</Text>}

          {/* Type badge */}
          <View style={[S.typePill, { backgroundColor: couleur === 'jaune' ? '#fef3c7' : '#fee2e2' }]}>
            <Text style={[S.typePillText, { color: couleur === 'jaune' ? '#b45309' : '#b91c1c' }]}>
              {couleur === 'jaune' ? '🟡 Machine' : '🔴 Visuel'}
            </Text>
          </View>
        </View>

        <View style={S.critRight}>
          {/* LTPM flag */}
          {isNC && (
            <View style={S.ltpmWrap}>
              <Text style={[S.ltpmLabel, { color: ncFlag.bg }]}>LTPM</Text>
              <View style={[S.ltpmTriangle, { backgroundColor: ncFlag.bg }]}>
                <Text style={[S.ltpmText, { color: ncFlag.text }]}>!</Text>
              </View>
            </View>
          )}

          {/* Result badge */}
          <View style={[S.resultBadge, { backgroundColor: rv.bg, borderColor: rv.border }]}>
            <View style={[S.resultDot, { backgroundColor: rv.dot }]} />
            <Text style={[S.resultBadgeText, { color: rv.color }]}>{rv.label || rep.valeur}</Text>
          </View>
        </View>
      </View>

      {/* Image */}
      {!!imageUrl && (
        <View style={S.imageWrap}>
          <Text style={S.imageLbl}>{t('checklist.referenceImage')}</Text>
          <Image
            source={{ uri: imageUrl }}
            style={S.imagePreview}
            resizeMode="contain"
            onError={() => {}}
          />
        </View>
      )}

      {/* Evaluation buttons */}
      <View style={S.evalSection}>
        <Text style={[S.blockLabel, isAr && S.rtl]}>{t('checklist.evaluation')}</Text>
        <View style={S.valBtns}>
          {RESULT_ORDER.map((key) => {
            const r2 = RESULTS[key];
            const isSelected = rep.valeur === key;
            const label = RESULT_LABELS[key] || key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => onChange(critere.id, key)}
                style={[
                  S.valBtn,
                  isSelected && {
                    backgroundColor: r2.bg,
                    borderColor: r2.border,
                    ...Shadows.sm,
                  },
                ]}
                activeOpacity={0.8}
              >
                <View style={[S.valDot, { backgroundColor: isSelected ? r2.dot : Colors.bd1 }]} />
                <Text style={[S.valBtnText, { color: isSelected ? r2.color : Colors.tx4, fontWeight: isSelected ? '800' : '500' }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Comment */}
      <View style={S.commentSection}>
        <Text style={[S.blockLabel, isAr && S.rtl]}>{t('checklist.comment')}</Text>
        <TextInput
          style={[
            S.commentBox,
            isAr && S.rtlInput,
            {
              borderColor: isRouge ? '#fda4af' : isJaune ? '#fde047' : Colors.bd1,
            },
          ]}
          placeholder={isJaune ? t('checklist.commentRequired') : t('checklist.commentOptional')}
          placeholderTextColor={Colors.tx4}
          multiline
          numberOfLines={3}
          value={rep.commentaire}
          onChangeText={(v) => onComment(critere.id, v)}
          textAlignVertical="top"
          textAlign={isAr ? 'right' : 'left'}
        />
      </View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════ */
export default function ChecklistScreen({ navigation, route }) {
  const { session, procInfo, machine = null } = route.params;
  const { user }   = useAuth();
  const { t, isAr } = useI18n();

  const todayISO = new Date().toISOString().split('T')[0];
  const startRef = useRef(Date.now());

  const [criteres,   setCriteres]   = useState([]);
  const [reponses,   setReponses]   = useState({});
  const [activeType, setActiveType] = useState(null);
  const [etat,       setEtat]       = useState(null);   // 'NOUVEAU' | 'DEJA_SOUMIS' | 'MACHINE_OCCUPEE'
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);
  const [blockedByRed, setBlockedByRed] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [clCache,    setClCache]    = useState([]);
  const [submittedId, setSubmittedId] = useState(null);

  const BASE_URL = require('../api').BASE_URL;

  /* Load critères + état */
  useEffect(() => {
    (async () => {
      if (!procInfo?.id || !session?.value) { setLoading(false); return; }
      setLoading(true);

      const operateurId = Number(user?.id);

      // quick local check: if AsyncStorage says operator already submitted today, block immediately
      try {
        const last = await AsyncStorage.getItem(`lastSubmission_${operateurId}`);
        if (last === todayISO) {
          setEtat('DEJA_SOUMIS');
          setLoading(false);
          return;
        }
      } catch (_e) {}

      // fallback to server calls when no local evidence of submission
      try {
        const [critRes, etatRes, clRes] = await Promise.all([
          getCriteresByProcessus(Number(procInfo.id)),
          verifierEtatChecklist(user?.id, machine?.id ?? null, session.value, todayISO),
          getAllChecklists(),
        ]);

        const list  = Array.isArray(critRes.data) ? critRes.data : [];
        const etatData = etatRes.data;
        const allCl = Array.isArray(clRes.data) ? clRes.data : [];
        setClCache(allCl);
        setCriteres(list);

        // if operator already submitted any checklist today, block further checklists
        const alreadyTodayOperator = allCl.some(
          (cl) => cl && Number(cl?.operateurId) === operateurId &&
            String(cl?.date ?? '') === todayISO &&
            String(cl?.status ?? cl?.statut ?? '') !== 'EN_COURS'
        );

        if (alreadyTodayOperator) {
          setEtat('DEJA_SOUMIS');
        }

        // also check AsyncStorage fallback (last submission recorded locally)
        AsyncStorage.getItem(`lastSubmission_${operateurId}`).then((d) => {
          if (d === todayISO) setEtat('DEJA_SOUMIS');
        }).catch(() => {});

        if (!alreadyTodayOperator) {
          const s = etatData?.status;
          setEtat(s === 'DEJA_SOUMIS' ? 'DEJA_SOUMIS' : s === 'MACHINE_OCCUPEE' ? 'MACHINE_OCCUPEE' : 'NOUVEAU');
        }

        const init = {};
        list.forEach((c) => { init[c.id] = { valeur: 'VERT', commentaire: '' }; });
        setReponses(init);
        const types = [...new Set(list.map((c) => c.type).filter(Boolean))];
        setActiveType(types[0] || null);
      } catch (e) {
        try {
          const r = await getCriteresByProcessus(Number(procInfo.id));
          const list = Array.isArray(r.data) ? r.data : [];
          setCriteres(list);
          const init = {};
          list.forEach((c) => { init[c.id] = { valeur: 'VERT', commentaire: '' }; });
          setReponses(init);
          setEtat('NOUVEAU');
          setActiveType([...new Set(list.map((c) => c.type).filter(Boolean))][0] || null);
        } catch (_) {
          setError('Impossible de charger les critères.');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [procInfo?.id, session?.value, machine?.id, todayISO, user?.id]);

  const critByType = useMemo(() =>
    criteres.reduce((acc, c) => {
      const tp = c.type || 'AUTRE';
      if (!acc[tp]) acc[tp] = [];
      acc[tp].push(c);
      return acc;
    }, {}),
  [criteres]);

  const types = Object.keys(critByType);

  const nbRouge = Object.values(reponses).filter((r) => r.valeur === 'ROUGE').length;
  const nbVert  = Object.values(reponses).filter((r) => r.valeur === 'VERT').length;
  const nbNA    = Object.values(reponses).filter((r) => r.valeur === 'NA').length;

  const setVal = useCallback((id, v) =>
    setReponses((r) => ({ ...r, [id]: { ...r[id], valeur: v } })), []);
  const setCmt = useCallback((id, v) =>
    setReponses((r) => ({ ...r, [id]: { ...r[id], commentaire: v } })), []);

  const setAllGreen = () => {
    const init = {};
    criteres.forEach((c) => { init[c.id] = { valeur: 'VERT', commentaire: reponses[c.id]?.commentaire || '' }; });
    setReponses(init);
  };

  const handleSubmit = async () => {
    setError('');
    if (!session?.value)       { setError(t('error.sessionNotSelected'));  return; }
    const operateurId = Number(user?.id);
    if (!Number.isFinite(operateurId)) { setError(t('error.userNotAuth')); return; }
    if (!criteres.length)      { setError(t('error.noResponses'));          return; }

    // double-check AsyncStorage in case clCache is stale
    try {
      const last = await AsyncStorage.getItem(`lastSubmission_${operateurId}`);
      if (last === todayISO) { setError(t('error.alreadySubmitted')); return; }
    } catch (_e) {}

    const alreadyToday = clCache.some(
      (cl) =>
        cl && Number(cl?.operateurId) === operateurId &&
        String(cl?.date ?? '') === todayISO &&
        String(cl?.status ?? cl?.statut ?? '') !== 'EN_COURS'
    );
    if (alreadyToday) { setError(t('error.alreadySubmitted')); return; }

    // detect if any criterion is a red NC (LTPM rouge)
    const hasRedNC = criteres.some((c) => {
      const r = reponses[c.id];
      const couleur = normalizeCouleur(c.couleur || c.flag_color || c.flagColor);
      return r?.valeur === 'ROUGE' && couleur === 'rouge';
    });

    setSubmitting(true);
    try {
      const siteId = Number(
        machine?.siteId ?? machine?.site?.id ??
        machine?.plant?.siteId ?? machine?.segment?.plant?.siteId ??
        user?.siteId ?? user?.site?.id ?? null
      );
      const payload = {
        date:        todayISO,
        session:     session.value,
        ...(machine?.id != null ? { machineId: Number(machine.id) } : {}),
        operateurId,
        ...(Number.isFinite(siteId) && siteId > 0 ? { siteId } : {}),
        reponses: Object.entries(reponses).map(([critereId, r]) => ({
          critereId:   Number(critereId),
          valeur:      r.valeur,
          commentaire: r.commentaire || '',
        })),
        dureeFillSec: Math.floor((Date.now() - startRef.current) / 1000),
      };

      await soumettreChecklist(payload);

      // get submitted ID
      try {
        const r2  = await getAllChecklists();
        const all = Array.isArray(r2.data) ? r2.data : [];
        const mine = all
          .filter((cl) =>
            cl && Number(cl?.operateurId) === operateurId &&
            (machine?.id == null || Number(cl?.machineId) === Number(machine.id)) &&
            String(cl?.date) === todayISO
          )
          .sort((a, b) => (b.id || 0) - (a.id || 0));
        if (mine[0]) setSubmittedId(mine[0].id);
      } catch (_) {}

      // mark blocked if red NC found and prevent further checklists locally
      if (hasRedNC) setBlockedByRed(true);

      // persist last submission date per operator to guarantee daily-block even if server/cache incomplete
      try {
        await AsyncStorage.setItem(`lastSubmission_${operateurId}`, todayISO);
      } catch (_e) {}

      // add a local cache entry so verifierEtatChecklist / checks later see this as submitted
      setClCache((prev) => ([...prev, { operateurId, machineId: machine?.id != null ? Number(machine.id) : null, date: todayISO, status: 'SOUMIS' }]));
      setEtat('DEJA_SOUMIS');

      setSuccess(true);
    } catch (err) {
      const data = err?.response?.data;
      let msg = 'Erreur lors de la soumission.';
      if (typeof data === 'string' && data.trim()) msg = data;
      else if (data?.message) msg = data.message;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── SUCCESS ── */
  if (success) {
    if (blockedByRed) {
      return (
        <SafeAreaView style={S.safe}>
          <StatusBar style="dark" />
          <HeaderBar />
          <View style={S.centeredWrap}>
            <View style={[S.blockedCard, { borderColor: '#fecaca' }]}>
              <Text style={[S.blockedIcon, { color: '#ef4444' }]}>⚠️</Text>
              <Text style={[S.blockedTitle, { color: '#b91c1c' }]}>Blocage LTPM — NC Rouge</Text>
              <Text style={S.blockedMsg}>
                Une non-conformité critique (couleur rouge) a été détectée et la machine est bloquée.
                Vous ne pouvez pas lancer une nouvelle checklist pour cette session aujourd'hui.
              </Text>
              <TouchableOpacity style={S.btnBack} onPress={() => navigation.navigate('SessionScreen')}>
                <Text style={S.btnBackText}>← Retour</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SuccessScreen
        session={session}
        machine={machine}
        nbVert={nbVert}
        nbRouge={nbRouge}
        nbNA={nbNA}
        checklistId={submittedId}
        onNewChecklist={() => navigation.navigate('SessionScreen')}
      />
    );
  }

  /* ── ALREADY SUBMITTED ── */
  if (!loading && etat === 'DEJA_SOUMIS') {
    return (
      <SafeAreaView style={S.safe}>
        <StatusBar style="dark" />
        <HeaderBar />
        <View style={S.centeredWrap}>
          <View style={S.blockedCard}>
            <Text style={S.blockedIcon}>🔒</Text>
            <Text style={S.blockedTitle}>{t('submitted.title')}</Text>
            <Text style={S.blockedMsg}>
              Vous avez déjà soumis une checklist aujourd'hui. Vous ne pouvez pas en soumettre une autre.
            </Text>
            <TouchableOpacity style={S.btnBack} onPress={() => navigation.goBack()}>
              <Text style={S.btnBackText}>← {t('submitted.changeMachine')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  /* ── MACHINE OCCUPIED ── */
  if (!loading && etat === 'MACHINE_OCCUPEE') {
    return (
      <SafeAreaView style={S.safe}>
        <StatusBar style="dark" />
        <HeaderBar />
        <View style={S.centeredWrap}>
          <View style={S.blockedCard}>
            <Text style={S.blockedIcon}>🚫</Text>
            <Text style={S.blockedTitle}>{t('occupied.title')}</Text>
            <Text style={S.blockedMsg}>{t('occupied.msg')}</Text>
            <TouchableOpacity style={S.btnBack} onPress={() => navigation.goBack()}>
              <Text style={S.btnBackText}>← {t('occupied.change')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const displayItems = activeType ? (critByType[activeType] || []) : criteres;

  return (
    <SafeAreaView style={S.safe}>
      <StatusBar style="dark" />
      <HeaderBar />

      <ScrollView style={S.scroll} contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
        <StepperBar current={2} />

        {/* Context info */}
        <View style={S.contextBar}>
          <View style={S.contextChip}>
            <Text style={S.contextChipText}>{session.icon} {session.label || session.value}</Text>
          </View>
          {machine?.nom ? (
            <>
              <Text style={S.contextArrow}>·</Text>
              <View style={S.contextChip}>
                <Text style={S.contextChipText}>🔧 {machine?.nom}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Instructions accordion */}
        <TouchableOpacity
          style={S.instructionHeader}
          onPress={() => setShowInstructions(!showInstructions)}
          activeOpacity={0.8}
        >
          <Text style={S.instructionToggleText}>
            {showInstructions ? '▼' : '▶'} {t('checklist.instructions')}
          </Text>
          <Text style={S.instructionHint}>{showInstructions ? t('checklist.hide') : t('checklist.show')}</Text>
        </TouchableOpacity>

        {showInstructions && (
          <View style={S.instructionBox}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={S.instructionRow}>
                <View style={S.instructionDot} />
                <Text style={S.instructionText}>{t(`common.instructions.${i}`)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Type tabs */}
        {types.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tabsScroll} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
            {types.map((tp) => {
              const meta = TYPES[tp] || { color: Colors.tx3, bg: Colors.bg3, icon: '📌' };
              const isActive = activeType === tp;
              return (
                <TouchableOpacity
                  key={tp}
                  onPress={() => setActiveType(tp)}
                  style={[
                    S.typeTab,
                    isActive && { backgroundColor: meta.bg, borderColor: meta.color },
                  ]}
                >
                  <Text style={S.typeTabIcon}>{meta.icon}</Text>
                  <Text style={[S.typeTabText, { color: isActive ? meta.color : Colors.tx4 }]}>
                    {t(`type.${tp}`) || tp}
                  </Text>
                  <View style={[S.typeTabCount, { backgroundColor: isActive ? meta.color : Colors.bg3 }]}>
                    <Text style={[S.typeTabCountText, { color: isActive ? '#fff' : Colors.tx4 }]}>
                      {critByType[tp]?.length}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Quick action */}
        <TouchableOpacity style={S.allGreenBtn} onPress={setAllGreen}>
          <Text style={S.allGreenText}>✓ {t('checklist.allGood')}</Text>
        </TouchableOpacity>

        {/* Summary bar */}
        <View style={S.summaryBar}>
          {nbVert > 0  && <View style={[S.summPill, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}><Text style={{ color: '#15803d', fontWeight: '800', fontSize: 13 }}>{nbVert} ✓</Text></View>}
          {nbRouge > 0 && <View style={[S.summPill, { backgroundColor: '#fff1f2', borderColor: '#fda4af' }]}><Text style={{ color: '#be123c', fontWeight: '800', fontSize: 13 }}>{nbRouge} ✗</Text></View>}
          {nbNA > 0    && <View style={[S.summPill, { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }]}><Text style={{ color: '#64748b', fontWeight: '800', fontSize: 13 }}>{nbNA} NA</Text></View>}
          <Text style={S.totalCrit}>{criteres.length} {t('checklist.criteria')}</Text>
        </View>

        {/* Loading */}
        {loading ? (
          <ActivityIndicator color={Colors.l5} size="large" style={{ marginVertical: 40 }} />
        ) : (
          displayItems.map((c, idx) => (
            <CritereCard
              key={c.id}
              critere={c}
              index={idx}
              reponse={reponses[c.id]}
              onChange={setVal}
              onComment={setCmt}
              isAr={isAr}
              t={t}
              baseURL={BASE_URL}
            />
          ))
        )}

        {/* Error */}
        {!!error && (
          <View style={S.errBox}>
            <Text style={S.errText}>⚠️  {error}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={S.actionRow}>
          <TouchableOpacity style={S.btnBack} onPress={() => navigation.goBack()}>
            <Text style={S.btnBackText}>← {t('submit.back')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              S.btnSubmit,
              nbRouge > 0 && { backgroundColor: '#be123c' },
              (criteres.length === 0 || submitting) && { opacity: 0.55 },
            ]}
            onPress={handleSubmit}
            disabled={criteres.length === 0 || submitting}
            activeOpacity={0.88}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={S.btnSubmitText}>
                {nbRouge > 0 ? `⚠ ${t('submit.withIssues', { n: nbRouge })}` : `✓ ${t('submit.btn')}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bgApp },
  scroll:  { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  rtl:     { textAlign: 'right' },
  rtlInput:{ textAlign: 'right' },

  centeredWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  blockedCard: {
    backgroundColor: Colors.bg1, borderRadius: Radius['2xl'],
    padding: 32, alignItems: 'center', width: '100%',
    ...Shadows.xl,
  },
  blockedIcon:  { fontSize: 44, marginBottom: 16 },
  blockedTitle: { fontSize: 20, fontWeight: '900', color: Colors.tx1, marginBottom: 10, textAlign: 'center' },
  blockedMsg:   { fontSize: 14, color: Colors.tx3, lineHeight: 22, textAlign: 'center', marginBottom: 24 },

  contextBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  contextChip: {
    backgroundColor: Colors.l1, borderRadius: Radius.full,
    paddingVertical: 5, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Colors.l2,
  },
  contextChipText: { fontSize: 12, color: Colors.l6, fontWeight: '700' },
  contextArrow:    { fontSize: 16, color: Colors.tx4 },

  instructionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.bg1, borderRadius: Radius.lg,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.bd1,
    ...Shadows.sm,
  },
  instructionToggleText: { fontSize: 13, fontWeight: '700', color: Colors.l5 },
  instructionHint:       { fontSize: 11, color: Colors.tx4, fontWeight: '500' },
  instructionBox: {
    backgroundColor: Colors.bg2, borderRadius: Radius.lg,
    padding: 14, marginBottom: 12, gap: 8,
    borderWidth: 1, borderColor: Colors.bd1,
  },
  instructionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  instructionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.l5, marginTop: 6, flexShrink: 0 },
  instructionText:{ fontSize: 12, color: Colors.tx2, lineHeight: 20, flex: 1 },

  tabsScroll: { marginBottom: 12 },
  typeTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.bd1,
    backgroundColor: Colors.bg1,
  },
  typeTabIcon:      { fontSize: 14 },
  typeTabText:      { fontSize: 13, fontWeight: '600' },
  typeTabCount:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full },
  typeTabCountText: { fontSize: 11, fontWeight: '700' },

  allGreenBtn: {
    backgroundColor: Colors.g0, borderRadius: Radius.lg,
    padding: 12, alignItems: 'center', marginBottom: 10,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  allGreenText: { fontSize: 13, fontWeight: '700', color: Colors.g6 },

  summaryBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 14, flexWrap: 'wrap',
  },
  summPill: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1,
  },
  totalCrit: { fontSize: 12, color: Colors.tx4, fontWeight: '500', marginLeft: 'auto' },

  /* Critere card */
  critCard: {
    backgroundColor: Colors.bg1, borderRadius: Radius['2xl'],
    borderWidth: 1, borderColor: 'rgba(15,23,42,0.07)',
    borderLeftWidth: 5,
    padding: 16, marginBottom: 12,
    ...Shadows.sm,
  },
  critHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  critIndex: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: Colors.l1, borderWidth: 1.5, borderColor: Colors.l3,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  critIndexText: { fontSize: 11, fontWeight: '800', color: Colors.l6 },
  critInfo:      { flex: 1, minWidth: 0 },
  critNom:       { fontSize: 14, fontWeight: '700', color: Colors.tx1, lineHeight: 20, marginBottom: 3 },
  critDesc:      { fontSize: 12, color: Colors.tx3, lineHeight: 18 },
  typePill: {
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: Radius.full,
  },
  typePillText: { fontSize: 11, fontWeight: '700' },
  critRight:    { alignItems: 'center', gap: 6, flexShrink: 0 },

  ltpmWrap:     { alignItems: 'center', gap: 2 },
  ltpmLabel:    { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  ltpmTriangle: {
    width: 26, height: 22,
    // Triangle via border trick
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 4,
  },
  ltpmText: { fontSize: 12, fontWeight: '900' },

  resultBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1.5,
  },
  resultDot:      { width: 6, height: 6, borderRadius: 3 },
  resultBadgeText:{ fontSize: 11, fontWeight: '800' },

  imageWrap: {
    backgroundColor: '#fff', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.bd1,
    padding: 12, marginBottom: 12, gap: 8,
  },
  imageLbl:     { fontSize: 10, fontWeight: '800', color: Colors.tx4, letterSpacing: 0.8, textTransform: 'uppercase' },
  imagePreview: { width: '100%', height: 120, borderRadius: 10, backgroundColor: Colors.bg3 },

  evalSection:   { marginBottom: 10 },
  blockLabel:    { fontSize: 10, fontWeight: '800', color: Colors.tx4, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  valBtns:       { flexDirection: 'row', gap: 8 },
  valBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.bd1,
    backgroundColor: Colors.bg1,
  },
  valDot:     { width: 7, height: 7, borderRadius: 3.5 },
  valBtnText: { fontSize: 15, fontWeight: '700' },

  commentSection: { gap: 6 },
  commentBox: {
    borderWidth: 1.5, borderRadius: Radius.lg,
    padding: 12, fontSize: 13, color: Colors.tx1,
    backgroundColor: '#fff', minHeight: 72, lineHeight: 20,
  },

  errBox: {
    backgroundColor: Colors.r0, borderRadius: Radius.md,
    padding: 12, marginVertical: 12,
    borderWidth: 1, borderColor: Colors.r1,
  },
  errText: { color: Colors.r7, fontSize: 13, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnBack: {
    backgroundColor: '#fff', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.bd2,
    paddingVertical: 14, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  btnBackText: { fontSize: 14, fontWeight: '600', color: Colors.tx2 },
  btnSubmit: {
    flex: 1, backgroundColor: Colors.l7,
    borderRadius: Radius.lg, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
  btnSubmitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
