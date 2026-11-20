import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let channelsReady = false;

async function ensureAndroidChannels() {
  if (Platform.OS !== "android" || channelsReady) return true;

  try {
    await Notifications.setNotificationChannelAsync("flights", {
      name: "Ofertas de vuelos",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0F766E",
    });

    await Notifications.setNotificationChannelAsync("despegar", {
      name: "Despegar",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: "#5603AD",
    });

    channelsReady = true;
    return true;
  } catch (err) {
    // En algunos Android/Expo Go setNotificationChannelAsync tira NullPointerException.
    // Seguimos igual: la notificación local puede ir por el canal default.
    console.warn("[notifications] channels fallaron:", err?.message || err);
    channelsReady = false;
    return false;
  }
}

function resolveProjectId() {
  const id =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    process.env.EXPO_PUBLIC_PROJECT_ID ||
    null;
  if (!id || id === "REPLACE_AFTER_EAS_INIT") return null;
  return id;
}

function isExpoGo() {
  return Constants.appOwnership === "expo";
}

function moneyUSD(amount) {
  return `US$ ${Number(amount).toLocaleString("en-US")}`;
}

export async function showLocalDealNotification(deal, alert) {
  const badge = `${deal.platformBadge || "VUELO"}:${deal.airlineBadge || "XX"}`;
  const title = `${badge} · ${deal.origin}→${deal.destination} · ${moneyUSD(deal.price)}`;
  const body = `${deal.airline} en ${deal.platform} · tope ${moneyUSD(alert.maxPrice)} · Tocá para abrir`;
  const data = {
    badgeLabel: badge,
    type: "flight_deal_local",
    platformBadge: deal.platformBadge,
    airlineBadge: deal.airlineBadge,
    price: deal.price,
    origin: deal.origin,
    destination: deal.destination,
    url: deal.url || null,
  };

  const channelsOk = await ensureAndroidChannels();

  const contentBase = {
    title,
    body,
    data,
    sound: true,
  };

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        ...contentBase,
        ...(Platform.OS === "android" && channelsOk
          ? {
              channelId:
                deal.platformBadge === "DESP" ? "despegar" : "flights",
            }
          : {}),
      },
      trigger: null,
    });
    return true;
  } catch (err) {
    // Reintento sin channelId (canal default del sistema)
    try {
      await Notifications.scheduleNotificationAsync({
        content: contentBase,
        trigger: null,
      });
      return true;
    } catch (err2) {
      console.warn(
        "[notifications] no se pudo mostrar local:",
        err2?.message || err2
      );
      return false;
    }
  }
}

/**
 * Intenta obtener ExponentPushToken.
 * En Android + Expo Go (SDK 53+) las push remotas NO suelen: hay que usar
 * development build. En ese caso devolvemos mode:"local".
 */
export async function registerForPushNotifications() {
  await ensureAndroidChannels();

  if (!Device.isDevice) {
    throw new Error(
      "Las push remotas requieren un celular físico (no emulador/simulador)."
    );
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    throw new Error(
      "Permiso de notificaciones denegado. Activalo en Ajustes del celular."
    );
  }

  if (Platform.OS === "android" && isExpoGo()) {
    return {
      mode: "local",
      token: null,
      message:
        "Android + Expo Go: push remotas limitadas. Usá 'Chequear ahora'; las ofertas aparecen en la lista de la app.",
    };
  }

  const projectId = resolveProjectId();
  if (!projectId) {
    throw new Error(
      "Falta projectId de Expo (EAS). Corré en la carpeta mobile: npx eas init"
    );
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return {
      mode: "remote",
      token: tokenResponse.data,
      message: "Push remotas activas",
    };
  } catch (err) {
    const detail = err?.message || String(err);
    if (Platform.OS === "android" && isExpoGo()) {
      return {
        mode: "local",
        token: null,
        message: `Modo local activo. Detalle: ${detail}`,
      };
    }
    throw new Error(`No se pudo obtener push token: ${detail}`);
  }
}

export function addNotificationListeners({ onReceive, onRespond }) {
  const received = Notifications.addNotificationReceivedListener((n) => {
    onReceive?.(n);
  });
  const response = Notifications.addNotificationResponseReceivedListener((r) => {
    onRespond?.(r);
  });

  return () => {
    received.remove();
    response.remove();
  };
}
