import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useI18n } from '../context/I18nContext';
import { Colors, Shadows, Radius } from '../theme/colors';

const STEPS = [
  { icon: '⏱', labelKey: 'step.session' },
  { icon: '🔧', labelKey: 'step.machine' },
  { icon: '📋', labelKey: 'step.checklist' },
];

export default function StepperBar({ current }) {
  const { t } = useI18n();
  return (
    <View style={S.stepper}>
      {STEPS.map((s, i) => {
        const isDone   = i < current;
        const isActive = i === current;
        return (
          <React.Fragment key={s.labelKey}>
            <View style={S.stepItem}>
              <View style={[
                S.dot,
                isActive && S.dotActive,
                isDone   && S.dotDone,
              ]}>
                {isDone ? (
                  <Text style={S.dotCheck}>✓</Text>
                ) : (
                  <Text style={[S.dotNum, (isActive || isDone) && { color: '#fff' }]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[
                S.label,
                isActive && S.labelActive,
                isDone   && S.labelDone,
              ]}>{t(s.labelKey)}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[S.line, isDone && S.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const S = StyleSheet.create({
  stepper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: Radius['2xl'],
    paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(15,23,42,0.07)',
    ...Shadows.md,
  },
  stepItem: { alignItems: 'center', gap: 5 },
  dot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.bd1,
    alignItems: 'center', justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: Colors.l6, borderColor: Colors.l5,
    shadowColor: Colors.l5, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  dotDone: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  dotNum:   { fontSize: 12, fontWeight: '700', color: Colors.tx4 },
  dotCheck: { fontSize: 14, color: '#fff', fontWeight: '900' },
  label:       { fontSize: 10, color: Colors.tx4, fontWeight: '500' },
  labelActive: { color: Colors.l5, fontWeight: '700' },
  labelDone:   { color: '#16a34a', fontWeight: '600' },
  line:        { flex: 1, height: 2, backgroundColor: Colors.bd1, borderRadius: 1, marginHorizontal: 6, marginBottom: 14 },
  lineDone:    { backgroundColor: '#16a34a' },
});
