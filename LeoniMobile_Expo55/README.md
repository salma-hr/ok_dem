# LeoniMobile — OK Démarrage

Application mobile opérateur LEONI, migrée vers **Expo SDK 55**.

## Prérequis

- Node.js ≥ 18
- npm ou yarn
- Expo Go (sur téléphone) **ou** émulateur Android/iOS

## Installation

```bash
cd LeoniMobile
npm install
```

## Démarrage

```bash
# Démarrer le serveur de développement
npm start
# ou
npx expo start

# Lancer sur Android
npm run android

# Lancer sur iOS
npm run ios
```

Avec **Expo Go** : scannez le QR code affiché dans le terminal.

## Configuration

Modifiez l'URL du serveur dans `src/api/index.js` :

```js
export const BASE_URL = 'http://VOTRE_IP:8080/api';
```

> Utilisez l'adresse IP locale de votre machine (pas `localhost`) pour que le téléphone physique puisse atteindre le serveur.

## Changements par rapport à React Native CLI

| Avant (RN CLI)                    | Après (Expo SDK 55)                     |
|-----------------------------------|-----------------------------------------|
| `react-native start`              | `expo start`                            |
| `react-native run-android`        | `expo run:android`                      |
| `StatusBar` de `react-native`     | `StatusBar` de `expo-status-bar`        |
| `@react-native/babel-preset`      | `babel-preset-expo`                     |
| `index.js` avec `AppRegistry`     | `index.js` avec `registerRootComponent` |
| Pas de `app.json`                 | `app.json` avec config Expo             |
| `react-native: 0.74.3`            | `react-native: 0.79.2` (Expo 55)       |

## Assets requis

Placez dans le dossier `assets/` :
- `icon.png` (1024x1024)
- `splash-icon.png` (200x200 minimum)
- `adaptive-icon.png` (1024x1024, pour Android)
- `favicon.png` (pour web)
