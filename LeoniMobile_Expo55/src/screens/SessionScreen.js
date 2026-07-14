import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { getAllChecklists, getMonProfil, getAllProcessus } from '../api';
import { Colors, Shadows, Radius } from '../theme/colors';
import StepperBar from '../components/StepperBar';
import HeaderBar  from '../components/HeaderBar';

const SESSION_META = [
  { value: 'M', labelKey: 'session.morning', hoursKey: 'session.morningHours',
    icon: '🌅', accent: '#d97706', soft: '#fffbeb', ring: '#fcd34d',
    grad: ['#fef3c7', '#fffbeb'] },
  { value: 'S', labelKey: 'session.evening', hoursKey: 'session.eveningHours',
    icon: '🌆', accent: '#4f46e5', soft: '#eef2ff', ring: '#a5b4fc',
    grad: ['#e0e7ff', '#eef2ff'] },
  { value: 'N', labelKey: 'session.night',   hoursKey: 'session.nightHours',
    icon: '🌙', accent: '#1e293b', soft: '#f1f5f9', ring: '#94a3b8',
    grad: ['#e2e8f0', '#f1f5f9'] },
];

function normalizeProcessName(raw) {
  return String(raw || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}

export default function SessionScreen({ navigation }) {
  const { user }   = useAuth();
  const { t, isAr } = useI18n();
  const today = new Date().toLocaleDateString(
    isAr ? 'ar-MA' : 'fr-FR',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  );

  const [selSession, setSelSession] = useState(null);
  const [procInfo,   setProcInfo]   = useState(null);
  const [loading,    setLoading]    = useState(true);

  /* Resolve operator's processus */
  /* Resolve operator's processus */
  useEffect(() => {
    let cancelled = false;

    const resolveProcessus = async () => {
      // Priorité 1 : déjà dans le user (login)
      let procId = user?.processusId || user?.processus?.id;
      let procNom = user?.processusNom || user?.processus?.nom || '';

      if (Number.isFinite(Number(procId)) && Number(procId) > 0) {
        if (!cancelled) setProcInfo({ id: Number(procId), nom: procNom });
        setLoading(false);
        return;
      }

      // Priorité 2 : appel au profil
      try {
        const res = await getMonProfil();
        const profile = res?.data || {};

        procId = profile.processusId || profile.processus?.id;
        procNom = profile.processusNom || profile.processus?.nom || '';

        if (Number.isFinite(Number(procId)) && Number(procId) > 0) {
          if (!cancelled) setProcInfo({ id: Number(procId), nom: procNom });
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn("Impossible de récupérer le profil", e);
      }

      // Priorité 3 : dernier fallback (rare)
      if (procNom) {
        try {
          const list = (await getAllProcessus())?.data || [];
          const found = list.find(p => 
            p.nom?.toLowerCase() === procNom.toLowerCase()
          );
          if (found) {
            if (!cancelled) setProcInfo({ id: found.id, nom: found.nom });
          }
        } catch (_) {}
      }

      if (!cancelled) setLoading(false);
    };

    resolveProcessus();
    return () => { cancelled = true; };
  }, [user]);

  const pickSession = useCallback((s) => {
    setSelSession(s);
    navigation.navigate('ChecklistScreen', {
      session:  s,
      procInfo: procInfo || { id: null, nom: '' },
      machine: null,
    });
  }, [procInfo, navigation]);

  return (
    <SafeAreaView style={S.safe}>
      <StatusBar style="dark" />
      <HeaderBar />

      <ScrollView style={S.scroll} contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
        {/* Date banner */}
        <View style={S.dateBanner}>
          <Text style={S.dateText}>📅  {today}</Text>
        </View>

        {/* Stepper */}
        <StepperBar current={0} />

        {/* Panel */}
        <View style={S.panel}>
          <View style={S.panelHeader}>
            <View style={S.panelIconBox}><Text style={S.panelIcon}>⏱</Text></View>
            <View>
              <Text style={[S.panelTitle, isAr && S.rtl]}>{t('session.title')}</Text>
              <Text style={[S.panelSub, isAr && S.rtl]}>{t('session.subtitle')}</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.l5} style={{ marginVertical: 32 }} />
          ) : (
            <View style={S.sessionGrid}>
              {SESSION_META.map((s) => {
                const isSelected = selSession?.value === s.value;
                return (
                  <TouchableOpacity
                    key={s.value}
                    onPress={() => pickSession(s)}
                    style={[
                      S.shiftCard,
                      isSelected && { borderColor: s.ring, backgroundColor: s.soft,
                        ...Shadows.lg, transform: [{ translateY: -3 }] },
                    ]}
                    activeOpacity={0.82}
                  >
                    {/* Checkmark */}
                    {isSelected && (
                      <View style={[S.checkDot, { backgroundColor: s.accent }]}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>✓</Text>
                      </View>
                    )}
                    <Text style={S.shiftEmoji}>{s.icon}</Text>
                    <Text style={[S.shiftLabel, { color: s.accent }]}>{t(s.labelKey)}</Text>
                    <Text style={S.shiftHours}>{t(s.hoursKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Processus info chip */}
          {procInfo?.nom ? (
            <View style={S.procChip}>
              <Text style={S.procChipText}>⚙️  {t('common.process')}: <Text style={{ fontWeight: '800', color: Colors.l5 }}>{procInfo.nom}</Text></Text>
            </View>
          ) : null}
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

  dateBanner: {
    backgroundColor: Colors.bg1, borderRadius: Radius.lg,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.bd1,
    ...Shadows.sm,
  },
  dateText: { fontSize: 13, color: Colors.tx3, fontWeight: '600', textAlign: 'center', textTransform: 'capitalize' },

  panel: {
    backgroundColor: Colors.bg1, borderRadius: Radius['2xl'],
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(15,23,42,0.07)',
    ...Shadows.md,
  },
  panelHeader:  { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  panelIconBox: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: '#e0f2fe', borderWidth: 1, borderColor: '#cfe3ff',
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  panelIcon:  { fontSize: 20 },
  panelTitle: { fontSize: 17, fontWeight: '800', color: Colors.tx1, marginBottom: 2 },
  panelSub:   { fontSize: 13, color: Colors.tx4, fontWeight: '500' },

  sessionGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  shiftCard: {
    flex: 1, alignItems: 'center', gap: 8,
    paddingVertical: 24, paddingHorizontal: 10,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bg1,
    borderWidth: 2, borderColor: Colors.bd1,
    position: 'relative',
    ...Shadows.sm,
  },
  checkDot: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  shiftEmoji: { fontSize: 32 },
  shiftLabel: { fontSize: 15, fontWeight: '900', lineHeight: 18 },
  shiftHours: { fontSize: 11, color: Colors.tx4, fontWeight: '500', textAlign: 'center' },

  procChip: {
    backgroundColor: Colors.l1, borderRadius: Radius.lg,
    padding: 10, borderWidth: 1, borderColor: Colors.l2, alignItems: 'center',
  },
  procChipText: { fontSize: 12, color: Colors.tx3, fontWeight: '600' },
});
