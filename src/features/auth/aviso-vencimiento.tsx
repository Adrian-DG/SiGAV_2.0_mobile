import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { Card } from '@/components/ui/card';
import { Palette } from '@/constants/colors';
import { vencimientoToken } from '@/lib/jwt';

/** Desde cuándo se muestra el aviso en el inicio. */
const AVISO_MS = 30 * 60_000;
/** Desde cuándo, además, se interrumpe con un diálogo (una sola vez por sesión). */
const ALERTA_MS = 10 * 60_000;

const hora = (ms: number) => new Date(ms).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' });

/**
 * La sesión móvil no se renueva: al vencer el token la app vuelve al login. Se avisa antes para que
 * el agente envíe lo pendiente y no lo sorprenda a mitad de un evento.
 */
export function AvisoVencimiento({ token }: { token: string }) {
  const vence = vencimientoToken(token);
  const [ahora, setAhora] = useState(() => Date.now());
  const alertado = useRef(false);

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(intervalo);
  }, []);

  const restante = vence ? vence - ahora : null;

  useEffect(() => {
    if (!vence || restante === null || restante > ALERTA_MS || restante <= 0 || alertado.current) return;
    alertado.current = true;
    Alert.alert(
      'Su sesión está por vencer',
      `Vence a las ${hora(vence)}. Cierre y envíe los eventos que pueda. Al vencer deberá ingresar de nuevo con la misma cédula y ficha; lo que no haya enviado seguirá guardado en el teléfono.`,
    );
  }, [vence, restante]);

  if (!vence || restante === null || restante > AVISO_MS || restante <= 0) return null;

  const minutos = Math.max(1, Math.round(restante / 60_000));
  return (
    <Card style={styles.card} accessibilityRole="alert">
      <Text style={styles.titulo}>
        La sesión vence a las {hora(vence)} ({minutos === 1 ? '1 minuto' : `${minutos} minutos`})
      </Text>
      <Text style={styles.texto}>Envíe lo pendiente. Luego vuelva a ingresar con la misma cédula y ficha.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 4,
    backgroundColor: Palette.warning[50],
    borderColor: Palette.warning[200],
  },
  titulo: {
    fontSize: 14,
    fontWeight: '800',
    color: Palette.warning[900],
  },
  texto: {
    fontSize: 13,
    lineHeight: 18,
    color: Palette.warning[900],
  },
});
