const fs = require("fs");
const path = require("path");

const hasGoogleServices = fs.existsSync(
  path.join(__dirname, "google-services.json")
);

/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const android = {
    ...(config.android || {}),
    package: "com.vueloswatch.app",
    // Necesario para hablar con el backend local por HTTP (no HTTPS)
    usesCleartextTraffic: true,
    permissions: [
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
      "POST_NOTIFICATIONS",
      "INTERNET",
    ],
  };

  if (hasGoogleServices) {
    android.googleServicesFile = "./google-services.json";
  }

  return {
    ...config,
    name: "VuelosWatch",
    slug: "vuelos-watch",
    scheme: "vueloswatch",
    android,
    plugins: [
      "expo-dev-client",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#0F766E",
          defaultChannel: "flights",
        },
      ],
    ],
    extra: {
      ...(config.extra || {}),
      apiUrl:
        process.env.EXPO_PUBLIC_API_URL ||
        config.extra?.apiUrl ||
        "http://192.168.0.12:3001",
      eas: {
        ...(config.extra?.eas || {}),
        projectId: config.extra?.eas?.projectId,
      },
    },
  };
};
