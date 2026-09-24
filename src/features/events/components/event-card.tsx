import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Palette } from '@/constants/colors';
import type { EventoListItem } from '@/features/events/types';

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

export function EventCard({ item }: { item: EventoListItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.tipos} numberOfLines={1}>
            {item.tipos.join(' · ') || 'Evento'}
          </Text>
          <Text style={styles.fecha}>{formatFecha(item.fechaHoraReporte)}</Text>
        </View>
        <StatusBadge estado={item.estado} />
      </Pressable>

      {expanded && (
        <View style={styles.details}>
          <DetailRow label="Ciudadano" value={item.ciudadanoPrincipal ?? 'No registrado'} />
          <DetailRow label="Vehículo" value={item.vehiculoDescripcion ?? 'N/A'} />
          <DetailRow label="Dirección" value={item.direccion ?? 'No especificada'} />
          <DetailRow label="Unidad" value={item.unidadFicha} />
        </View>
      )}
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
    gap: 2,
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
