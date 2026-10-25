import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

type NombreSimbolo = ComponentProps<typeof SymbolView>['name'];

/**
 * Íconos de la app: SF Symbols en iOS y Material Symbols en Android (fuente incluida en la app,
 * funciona sin conexión). Se dibujan igual en todos los teléfonos, a diferencia de los emoji.
 */
const ICONOS = {
  agregar: { ios: 'plus', android: 'add' },
  alerta: { ios: 'exclamationmark.triangle', android: 'warning' },
  atras: { ios: 'chevron.left', android: 'arrow_back' },
  camara: { ios: 'camera.fill', android: 'photo_camera' },
  cerrar: { ios: 'xmark', android: 'close' },
  check: { ios: 'checkmark', android: 'check' },
  copiar: { ios: 'doc.on.doc', android: 'content_copy' },
  editar: { ios: 'pencil', android: 'edit' },
  error: { ios: 'exclamationmark.circle.fill', android: 'error' },
  exito: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  quitar: { ios: 'trash', android: 'delete' },
  recargar: { ios: 'arrow.clockwise', android: 'refresh' },
  salir: { ios: 'power', android: 'power_settings_new' },
  ubicacion: { ios: 'location.fill', android: 'location_on' },
  ubicacionBuscando: { ios: 'location', android: 'location_searching' },
  ubicacionNo: { ios: 'location.slash', android: 'location_off' },
  vacio: { ios: 'tray', android: 'inbox' },
  vehiculo: { ios: 'car.fill', android: 'directions_car' },
} satisfies Record<string, NombreSimbolo>;

export type IconName = keyof typeof ICONOS;

type IconProps = {
  name: IconName;
  color: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, color, size = 22, style }: IconProps) {
  return <SymbolView name={ICONOS[name]} tintColor={color} size={size} style={style} />;
}
