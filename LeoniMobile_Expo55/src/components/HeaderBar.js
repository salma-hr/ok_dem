import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Pressable, Alert,
} from 'react-native';
import { useAuth }  from '../context/AuthContext';
import { useI18n }  from '../context/I18nContext';
import { Colors, Shadows, Radius } from '../theme/colors';

export default function HeaderBar() {
  const { user, logout }   = useAuth();
  const { t, lang, setLang, isAr } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = (user?.nom || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  const handleLogout = () => {
    setMenuOpen(false);
    Alert.alert(
      t('common.logout'),
      'Confirmer la déconnexion ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: t('common.logout'), style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <View style={S.header}>
      {/* Brand */}
      <View style={S.brand}>
        <View style={S.logoBox}>
          <Text style={S.logoL}>L</Text>
        </View>
        <View>
          <Text style={S.brandName}>LEONI</Text>
          <Text style={S.brandSub}>OK Démarrage</Text>
        </View>
      </View>

      {/* Right: lang + avatar */}
      <View style={S.right}>
        {/* Lang switcher */}
        <View style={S.langRow}>
          {['fr', 'ar'].map((l) => (
            <TouchableOpacity
              key={l}
              onPress={() => setLang(l)}
              style={[S.langBtn, lang === l && S.langBtnActive]}
            >
              <Text style={[S.langText, lang === l && S.langTextActive]}>
                {l === 'fr' ? 'FR' : 'عر'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Avatar / menu */}
        <TouchableOpacity onPress={() => setMenuOpen(true)} style={S.avatar} activeOpacity={0.85}>
          <Text style={S.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown menu */}
      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={S.overlay} onPress={() => setMenuOpen(false)}>
          <View style={S.menu}>
            {/* User info */}
            <View style={S.menuUser}>
              <View style={S.menuAvatar}>
                <Text style={S.menuAvatarText}>{initials}</Text>
              </View>
              <View>
                <Text style={S.menuName}>{user?.nom}</Text>
                <Text style={S.menuRole}>Opérateur</Text>
                {user?.processusNom ? (
                  <Text style={S.menuProc}>⚙️ {user.processusNom}</Text>
                ) : null}
              </View>
            </View>

            <View style={S.menuDivider} />

            {/* Logout */}
            <TouchableOpacity style={S.menuItem} onPress={handleLogout}>
              <Text style={S.menuItemIcon}>🚪</Text>
              <Text style={[S.menuItemText, { color: Colors.r6 }]}>{t('common.logout')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.l9,
    paddingHorizontal: 16, paddingVertical: 12,
    ...Shadows.md,
  },
  brand:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: {
    width: 36, height: 36, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoL:     { fontSize: 18, fontWeight: '900', color: '#fff' },
  brandName: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  brandSub:  { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },

  right:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  langRow: { flexDirection: 'row', gap: 4 },
  langBtn: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  langBtnActive: { backgroundColor: 'rgba(255,255,255,0.28)' },
  langText:       { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  langTextActive: { color: '#fff' },

  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.l5,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '900', color: '#fff' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  menu: {
    position: 'absolute', top: 64, right: 16,
    backgroundColor: '#fff', borderRadius: Radius['2xl'],
    padding: 16, minWidth: 220,
    ...Shadows.xl,
    borderWidth: 1, borderColor: Colors.bd1,
  },
  menuUser:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  menuAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.l5, alignItems: 'center', justifyContent: 'center',
  },
  menuAvatarText: { fontSize: 16, fontWeight: '900', color: '#fff' },
  menuName:       { fontSize: 15, fontWeight: '800', color: Colors.tx1 },
  menuRole:       { fontSize: 12, color: Colors.tx4, fontWeight: '500' },
  menuProc:       { fontSize: 11, color: Colors.l5,  fontWeight: '600', marginTop: 2 },
  menuDivider:    { height: 1, backgroundColor: Colors.bd1, marginBottom: 10 },
  menuItem:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  menuItemIcon:   { fontSize: 16 },
  menuItemText:   { fontSize: 14, fontWeight: '700' },
});
