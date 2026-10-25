import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { Palette } from '@/constants/colors';

type Aviso = {
  mensaje: string;
  icono?: IconName;
  /** Acción de un toque, p. ej. "Deshacer" tras quitar un vehículo. */
  accion?: { label: string; onPress: () => void };
  /** Milisegundos en pantalla (por defecto 4 s; 6 s si tiene acción, para alcanzar a tocarla). */
  duracion?: number;
};

type ToastContextValue = { mostrar: (aviso: Aviso) => void };

const ToastContext = createContext<ToastContextValue>({ mostrar: () => {} });

export const useToast = () => useContext(ToastContext);

/**
 * Aviso breve abajo de la pantalla, por encima de la barra de acciones y del botón flotante.
 * Uno a la vez: el nuevo reemplaza al anterior.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [aviso, setAviso] = useState<(Aviso & { id: number }) | null>(null);
  const siguienteId = useRef(0);

  const mostrar = useCallback((nuevo: Aviso) => setAviso({ ...nuevo, id: ++siguienteId.current }), []);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), aviso.duracion ?? (aviso.accion ? 6000 : 4000));
    return () => clearTimeout(timer);
  }, [aviso]);

  const value = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {aviso && (
        <View pointerEvents="box-none" style={[styles.contenedor, { bottom: insets.bottom + 104 }]}>
          <View style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {!!aviso.icono && <Icon name={aviso.icono} color={Palette.secondary[300]} size={22} />}
            <Text style={styles.mensaje}>{aviso.mensaje}</Text>
            {aviso.accion && (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  aviso.accion!.onPress();
                  setAviso(null);
                }}
                style={({ pressed }) => [styles.accion, pressed && styles.pressed]}>
                <Text style={styles.accionTexto}>{aviso.accion.label}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  contenedor: { position: 'absolute', left: 16, right: 16 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Palette.neutral[900],
    shadowColor: Palette.black,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  mensaje: { flex: 1, fontSize: 15, fontWeight: '600', color: Palette.white },
  accion: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8 },
  accionTexto: { fontSize: 15, fontWeight: '800', color: Palette.accent[300], textTransform: 'uppercase' },
  pressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
});
