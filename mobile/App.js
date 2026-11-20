import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  registerForPushNotifications,
  addNotificationListeners,
  showLocalDealNotification,
} from "./src/notifications";
import {
  registerDevice,
  createAlert,
  fetchAlerts,
  deleteAlert,
  checkNow,
  health,
} from "./src/api";
import { API_URL } from "./src/config";
import { openDealUrl } from "./src/openDeal";

const TOKEN_KEY = "deviceToken";
const MODE_KEY = "notifyMode";

function Badge({ label, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: color || "#0F766E" }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        autoCapitalize="characters"
        keyboardType={keyboardType || "default"}
      />
    </View>
  );
}

async function getOrCreateLocalDeviceId() {
  const existing = await AsyncStorage.getItem(TOKEN_KEY);
  if (existing && existing.startsWith("LocalDevice[")) return existing;
  const id = `LocalDevice[${Date.now().toString(36)}]`;
  await AsyncStorage.setItem(TOKEN_KEY, id);
  return id;
}

export default function App() {
  const [token, setToken] = useState(null);
  const [mode, setMode] = useState("remote");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [form, setForm] = useState({
    origin: "BUE",
    destination: "FLN",
    departDate: "2026-06-04",
    returnDate: "2026-06-11",
    maxPrice: "900",
  });

  const refreshAlerts = useCallback(async (deviceToken) => {
    if (!deviceToken) return;
    const data = await fetchAlerts(deviceToken);
    setAlerts(data.alerts || []);
  }, []);

  useEffect(() => {
    let cleanup = () => {};

    (async () => {
      try {
        setStatusMsg("Pediendo permisos de notificación...");
        const result = await registerForPushNotifications();

        let deviceToken = result.token;
        let notifyMode = result.mode;

        if (notifyMode === "local" || !deviceToken) {
          deviceToken = await getOrCreateLocalDeviceId();
          notifyMode = "local";
        }

        setToken(deviceToken);
        setMode(notifyMode);
        await AsyncStorage.setItem(TOKEN_KEY, deviceToken);
        await AsyncStorage.setItem(MODE_KEY, notifyMode);
        await registerDevice(deviceToken, Platform.OS, notifyMode);

        try {
          const h = await health();
          setStatusMsg(
            `${result.message}\nAPI ${API_URL} · ${h.provider} · modo ${notifyMode}`
          );
        } catch {
          setStatusMsg(
            `${result.message}\nNo llega al backend (${API_URL}). Revisá IP/WiFi.`
          );
        }

        await refreshAlerts(deviceToken);
      } catch (err) {
        // Si falla el token remoto, igual entramos en modo local
        try {
          const localId = await getOrCreateLocalDeviceId();
          setToken(localId);
          setMode("local");
          await registerDevice(localId, Platform.OS, "local");
          setStatusMsg(
            `${err.message}\nEntraste en modo local: podés crear alertas y usar Chequear ahora.`
          );
          await refreshAlerts(localId);
        } catch (fallbackErr) {
          setStatusMsg(`${err.message} · ${fallbackErr.message}`);
        }
      } finally {
        setLoading(false);
      }
    })();

    cleanup = addNotificationListeners({
      onReceive: (notification) => {
        const data = notification.request.content.data || {};
        setInbox((prev) =>
          [
            {
              id: `${Date.now()}`,
              title: notification.request.content.title,
              body: notification.request.content.body,
              badgeLabel: data.badgeLabel || data.platformBadge || "VUELO",
              platformColor:
                data.platformBadge === "DESP" ? "#5603AD" : "#0F766E",
              url: data.url || null,
              at: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 30)
        );
      },
      onRespond: (response) => {
        const data = response.notification.request.content.data || {};
        if (data.url) openDealUrl(String(data.url));
      },
    });

    // Si abrió la app tocando una push (app cerrada)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const url = response?.notification?.request?.content?.data?.url;
      if (url) openDealUrl(String(url));
    });

    return () => cleanup();
  }, [refreshAlerts]);

  const onChange = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const runCheck = async () => {
    if (!token) return [];
    setStatusMsg("Buscando ofertas...");
    const data = await checkNow(token);
    const matches = data.matches || [];
    let notifOk = 0;

    for (const item of matches.slice(0, 5)) {
      // La lista de la app siempre se actualiza, aunque falle la notificación del sistema
      setInbox((prev) =>
        [
          {
            id: `${Date.now()}-${item.deal.id}`,
            title: `${item.deal.platformBadge} · ${item.deal.origin}→${item.deal.destination}`,
            body: `${item.deal.airline} · US$ ${Number(
              item.deal.price
            ).toLocaleString("en-US")} · Tocá para abrir`,
            badgeLabel: `${item.deal.platformBadge}:${item.deal.airlineBadge}`,
            platformColor: item.deal.platformColor || "#0F766E",
            url: item.deal.url || null,
            at: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 30)
      );

      try {
        const shown = await showLocalDealNotification(item.deal, item.alert);
        if (shown) notifOk += 1;
      } catch {
        // ignore: ya está en el inbox de la app
      }
    }

    setStatusMsg(
      matches.length
        ? `OK · ${matches.length} oferta(s) bajo el tope (USD)${
            notifOk ? ` · ${notifOk} notificación(es)` : " · mirá la lista abajo"
          }.`
        : "OK · sin ofertas bajo el tope en este chequeo."
    );
    return matches;
  };

  const onSubmit = async () => {
    if (!token) {
      Alert.alert("Sin dispositivo", "Todavía no hay ID de dispositivo.");
      return;
    }

    setSaving(true);
    try {
      await createAlert({
        expoPushToken: token,
        mode,
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        departDate: form.departDate.trim(),
        returnDate: form.returnDate.trim() || null,
        maxPrice: Number(
          String(form.maxPrice).replace(/\./g, "").replace(",", ".")
        ),
        currency: "USD",
      });
      await refreshAlerts(token);

      let matches = [];
      try {
        matches = await runCheck();
      } catch (checkErr) {
        const msg = String(checkErr.message || checkErr);
        const isNotifBug = /notificationchannel|nullpointer/i.test(msg);
        Alert.alert(
          "Alerta creada",
          isNotifBug
            ? "Se guardó bien. El aviso del sistema falló (bug de Expo Go en Android), pero las ofertas deberían verse en la lista de la app. Tocá Chequear ahora."
            : `Se guardó bien, pero el chequeo falló: ${msg}\n\nSi es 404, reiniciá el backend.`
        );
        return;
      }

      Alert.alert(
        "Alerta creada (USD)",
        matches.length
          ? `Encontré ${matches.length} oferta(s). Mirá la lista "Notificaciones recibidas" abajo.`
          : "Guardada. No hubo ofertas bajo el tope ahora; tocá Chequear ahora."
      );
    } catch (err) {
      Alert.alert("Error al crear", err.message);
    } finally {
      setSaving(false);
    }
  };

  const onCheckNow = async () => {
    try {
      const matches = await runCheck();
      if (!matches.length) {
        Alert.alert("Sin matches", "No hay ofertas bajo tu tope en USD ahora.");
      }
    } catch (err) {
      const msg = String(err.message || err);
      Alert.alert(
        "Error al chequear",
        /notificationchannel|nullpointer/i.test(msg)
          ? "Bug de notificaciones de Expo Go en Android. Las ofertas igual pueden aparecer en la lista de la app."
          : `${msg}\n\nSi dice 404, reiniciá el backend.`
      );
    }
  };

  const onDelete = async (id) => {
    try {
      await deleteAlert(id, token);
      await refreshAlerts(token);
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.muted}>{statusMsg || "Iniciando..."}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>VuelosWatch</Text>
          <Text style={styles.subtitle}>
            Configurá origen, fechas y tope. El servidor busca ofertas y te
            avisa con notificaciones.
          </Text>

          <View
            style={[
              styles.banner,
              mode === "local" ? styles.bannerWarn : styles.bannerOk,
            ]}
          >
            <Text style={styles.bannerText}>{statusMsg}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Nueva alerta</Text>
            <Text style={styles.hint}>
              IATA = código de aeropuerto o ciudad (3 letras), no del país.
              {"\n"}Florianópolis = FLN · Buenos Aires = BUE · San Pablo = GRU ·
              Río = GIG.
              {"\n"}
              Brasil no es BRA: siempre usá la ciudad (ej. FLN).
            </Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Origen (aeropuerto/ciudad)"
                  value={form.origin}
                  onChangeText={onChange("origin")}
                  placeholder="BUE"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Field
                  label="Destino (aeropuerto/ciudad)"
                  value={form.destination}
                  onChangeText={onChange("destination")}
                  placeholder="FLN"
                />
              </View>
            </View>
            <Field
              label="Ida (AAAA-MM-DD)"
              value={form.departDate}
              onChangeText={onChange("departDate")}
              placeholder="2026-06-04"
            />
            <Field
              label="Vuelta (opcional)"
              value={form.returnDate}
              onChangeText={onChange("returnDate")}
              placeholder="2026-06-11"
            />
            <Field
              label="Tope de dinero (USD)"
              value={form.maxPrice}
              onChangeText={onChange("maxPrice")}
              placeholder="900"
              keyboardType="numeric"
            />

            <Pressable
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={saving}
            >
              <Text style={styles.buttonText}>
                {saving ? "Guardando..." : "Activar alerta"}
              </Text>
            </Pressable>

            <Pressable style={styles.secondaryBtn} onPress={onCheckNow}>
              <Text style={styles.secondaryText}>Chequear ahora</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>Alertas activas</Text>
          {alerts.length === 0 ? (
            <Text style={styles.muted}>Todavía no hay alertas.</Text>
          ) : (
            alerts.map((a) => (
              <View key={a.id} style={styles.alertRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>
                    {a.origin} → {a.destination}
                  </Text>
                  <Text style={styles.muted}>
                    {a.departDate}
                    {a.returnDate ? ` · ${a.returnDate}` : ""}
                    {" · tope US$ "}
                    {Number(a.maxPrice).toLocaleString("en-US")}
                  </Text>
                </View>
                <Pressable onPress={() => onDelete(a.id)}>
                  <Text style={styles.delete}>Borrar</Text>
                </Pressable>
              </View>
            ))
          )}

          <Text style={[styles.section, { marginTop: 24 }]}>
            Notificaciones recibidas
          </Text>
          {inbox.length === 0 ? (
            <Text style={styles.muted}>
              Acá van a aparecer las notificaciones con badges.
            </Text>
          ) : (
            <FlatList
              data={inbox}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.inboxRow}
                  onPress={() => openDealUrl(item.url)}
                >
                  <Badge label={item.badgeLabel} color={item.platformColor} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.alertTitle}>{item.title}</Text>
                    <Text style={styles.muted}>{item.body}</Text>
                    {item.url ? (
                      <Text style={styles.linkHint}>Abrir vuelo →</Text>
                    ) : null}
                  </View>
                </Pressable>
              )}
            />
          )}

          <Text style={styles.footer}>
            API: {API_URL}
            {"\n"}
            Modo: {mode}
            {"\n"}
            {token ? `Device: ${token.slice(0, 36)}…` : "Sin device"}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  container: { padding: 20, paddingBottom: 48 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    padding: 24,
  },
  brand: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
  },
  hint: {
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  banner: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
  },
  bannerWarn: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
  },
  bannerOk: {
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#99F6E4",
  },
  bannerText: { fontSize: 12, color: "#334155", lineHeight: 18 },
  card: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  section: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
    marginTop: 8,
  },
  row: { flexDirection: "row" },
  field: { marginBottom: 12 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0F172A",
  },
  button: {
    marginTop: 4,
    backgroundColor: "#0F766E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#99F6E4",
    backgroundColor: "#F0FDFA",
  },
  secondaryText: { color: "#0F766E", fontWeight: "700" },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  alertTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  delete: { color: "#DC2626", fontWeight: "600", padding: 8 },
  muted: { color: "#64748B", fontSize: 13, lineHeight: 18 },
  inboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 56,
    alignItems: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  linkHint: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#0F766E",
  },
  footer: {
    marginTop: 28,
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 16,
  },
});
