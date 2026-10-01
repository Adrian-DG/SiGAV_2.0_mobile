import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CategoriaBadge } from '@/components/ui/categoria-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tag } from '@/components/ui/tag';
import { Palette } from '@/constants/colors';
import { CompletarEventoSheet } from '@/features/events/components/completar-evento-sheet';
import type { EventoLocalListItem } from '@/features/events/local/eventos-local';

function formatFecha(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

type EventCardProps = {
  item: EventoLocalListItem;
  onEditar: () => void;
  /** Guarda el tipo de cierre en el dispositivo (el evento pasa a "por enviar"). */
  onCerrar: (tipoCierreId: number) => Promise<void>;
  /** Envía el evento cerrado a la API. */
  onEnviar: () => Promise<void>;
};

/**
 * Evento guardado en el dispositivo. Acciones según su estatus:
 *  - en curso:   Editar · Cerrar
 *  - por enviar: Editar · Enviar (y cambiar el tipo de cierre)
 *  - enviado:    solo lectura
 */
export function EventCard({ item, onEditar, onCerrar, onEnviar }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [cerrarVisible, setCerrarVisible] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    try {
      await onEnviar();
    } catch {
      // El motivo queda guardado en el evento y se muestra en la tarjeta tras recargar
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.header}>
        <View style={styles.headerText}>
          <View style={styles.categorias}>
            {item.categorias.map((categoria) => (
              <CategoriaBadge key={categoria} categoria={categoria} />
            ))}
          </View>
          <View style={styles.tags}>
            {item.tipos.length > 0 ? (
              item.tipos.map((tipo) => <Tag key={tipo} label={tipo} />)
            ) : (
              <Text style={styles.tipos}>Evento</Text>
            )}
          </View>
          <Text style={styles.fecha}>{formatFecha(item.fechaHoraReporte)}</Text>
        </View>
        <View style={styles.badges}>
          <StatusBadge estado={item.estado} />
          {item.estatus === 'por_enviar' && <Text style={styles.porEnviar}>Por enviar</Text>}
          {item.estatus === 'enviado' && <Text style={styles.enviado}>✓ No. {item.serverId}</Text>}
        </View>
      </Pressable>

      {!!item.syncError && item.estatus !== 'enviado' && (
        <Text style={styles.syncError} accessibilityRole="alert">
          No se envió: {item.syncError}
        </Text>
      )}

      {expanded && (
        <View style={styles.details}>
          <DetailRow label="Ciudadano" value={item.ciudadanoPrincipal ?? 'No registrado'} />
          <DetailRow label="Vehículo" value={item.vehiculoDescripcion ?? 'N/A'} />
          <DetailRow
            label="Involucrados"
            value={`${item.totalVehiculos} ${item.totalVehiculos === 1 ? 'vehículo' : 'vehículos'} · ${item.totalPersonas} ${item.totalPersonas === 1 ? 'persona' : 'personas'}`}
          />
          <DetailRow label="Dirección" value={item.direccion ?? 'No especificada'} />
          {item.tipoCierreId != null && (
            <DetailRow label="Cierre" value={item.tipoCierre ?? `Tipo de cierre #${item.tipoCierreId}`} />
          )}
          {item.estatus === 'por_enviar' && (
            <Button label="Cambiar tipo de cierre" variant="ghost" onPress={() => setCerrarVisible(true)} />
          )}
        </View>
      )}

      {item.estatus !== 'enviado' && (
        <View style={styles.actions}>
          <Button label="Editar" variant="ghost" style={styles.actionButton} onPress={onEditar} disabled={enviando} />
          {item.estatus === 'en_curso' ? (
            <Button label="Cerrar" variant="secondary" style={styles.actionButton} onPress={() => setCerrarVisible(true)} />
          ) : (
            <Button label="Enviar" style={styles.actionButton} onPress={enviar} loading={enviando} />
          )}
        </View>
      )}

      <CompletarEventoSheet
        visible={cerrarVisible}
        inicial={item.tipoCierreId}
        onClose={() => setCerrarVisible(false)}
        onConfirm={onCerrar}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  badges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  porEnviar: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.warning[900],
  },
  enviado: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.success[700],
  },
  syncError: {
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Palette.danger[50],
    color: Palette.danger[700],
    fontSize: 12,
    fontWeight: '600',
  },
  categorias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tipos: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.neutral[900],
  },
  fecha: {
    fontSize: 12,
    color: Palette.neutral[500],
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Palette.neutral[100],
    padding: 14,
  },
  actionButton: {
    flex: 1,
    minHeight: 40,
  },
  details: {
    borderTopWidth: 1,
    borderTopColor: Palette.neutral[100],
    padding: 14,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.neutral[500],
  },
  detailValue: {
    fontSize: 13,
    color: Palette.neutral[800],
    flexShrink: 1,
    textAlign: 'right',
  },
});
