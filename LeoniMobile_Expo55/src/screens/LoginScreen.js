import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { loginApi } from '../api';
import { Colors, Shadows, Radius } from '../theme/colors';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const { login }      = useAuth();
  const { t, lang, setLang, isAr } = useI18n();
  const [matricule, setMatricule] = useState('');
  const [password,  setPassword]  = useState('');
  const [showPwd,   setShowPwd]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const handleLogin = async () => {
  if (!matricule.trim() || !password.trim()) {
    setError('Matricule et mot de passe requis');
    return;
  }
  setError('');
  setLoading(true);
  try {
    const res = await loginApi(matricule.trim(), password);
    await login(res.data);
  } catch (err) {
    console.log('=== ERREUR LOGIN ===');
    console.log('status:', err?.response?.status);
    console.log('data:', JSON.stringify(err?.response?.data));
    console.log('message:', err?.message);
    console.log('code:', err?.code);
    
    const status = err?.response?.status;
    const data   = err?.response?.data;
    let msg = t('login.errorGeneric');
    if (typeof data === 'string' && data.trim()) msg = data;
    else if (data?.message) msg = data.message;
    else if (status === 401 || status === 403) msg = t('login.error');
    setError(msg);
  } finally {
    setLoading(false);
  }
};

  return (
    <SafeAreaView style={S.safe}>
      <StatusBar style="light" />

      {/* ── Header gradient ── */}
      <View style={S.hero}>
        {/* Logo / brand */}
        <View style={S.logoWrap}>
          <View style={S.logoBox}>
            <Text style={S.logoL}>L</Text>
          </View>
          <View>
            <Text style={S.brand}>LEONI</Text>
            <Text style={S.brandSub}>OK Démarrage</Text>
          </View>
        </View>

        {/* Lang switcher */}
        <View style={S.langRow}>
          {['fr', 'ar'].map((l) => (
            <TouchableOpacity
              key={l}
              onPress={() => setLang(l)}
              style={[S.langBtn, lang === l && S.langBtnActive]}
            >
              <Text style={[S.langBtnText, lang === l && S.langBtnTextActive]}>
                {l === 'fr' ? 'FR' : 'عر'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Form card ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={S.flex}
      >
        <View style={S.card}>
          <Text style={[S.formTitle, isAr && S.rtlText]}>
            {t('login.submit')}
          </Text>
          <Text style={[S.formSub, isAr && S.rtlText]}>
            {t('login.subtitle')}
          </Text>

          {/* Matricule */}
          <View style={S.fieldWrap}>
            <Text style={[S.label, isAr && S.rtlText]}>{t('login.matricule')}</Text>
            <View style={S.inputWrap}>
              <Text style={S.inputIcon}>🪪</Text>
              <TextInput
                style={[S.input, isAr && S.rtlInput]}
                value={matricule}
                onChangeText={setMatricule}
                placeholder={t('login.matriculePlaceholder')}
                placeholderTextColor={Colors.tx4}
                autoCapitalize="none"
                autoCorrect={false}
                textAlign={isAr ? 'right' : 'left'}
              />
            </View>
          </View>

          {/* Password */}
          <View style={S.fieldWrap}>
            <Text style={[S.label, isAr && S.rtlText]}>{t('login.password')}</Text>
            <View style={S.inputWrap}>
              <Text style={S.inputIcon}>🔒</Text>
              <TextInput
                style={[S.input, isAr && S.rtlInput]}
                value={password}
                onChangeText={setPassword}
                placeholder={t('login.passwordPlaceholder')}
                placeholderTextColor={Colors.tx4}
                secureTextEntry={!showPwd}
                textAlign={isAr ? 'right' : 'left'}
              />
              <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={S.eyeBtn}>
                <Text style={S.eyeIcon}>{showPwd ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {!!error && (
            <View style={S.errorBox}>
              <Text style={S.errorText}>⚠️  {error}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[S.btn, loading && S.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={S.btnText}>{t('login.submit')}</Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View style={S.footerRow}>
            <Text style={S.footerText}>🔐  {t('login.secure')}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.l9 },
  flex: { flex: 1 },

  // Hero header
  hero: {
    backgroundColor: Colors.l9,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoBox: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoL:    { fontSize: 26, fontWeight: '900', color: '#fff' },
  brand:    { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  brandSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 1 },

  // Lang buttons
  langRow: { flexDirection: 'row', gap: 6 },
  langBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  langBtnActive: {
    backgroundColor: '#fff',
  },
  langBtnText:       { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  langBtnTextActive: { color: Colors.l7 },

  // Card
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28,
    marginTop: -4,
    ...Shadows.xl,
  },
  formTitle: { fontSize: 22, fontWeight: '900', color: Colors.tx1, marginBottom: 4 },
  formSub:   { fontSize: 13, color: Colors.tx4, marginBottom: 28, fontWeight: '500' },
  rtlText:   { textAlign: 'right' },

  // Field
  fieldWrap:  { marginBottom: 18 },
  label:      { fontSize: 12, fontWeight: '700', color: Colors.tx3, marginBottom: 8, letterSpacing: 0.4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.bd1,
    borderRadius: Radius.lg, backgroundColor: Colors.bg2,
    paddingHorizontal: 14,
  },
  inputIcon: { fontSize: 16, marginRight: 8 },
  input: {
    flex: 1, height: 50, fontSize: 15,
    color: Colors.tx1, fontWeight: '500',
  },
  rtlInput: { textAlign: 'right' },
  eyeBtn:   { padding: 8 },
  eyeIcon:  { fontSize: 18 },

  // Error
  errorBox: {
    backgroundColor: Colors.r0, borderRadius: Radius.md,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.r1,
  },
  errorText: { color: Colors.r7, fontSize: 13, fontWeight: '600' },

  // Button
  btn: {
    backgroundColor: Colors.l7,
    borderRadius: Radius.lg, height: 54,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
    ...Shadows.md,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },

  // Footer
  footerRow: { alignItems: 'center', marginTop: 24 },
  footerText: { fontSize: 11, color: Colors.tx4, fontWeight: '500' },
});
