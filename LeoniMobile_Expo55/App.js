import React, { useEffect } from 'react';  // ← ajoute useEffect
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';  // ← AJOUTE

import { AuthProvider, useAuth }  from './src/context/AuthContext';
import { I18nProvider }           from './src/context/I18nContext';
import { Colors }                 from './src/theme/colors';

import LoginScreen     from './src/screens/LoginScreen';
import SessionScreen   from './src/screens/SessionScreen';
import ChecklistScreen from './src/screens/ChecklistScreen';

SplashScreen.preventAutoHideAsync();  // ← AJOUTE (empêche le hide automatique)

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();  // ← AJOUTE
  }, [loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp }}>
        <StatusBar style="dark" />
        <ActivityIndicator color={Colors.l5} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="SessionScreen"   component={SessionScreen}   />
            <Stack.Screen name="ChecklistScreen" component={ChecklistScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </I18nProvider>
  );
}