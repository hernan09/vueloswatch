import { Alert, Linking } from "react-native";

export async function openDealUrl(url) {
  if (!url || typeof url !== "string") {
    Alert.alert("Sin link", "Esta oferta no trae URL del vuelo.");
    return;
  }

  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert("No se pudo abrir", url);
      return;
    }
    await Linking.openURL(url);
  } catch (err) {
    Alert.alert("Error al abrir link", err.message || String(err));
  }
}
