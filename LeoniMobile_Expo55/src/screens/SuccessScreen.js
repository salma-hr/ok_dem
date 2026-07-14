import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useI18n } from '../context/I18nContext';
import { Colors, Shadows, Radius } from '../theme/colors';

const VALIDATION_STEPS = [
  { key: 'SOUMIS',       icon: '📤', color: '#3b82f6', labelKey: 'val.submitted' },
  { key: 'VALIDE_N1',    icon: '✅', color: '#7c3aed', labelKey: 'val.validatedN1' },
  { key: 'VALIDE_N2',    icon: '✅', color: '#0284c7', labelKey: 'val.validatedN2' },
  { key: 'VALIDE_FINAL', icon: '🏆', color: '#16a34a', labelKey: 'val.validatedFinal' },
];

export default function SuccessScreen({ session, machine, nbVert, nbRouge, nbNA, checklistId, onNewChecklist }) {
  const { t, isAr } = useI18n();
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const stats = [
    nbVert  > 0 && { val: nbVert,  label: t('success.conforme'),    bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
    nbRouge > 0 && { val: nbRouge, label: t('success.nonConforme'), bg: '#fff1f2', color: '#be123c', border: '#fda4af' },
    nbNA    > 0 && { val: nbNA,    label: t('success.na'),          bg: '#f8fafc', color: '#64748b', border: '#cbd5e1' },
  ].filter(Boolean);

  return (
    <SafeAreaView style={S.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>

        {/* Success icon */}
        <View style={S.iconRing}>
          <View style={S.iconCircle}>
            <Text style={S.iconText}>✓</Text>
          </View>
        </View>

        <Text style={[S.title, isAr && S.rtl]}>{t('success.title')}</Text>
        <Text style={[S.subtitle, isAr && S.rtl]}>{t('success.subtitle')}</Text>
        <Text style={[S.date, isAr && S.rtl]}>{today}</Text>

        {/* Meta chips */}
        <View style={S.chipsRow}>
          <View style={S.chip}><Text style={S.chipText}>{session.icon} {session.label || session.value}</Text></View>
          <View style={S.chip}><Text style={S.chipText}>🔧 {machine?.nom}</Text></View>
          {checklistId && (
            <View style={S.chip}><Text style={S.chipText}># {checklistId}</Text></View>
          )}
        </View>

        {/* Stats */}
        {stats.length > 0 && (
          <View style={S.statsRow}>
            {stats.map((s) => (
              <View key={s.label} style={[S.statItem, { backgroundColor: s.bg, borderColor: s.border }]}>
                <Text style={[S.statVal, { color: s.color }]}>{s.val}</Text>
                <Text style={[S.statLabel, { color: s.color }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Validation tracking */}
        <View style={S.trackingCard}>
          <Text style={[S.trackingTitle, isAr && S.rtl]}>{t('success.tracking')}</Text>
          <View style={S.stepsRow}>
            {VALIDATION_STEPS.map((vs, idx) => {
              const isDone    = idx === 0;
              const isCurrent = idx === 0;
              return (
                <React.Fragment key={vs.key}>
                  <View style={S.stepCol}>
                    <View style={[
                      S.stepDot,
                      isDone && { backgroundColor: vs.color, borderColor: vs.color, ...Shadows.sm },
                      isCurrent && { borderWidth: 3, borderColor: vs.color },
                    ]}>
                      <Text style={[S.stepDotText, { color: isDone ? '#fff' : Colors.tx4 }]}>
                        {isDone ? vs.icon : idx + 1}
                      </Text>
                    </View>
                    <Text style={[S.stepLabel, { color: isDone ? vs.color : Colors.tx4 }]} numberOfLines={2}>
                      {t(vs.labelKey)}
                    </Text>
                  </View>
                  {idx < VALIDATION_STEPS.length - 1 && (
                    <View style={[S.stepLine, idx === 0 && { backgroundColor: vs.color }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* Waiting message */}
          <View style={S.waitingBanner}>
            <Text style={S.waitingText}>⏳ {t('success.waiting')}</Text>
          </View>
        </View>

        {/* Action */}
        <TouchableOpacity style={S.btnNew} onPress={onNewChecklist} activeOpacity={0.85}>
          <Text style={S.btnNewText}>+ {t('success.newChecklist')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: 24, paddingBottom: 48, alignItems: 'center' },
  rtl:     { textAlign: 'right' },

  iconRing: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: '#bbf7d0',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 16, marginBottom: 8,
    backgroundColor: '#f0fdf4',
  },
  iconCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#16a34a',
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.lg,
  },
  iconText: { color: '#fff', fontSize: 30, fontWeight: '900' },

  title:    { fontSize: 24, fontWeight: '900', color: Colors.tx1, marginTop: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.tx3, marginTop: 4, fontWeight: '500', textAlign: 'center' },
  date:     { fontSize: 12, color: Colors.tx4, marginTop: 4, marginBottom: 18, textAlign: 'center', textTransform: 'capitalize' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 18 },
  chip: {
    backgroundColor: Colors.bg3, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.bd1,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.tx2 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center' },
  statItem: {
    minWidth: 80, alignItems: 'center', gap: 3,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: Radius.lg, borderWidth: 1,
    ...Shadows.sm,
  },
  statVal:   { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  trackingCard: {
    backgroundColor: Colors.bg1, borderRadius: Radius['2xl'],
    padding: 18, width: '100%', marginBottom: 20,
    borderWidth: 1, borderColor: Colors.bd1, ...Shadows.md,
  },
  trackingTitle: {
    fontSize: 11, fontWeight: '800', color: Colors.tx4,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 16,
  },
  stepsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepCol:  { alignItems: 'center', gap: 6, flex: 0 },
  stepDot: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.bg3, borderWidth: 2, borderColor: Colors.bd1,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotText: { fontSize: 14, fontWeight: '700' },
  stepLabel: {
    fontSize: 9, fontWeight: '600', textAlign: 'center',
    width: 58, lineHeight: 13,
  },
  stepLine: {
    flex: 1, height: 2, backgroundColor: Colors.bd1,
    borderRadius: 2, marginHorizontal: 4, marginBottom: 22, marginTop: 16,
  },

  waitingBanner: {
    marginTop: 14, backgroundColor: '#fef9c3', borderRadius: Radius.lg,
    padding: 10, borderWidth: 1, borderColor: '#fde047',
  },
  waitingText: { fontSize: 12, fontWeight: '700', color: '#854d0e', textAlign: 'center' },

  btnNew: {
    width: '100%', backgroundColor: Colors.l7,
    borderRadius: Radius.lg, paddingVertical: 16,
    alignItems: 'center', ...Shadows.md,
  },
  btnNewText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
