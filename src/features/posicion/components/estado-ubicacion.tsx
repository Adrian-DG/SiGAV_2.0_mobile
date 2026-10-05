import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/colors';

import { iniciarSeguimiento, pedirPermisoSegundoPlano, useSeguimiento, type EstadoSeguimiento } from '../seguimiento';

/** Se explica y se pide "Todo el tiempo" una sola vez por apertura de la app; después queda el botón. */
let yaSePidio = false;

function explicarYPedir(): void {
  yaSePidio = true;
  Alert.alert(
    'Ubicación durante el turno',
    'Para que el centro de control vea dónde está la unidad aunque la pantalla esté bloqueada, permita la ubicación "Todo el tiempo". ' +
      'Solo se comparte mientras tenga la sesión abierta y deja de enviarse al cerrar sesión.',
    [
      { text: 'Ahora no', style: 'cancel' },
      { text: 'Permitir', onPress: () => void pedirPermisoSegundoPlano() },
    ],
  );
}

function hace(ms: number, ahora: number): string {
  const s = Math.max(0, Math.round((ahora - ms) / 1000));
  return s < 60 ? `hace ${s} s` : `hace ${Math.floor(s / 60)} min`;
}

type Presentacion = { color: string; fondo: string; texto: string; accion?: { label: string; onPress: () => void } };

function presentar(estado: EstadoSeguimiento, token: string, ahora: number): Presentacion | null {
  // En web (solo desarrollo) no hay ajustes que abrir
  const abrirAjustes = Platform.OS === 'web' ? undefined : { label: 'Abrir ajustes', onPress: () => void Linking.openSettings() };
  switch (estado.modo) {
    case 'inactivo':
      return null;
    case 'segundo_plano':
      return {
        color: Palette.success[600],
        fondo: Palette.success[50],
        texto: `Compartiendo la ubicación de la unidad${estado.ultimoEnvio ? ` · ${hace(estado.ultimoEnvio, ahora)}` : ''}`,
      };
    case 'primer_plano':
      return {
        color: Palette.warning[800],
        fondo: Palette.warning[50],
        texto: 'La ubicación solo se comparte con la app abierta.',
        accion: estado.puedePedirPermiso ? { label: 'Permitir siempre', onPress: explicarYPedir } : abrirAjustes,
      };
    case 'sin_permiso':
      return {
        color: Palette.danger[700],
        fondo: Palette.danger[50],
        texto: 'Sin permiso de ubicación: el centro de control no ve la unidad.',
        accion: estado.puedePedirPermiso ? { label: 'Permitir', onPress: () => void iniciarSeguimiento(token) } : abrirAjustes,
      };
    case 'detenido':
      return {
        color: Palette.danger[700],
        fondo: Palette.danger[50],
        texto: `No se está compartiendo la ubicación. ${estado.mensaje ?? ''}`.trim(),
        accion: { label: 'Reintentar', onPress: () => void iniciarSeguimiento(token) },
      };
  }
}

/** Franja del inicio con el estado del envío de la ubicación de la unidad. */
export function EstadoUbicacion({ token }: { token: string }) {
  const estado = useSeguimiento();
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 15_000);
    return () => clearInterval(reloj);
  }, []);

  // Recién iniciada la sesión sin "Todo el tiempo": se explica y se pide una vez
  useEffect(() => {
    if (estado.modo === 'primer_plano' && estado.puedePedirPermiso && !yaSePidio) explicarYPedir();
  }, [estado.modo, estado.puedePedirPermiso]);

  const p = presentar(estado, token, Math.max(ahora, estado.ultimoEnvio ?? 0));
  if (!p) return null;

  return (
    <View style={[styles.franja, { backgroundColor: p.fondo }]} accessibilityRole="summary">
      <View style={[styles.punto, { backgroundColor: p.color }]} />
      <Text style={[styles.texto, { color: p.color }]}>{p.texto}</Text>
      {p.accion && (
        <Pressable accessibilityRole="button" onPress={p.accion.onPress} hitSlop={8}>
          <Text style={[styles.accion, { color: p.color }]}>{p.accion.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  franja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  punto: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  texto: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  accion: {
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
