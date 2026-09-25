// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite en web usa wa-sqlite (WebAssembly): sin esto Metro no resuelve wa-sqlite.wasm y el
// bundle web falla ("Unable to resolve module ./wa-sqlite/wa-sqlite.wasm").
// https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
config.resolver.assetExts.push('wasm');

module.exports = config;
