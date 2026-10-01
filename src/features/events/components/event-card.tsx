import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CategoriaBadge } from '@/components/ui/categoria-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tag } from '@/components/ui/tag';
import { Palette } from '@/constants/colors';
import { CompletarEventoSheet } from '@/features/events/components/completar-evento-sheet';
import { EstadoEventoValue, type EventoListItem } from '@/features/events/types';

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

/** Props opcional: sin onChanged el componente sigue funcionando (p. ej. en una preview). */
export function EventCard({ item, onChanged }: { item: EventoListItem; onChanged?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [completarVisible, setCompletarVisible] = useState(false);

  const puedeOperar = item.estado !== EstadoEventoValue.Completado;

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.header}>
        <View style={styles.headerText}>
          <View style={styles.categorias}>
            {(item.categorias ?? []).map((categoria) => (
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

      {puedeOperar && (
        <View style={styles.actions}>
          <Button
            label="Editar"
            variant="ghost"
            style={styles.actionButton}
            onPress={() => Alert.alert('Próximamente', 'La edición de eventos estará disponible pronto.')}
          />
          <Button
            label="Completar"
            variant="secondary"
            style={styles.actionButton}
            onPress={() => setCompletarVisible(true)}
          />
        </View>
      )}

      <CompletarEventoSheet
        visible={completarVisible}
        eventoId={item.id}
        onClose={() => setCompletarVisible(false)}
        onCompleted={() => onChanged?.()}
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
