const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const META_DATA = 'com.google.mlkit.vision.DEPENDENCIES';

/**
 * El reconocimiento de texto de Android (@dariyd/react-native-text-recognition) usa el modelo de
 * ML Kit que provee Google Play services, que por defecto se descarga recién la primera vez que se
 * usa: mientras no termina, el escaneo falla ("Waiting for the text recognition model to be
 * downloaded"). Con este meta-data Play services lo descarga al instalar la app.
 * https://developers.google.com/ml-kit/vision/text-recognition/v2/android
 *
 * expo-camera declara el mismo meta-data con "barcode_ui" (escáner de códigos): el manifest merger
 * no acepta dos valores distintos, así que aquí se declaran ambos modelos (lista separada por comas)
 * y tools:replace hace que este valor reemplace al de expo-camera.
 */
module.exports = function withMlkitOcr(config) {
  return withAndroidManifest(config, (cfg) => {
    AndroidConfig.Manifest.ensureToolsAvailable(cfg.modResults);
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, META_DATA, 'ocr,barcode_ui');
    const item = app['meta-data'].find((m) => m.$['android:name'] === META_DATA);
    item.$['tools:replace'] = 'android:value';
    return cfg;
  });
};
