const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

/**
 * El reconocimiento de texto de Android (@dariyd/react-native-text-recognition) usa el modelo de
 * ML Kit que provee Google Play services, que por defecto se descarga recién la primera vez que se
 * usa: mientras no termina, el escaneo falla ("Waiting for the text recognition model to be
 * downloaded"). Con este meta-data Play services lo descarga al instalar la app.
 * https://developers.google.com/ml-kit/vision/text-recognition/v2/android
 */
module.exports = function withMlkitOcr(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'com.google.mlkit.vision.DEPENDENCIES', 'ocr');
    return cfg;
  });
};
