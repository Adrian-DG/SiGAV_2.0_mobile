import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CategoriaBadge } from '@/components/ui/categoria-badge';
import { Chip } from '@/components/ui/chip';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tag } from '@/components/ui/tag';
import { Palette } from '@/constants/colors';
import { CompletarEventoSheet } from '@/features/events/components/completar-evento-sheet';
import { EstadoEventoValue } from '@/features/events/types';
import { describirAgente, type AgenteUnidad } from '@/lib/jwt';

import type { EventoAsignado } from './api';

const ROL_PRINCIPAL = 1;

function formatFecha(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' });
}

type EventoAsignadoCardProps = {
  evento: EventoAsignado;
  /** Agentes de la unidad si opera con componente (para elegir quién lo atiende); null si va solo. */
  agentes: AgenteUnidad[] | null;
  onIniciar: () => Promise<void>;
  onCompletar: (tipoCierreId: number) => Promise<void>;
  onCambiarAgente: (agenteId: number) => Promise<void>;
};

/**
 * Evento que el call center asignó a la unidad. Llega pendiente: "Llegué" lo pasa a en curso y
 * "Cerrar" lo completa en el servidor (no pasa por la cola del dispositivo). Solo la unidad
 * principal cambia su estado.
 */
export function EventoAsignadoCard({ evento, agentes, onIniciar, onCompletar, onCambiarAgente }: EventoAsignadoCardProps) {
  const [cerrarVisible, setCerrarVisible] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const esPrincipal = evento.rol === ROL_PRINCIPAL;
  const atiende = agentes?.find((a) => a.agenteId === evento.agenteId);

  async function ejecutar(accion: () => Promise<void>) {
    setOcupado(true);
    try {
      await accion();
    } catch {
      // Quien llama muestra el error
    } finally {
      setOcupado(false);
    }
  }

  const comoLlegar = () =>
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${evento.latitud},${evento.longitud}`);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.numero}>Asignado · No. {evento.id}</Text>
          <View style={styles.wrap}>
            {evento.categorias.map((c) => (
              <CategoriaBadge key={c} categoria={c} />
            ))}
          </View>
          <View style={styles.wrap}>
            {evento.tipos.map((t) => (
              <Tag key={t} label={t} />
            ))}
          </View>
        </View>
        <StatusBadge estado={evento.estado} />
      </View>

      <View style={styles.details}>
        <Text style={styles.lugar}>
          {[evento.direccion, evento.municipio, evento.tramo].filter(Boolean).join(' · ')}
        </Text>
        {!!evento.comentario && <Text style={styles.comentario}>{evento.comentario}</Text>}
        <Text style={styles.fecha}>Reportado {formatFecha(evento.fechaHoraReporte)}</Text>
        {!!atiende && <Text style={styles.fecha}>Atiende: {describirAgente(atiende)}</Text>}
      </View>

      {!!agentes && esPrincipal && (
        <View style={styles.agentes}>
          {agentes.map((a) => (
            <Chip
              key={a.agenteId}
              label={a.nombre || a.identificacion}
              selected={a.agenteId === evento.agenteId}
              onPress={() => a.agenteId !== evento.agenteId && !ocupado && void ejecutar(() => onCambiarAgente(a.agenteId))}
            />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Button label="Cómo llegar" variant="ghost" style={styles.actionButton} onPress={comoLlegar} />
        {esPrincipal && evento.estado === EstadoEventoValue.Pendiente && (
          <Button label="Llegué" variant="secondary" style={styles.actionButton} loading={ocupado} onPress={() => void ejecutar(onIniciar)} />
        )}
        {esPrincipal && (
          <Button label="Cerrar" style={styles.actionButton} disabled={ocupado} onPress={() => setCerrarVisible(true)} />
        )}
      </View>

      <CompletarEventoSheet visible={cerrarVisible} onClose={() => setCerrarVisible(false)} onConfirm={onCompletar} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Palette.warning[200],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  numero: {
    fontSize: 12,
    fontWeight: '800',
    color: Palette.warning[900],
    textTransform: 'uppercase',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  details: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 4,
  },
  lugar: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.neutral[800],
  },
  comentario: {
    fontSize: 13,
    color: Palette.neutral[700],
    fontStyle: 'italic',
  },
  fecha: {
    fontSize: 12,
    color: Palette.neutral[500],
  },
  agentes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
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
});
