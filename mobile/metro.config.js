const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// The native and web venue editors execute the same pure geometry contract.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../assets/map-data'), path.resolve(__dirname, '../assets/discovery'), path.resolve(__dirname, '../assets/tickets'), path.resolve(__dirname, '../assets/operations'), path.resolve(__dirname, '../assets/events'), path.resolve(__dirname, '../assets/bookings'), path.resolve(__dirname, '../assets/priorities'), path.resolve(__dirname, '../assets/documents'), path.resolve(__dirname, '../assets/commerce'), path.resolve(__dirname, '../assets/organizations'), path.resolve(__dirname, '../assets/event-planner'), path.resolve(__dirname, '../assets/homes/templates/events'), path.resolve(__dirname, '../assets/homes/templates/music'), path.resolve(__dirname, '../assets/community'), path.resolve(__dirname, '../assets/homes'), path.resolve(__dirname, '../assets/enrichment'), path.resolve(__dirname, '../supabase/functions/zoi-enrich')];
// This exact shared browser edge carries a CDN version. Metro uses its source
// file; never normalize package names, arbitrary queries or traversal paths.
const previousResolver = config.resolver.resolveRequest;
const companyConsoleSource = path.resolve(__dirname, '../assets/operations/company-console-model.mjs');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (context.originModulePath === companyConsoleSource && moduleName === './company-journey.mjs?v=20261003-company-console') moduleName = './company-journey.mjs';
  return previousResolver ? previousResolver(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
