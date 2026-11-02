import { useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { useSession } from '@/contexts/auth-context';
import { Palette } from '@/constants/colors';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Mismo tamaño y fondo que el splash nativo (app.json, plugin expo-splash-screen): el cambio no se nota. */
const CREST_WIDTH = 140;
const CREST_HEIGHT = Math.round((CREST_WIDTH * 510) / 489);
const BACKGROUND = '#FFFFFF';

/** Tiempo mínimo en pantalla, para que la animación se vea aunque la sesión se restaure al instante. */
const MIN_VISIBLE_MS = 1_200;
const FADE_OUT_MS = 350;

/**
 * El splash nativo es una imagen fija: se oculta en cuanto la app monta y en su lugar queda este,
 * idéntico, pero con el escudo latiendo y un texto de estado, hasta que se restaura la sesión
 * guardada (o falla). Luego se desvanece y deja ver el login o la app.
 */
export function SplashScreenController() {
  const { isLoading } = useSession();
  const [minElapsed, setMinElapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [pulse] = useState(() => new Animated.Value(0));
  const [textIn] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    Animated.timing(textIn, { toValue: 1, duration: 500, delay: 150, useNativeDriver: true }).start();
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [pulse, textIn]);

  const ready = !isLoading && minElapsed;
  useEffect(() => {
    if (!ready) return;
    Animated.timing(opacity, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true }).start(() => setHidden(true));
  }, [ready, opacity]);

  if (hidden) return null;

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const translateY = textIn.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View
      style={[styles.overlay, { opacity }]}
      pointerEvents={ready ? 'none' : 'auto'}
      // Ya está pintado el reemplazo: recién ahora se quita el nativo, sin parpadeo
      onLayout={() => SplashScreen.hideAsync().catch(() => {})}
      accessibilityLabel="Cargando SiGAV">
      <Animated.View style={{ transform: [{ scale }] }}>
        <Image source={require('@/assets/images/brand/comipol-crest.png')} style={styles.crest} />
      </Animated.View>

      <Animated.View style={[styles.textBlock, { opacity: textIn, transform: [{ translateY }] }]}>
        <Text style={styles.title}>SiGAV</Text>
        <Text style={styles.subtitle}>{isLoading ? 'Verificando sesión…' : 'Listo'}</Text>
        <LoadingDots />
      </Animated.View>
    </Animated.View>
  );
}

/** Tres puntos que se encienden en secuencia. */
function LoadingDots() {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 3, duration: 1_200, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: progress.interpolate({
                inputRange: [i, i + 0.5, i + 1],
                outputRange: [0.25, 1, 0.25],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  crest: {
    width: CREST_WIDTH,
    height: CREST_HEIGHT,
  },
  // Debajo del escudo sin desplazarlo: el escudo queda donde lo dejó el splash nativo
  textBlock: {
    position: 'absolute',
    top: '50%',
    marginTop: CREST_HEIGHT / 2 + 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 2,
    color: Palette.primary[500],
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: Palette.neutral[600],
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Palette.primary[500],
  },
});
