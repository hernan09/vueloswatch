import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * URL del backend.
 * Prioridad: EXPO_PUBLIC_API_URL → app.json extra.apiUrl → host de Expo → fallback.
 */
function guessHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost;

  if (hostUri) {
    return hostUri.split(":")[0];
  }

  if (Platform.OS === "android") return "10.0.2.2";
  return "localhost";
}

const extraUrl = Constants.expoConfig?.extra?.apiUrl;

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  extraUrl ||
  `http://${guessHost()}:3001`;

export const PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId ||
  Constants.easConfig?.projectId ||
  process.env.EXPO_PUBLIC_PROJECT_ID ||
  null;
