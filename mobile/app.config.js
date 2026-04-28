/**
 * Merges EAS project id for Expo Push (required by getExpoPushTokenAsync).
 * Set EXPO_PUBLIC_EAS_PROJECT_ID in .env after `eas init`, or add extra.eas.projectId in app.json.
 */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    eas: {
      ...(config.extra?.eas ?? {}),
      projectId:
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? config.extra?.eas?.projectId,
    },
  },
});
