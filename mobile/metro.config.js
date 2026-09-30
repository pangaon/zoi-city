const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// The native and web venue editors execute the same pure geometry contract.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../assets/tickets'), path.resolve(__dirname, '../assets/bookings'), path.resolve(__dirname, '../assets/priorities'), path.resolve(__dirname, '../assets/documents'), path.resolve(__dirname, '../assets/commerce'), path.resolve(__dirname, '../assets/organizations'), path.resolve(__dirname, '../assets/event-planner'), path.resolve(__dirname, '../assets/homes/templates/events'), path.resolve(__dirname, '../assets/homes/templates/music'), path.resolve(__dirname, '../assets/community')];
module.exports = config;
