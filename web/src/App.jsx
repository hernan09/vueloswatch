import { useCallback, useEffect, useState } from "react";
import {
  health,
  registerDevice,
  createAlert,
  fetchAlerts,
  deleteAlert,
  checkNow,
  getVapidPublicKey,
  subscribeWebPush,
} from "./api";
import {
  ensureServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
  showLocalNotification,
} from "./notifications";

const DEVICE_KEY = "vueloswatch_device_id";

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (id && id.startsWith("WebDevice[")) return id;
  id = `WebDevice[${Date.now().toString(36)}]`;
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

function moneyUSD(n) {
  return `US$ ${Number(n).toLocaleString("en-US")}`;
}

export default function App() {
  const [deviceId, setDeviceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [warn, setWarn] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [form, setForm] = useState({
    origin: "BUE",
    destination: "FLN",
    departDate: "2026-06-04",
    returnDate: "2026-06-11",
    maxPrice: "900",
  });

  const refreshAlerts = useCallback(async (id) => {
    if (!id) return;
    const data = await fetchAlerts(id);
    setAlerts(data.alerts || []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const id = getOrCreateDeviceId();
        setDeviceId(id);
        setStatusMsg("Pediendo permisos de notificación...");

        await requestNotificationPermission();
        const reg = await ensureServiceWorker();
        await registerDevice(id, "web", "web");

        try {
          const { publicKey } = await getVapidPublicKey();
          const sub = await subscribeToPush(reg, publicKey);
          if (sub) {
            await subscribeWebPush(id, sub.toJSON());
            setStatusMsg("Web Push activo. Podés recibir avisos aunque cierres la pestaña (Chrome/Android).");
            setWarn(false);
          } else {
            setStatusMsg("Notificaciones locales OK. Web Push no disponible en este navegador.");
            setWarn(true);
          }
        } catch (pushErr) {
          setStatusMsg(
            `App lista. Push remota limitada: ${pushErr.message}. Igual podés chequear ofertas.`
          );
          setWarn(true);
        }

        try {
          const h = await health();
          setStatusMsg((prev) => `${prev}\nAPI OK · ${h.provider} · ${h.alerts} alerta(s) global(es)`);
        } catch {
          setStatusMsg((prev) => `${prev}\nNo llega al backend. ¿Está corriendo en la Mac?`);
          setWarn(true);
        }

        await refreshAlerts(id);
      } catch (err) {
        setStatusMsg(err.message);
        setWarn(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshAlerts]);

  const onChange = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const pushMatchesToInbox = (matches) => {
    for (const item of matches.slice(0, 5)) {
      const badge = `${item.deal.platformBadge}:${item.deal.airlineBadge}`;
      const title = `${badge} · ${item.deal.origin}→${item.deal.destination} · ${moneyUSD(item.deal.price)}`;
      const body = `${item.deal.airline} en ${item.deal.platform} · Tocá para abrir`;

      showLocalNotification({
        title,
        body,
        url: item.deal.url,
        badgeLabel: badge,
      });

      setInbox((prev) =>
        [
          {
            id: `${Date.now()}-${item.deal.id}`,
            title,
            body,
            badgeLabel: badge,
            color: item.deal.platformColor || "#0F766E",
            url: item.deal.url,
          },
          ...prev,
        ].slice(0, 30)
      );
    }
  };

  const runCheck = async () => {
    setStatusMsg("Buscando ofertas...");
    const data = await checkNow(deviceId);
    const matches = data.matches || [];
    pushMatchesToInbox(matches);
    setStatusMsg(
      matches.length
        ? `OK · ${matches.length} oferta(s) bajo el tope (USD).`
        : "OK · sin ofertas bajo el tope en este chequeo."
    );
    setWarn(false);
    return matches;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!deviceId) return;
    setSaving(true);
    try {
      await createAlert({
        expoPushToken: deviceId,
        mode: "web",
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        departDate: form.departDate.trim(),
        returnDate: form.returnDate.trim() || null,
        maxPrice: Number(String(form.maxPrice).replace(",", ".")),
        currency: "USD",
      });
      await refreshAlerts(deviceId);
      const matches = await runCheck();
      alert(
        matches.length
          ? `Alerta creada. Encontré ${matches.length} oferta(s).`
          : "Alerta creada. No hubo ofertas bajo el tope ahora."
      );
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const onCheckNow = async () => {
    try {
      const matches = await runCheck();
      if (!matches.length) alert("Sin matches bajo tu tope en USD.");
    } catch (err) {
      alert(`Error al chequear: ${err.message}`);
    }
  };

  const onDelete = async (id) => {
    try {
      await deleteAlert(id, deviceId);
      await refreshAlerts(deviceId);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="app center">
        <h1 className="brand">VuelosWatch</h1>
        <p className="muted">{statusMsg || "Cargando..."}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <h1 className="brand">VuelosWatch</h1>
      <p className="subtitle">
        Webapp de alertas de vuelos. Misma lógica que antes: fechas, destino y
        tope en USD. El servidor busca ofertas y te avisa.
      </p>

      <div className={`banner ${warn ? "warn" : ""}`}>{statusMsg}</div>

      <form className="card" onSubmit={onSubmit}>
        <h2 className="section">Nueva alerta</h2>
        <p className="hint">
          IATA = aeropuerto/ciudad (3 letras), no el país.
          <br />
          Florianópolis = <strong>FLN</strong> · Buenos Aires = <strong>BUE</strong>
        </p>

        <div className="row">
          <div className="field">
            <label>Origen</label>
            <input value={form.origin} onChange={onChange("origin")} placeholder="BUE" />
          </div>
          <div className="field">
            <label>Destino</label>
            <input
              value={form.destination}
              onChange={onChange("destination")}
              placeholder="FLN"
            />
          </div>
        </div>

        <div className="field">
          <label>Ida (AAAA-MM-DD)</label>
          <input
            type="date"
            value={form.departDate}
            onChange={onChange("departDate")}
          />
        </div>
        <div className="field">
          <label>Vuelta</label>
          <input
            type="date"
            value={form.returnDate}
            onChange={onChange("returnDate")}
          />
        </div>
        <div className="field">
          <label>Tope (USD)</label>
          <input
            inputMode="decimal"
            value={form.maxPrice}
            onChange={onChange("maxPrice")}
            placeholder="900"
          />
        </div>

        <div className="actions">
          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Activar alerta"}
          </button>
          <button className="secondary" type="button" onClick={onCheckNow}>
            Chequear ahora
          </button>
        </div>
      </form>

      <h2 className="section">Alertas activas</h2>
      {alerts.length === 0 ? (
        <p className="muted">Todavía no hay alertas.</p>
      ) : (
        alerts.map((a) => (
          <div className="alert-row" key={a.id}>
            <div className="meta">
              <p className="alert-title">
                {a.origin} → {a.destination}
              </p>
              <p className="muted">
                {a.departDate}
                {a.returnDate ? ` · ${a.returnDate}` : ""} · tope{" "}
                {moneyUSD(a.maxPrice)}
              </p>
            </div>
            <button className="delete" type="button" onClick={() => onDelete(a.id)}>
              Borrar
            </button>
          </div>
        ))
      )}

      <h2 className="section" style={{ marginTop: 24 }}>
        Ofertas encontradas
      </h2>
      {inbox.length === 0 ? (
        <p className="muted">Acá aparecen las ofertas con link al vuelo.</p>
      ) : (
        inbox.map((item) => (
          <a
            key={item.id}
            className="inbox-row"
            href={item.url || "#"}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span className="badge" style={{ background: item.color }}>
              {item.badgeLabel}
            </span>
            <div className="meta">
              <p className="alert-title">{item.title}</p>
              <p className="muted">{item.body}</p>
              {item.url ? <span className="link">Abrir vuelo →</span> : null}
            </div>
          </a>
        ))
      )}

      <p className="footer">
        Modo: web
        <br />
        Device: {deviceId}
        <br />
        Tip Xiaomi: en Chrome → menú → “Instalar app” / “Agregar a pantalla de
        inicio” para usarla como PWA.
      </p>
    </div>
  );
}
