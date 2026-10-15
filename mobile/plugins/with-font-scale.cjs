const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

// React Native handles font updates without discarding the active map or form.
module.exports = function withFontScale(config) {
  return withAndroidManifest(config, mod => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    const existing = activity.$['android:configChanges'];
    if (typeof existing !== 'string' || !existing.trim()) {
      throw new Error('Expected the existing MainActivity configuration flags');
    }
    const flags = existing.split('|');
    if (!flags.includes('fontScale')) {
      activity.$['android:configChanges'] = [...flags, 'fontScale'].join('|');
    }
    return mod;
  });
};
