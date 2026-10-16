// Fresh iOS app record. The installed app remains named Zoi.
// app.json remains the source for the production identity and every capability.
module.exports = ({config}) => {
  const flag = process.env.ZOI_IOS_FOUNDER_RELEASE;
  const profile = process.env.EAS_BUILD_PROFILE;
  if (flag !== undefined && flag !== '0' && flag !== '1') {
    throw new Error('ZOI_IOS_FOUNDER_RELEASE must be 0 or 1.');
  }
  if (profile === 'founder-testflight' && flag !== '1') {
    throw new Error('The founder TestFlight profile requires its explicit iOS identity.');
  }
  if (flag !== '1') return config;
  if ((profile && profile !== 'founder-testflight') ||
      (process.env.EAS_BUILD_PLATFORM && process.env.EAS_BUILD_PLATFORM !== 'ios')) {
    throw new Error('The fresh Zoi identity is limited to its iOS TestFlight profile.');
  }
  if (config.name !== 'Zoi' || config.ios?.bundleIdentifier !== 'com.usgreekscan.zoi') {
    throw new Error('The canonical Zoi identity changed; review the testing variant before building.');
  }
  return {...config, ios: {...config.ios, bundleIdentifier: 'city.zoi.app'}};
};
