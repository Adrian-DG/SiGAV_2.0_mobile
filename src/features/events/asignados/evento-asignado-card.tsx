import { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

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
const ROL_APOYO_SOLICITADO = 3;

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
  /** Lo trae al dispositivo y abre el formulario (agregar vehículos y personas, corregir el lugar...). */
  onEditar: () => Promise<void>;
  /** Unidad de apoyo solicitada: avisa que llegó al lugar. */
  onConfirmarLlegadaApoyo: () => Promise<void>;
};

/**
 * Evento que el call center asignó a la unidad. Llega pendiente: "Llegué" lo pasa a en curso;
 * "Cerrar sin datos" (en «Más opciones») lo completa en el servidor sin pasar por el dispositivo. "Completar" lo trae al
 * dispositivo para completarlo: desde ahí se lista con los eventos propios y se cierra y envía como
 * ellos. Solo la unidad principal cambia su estado o lo edita; una de apoyo solicitada solo avisa
 * que llegó.
 */
export function EventoAsignadoCard({
  evento,
  agentes,
  onIniciar,
  onCompletar,
  onCambiarAgente,
  onEditar,
  onConfirmarLlegadaApoyo,
}: EventoAsignadoCardProps) {
  const [cerrarVisible, setCerrarVisible] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const esPrincipal = evento.rol === ROL_PRINCIPAL;
  const pendiente = evento.estado === EstadoEventoValue.Pendiente;
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

  /** Acciones menos frecuentes (Android admite hasta 3 botones en el diálogo). */
  function masOpciones() {
    Alert.alert(`Evento No. ${evento.id}`, '¿Qué desea hacer?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sin datos', style: 'destructive', onPress: () => setCerrarVisible(true) },
      ...(pendiente ? [{ text: 'Completar datos', onPress: () => void ejecutar(onEditar) }] : []),
    ]);
  }

  /** Cambiar quién atiende se confirma: un toque por error en el chip pasaría el evento al otro agente. */
  function cambiarAgente(agente: AgenteUnidad) {
    if (agente.agenteId === evento.agenteId || ocupado) return;
    Alert.alert('¿Cambiar quién lo atiende?', `El evento No. ${evento.id} quedará a nombre de ${describirAgente(agente)}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cambiar', onPress: () => void ejecutar(() => onCambiarAgente(agente.agenteId)) },
    ]);
  }

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
        {!esPrincipal && (
          <Text style={styles.apoyo}>
            {evento.rol === ROL_APOYO_SOLICITADO
              ? 'El centro pidió a su unidad que apoye este evento. Marque «Llegué» al estar en el lugar; la unidad principal lo registra y lo cierra.'
              : 'Su unidad apoya este evento. La unidad principal lo registra y lo cierra.'}
          </Text>
        )}
      </View>

      {!!agentes && esPrincipal && (
        <View style={styles.agentes}>
          {agentes.map((a) => (
            <Chip
              key={a.agenteId}
              label={a.nombre || a.identificacion}
              selected={a.agenteId === evento.agenteId}
              onPress={() => cambiarAgente(a)}
            />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {/* Una acción principal según el momento: llegar (pendiente) o completarlo (en curso) */}
        {esPrincipal && pendiente && (
          <Button label="Llegué" style={styles.principal} loading={ocupado} onPress={() => void ejecutar(onIniciar)} />
        )}
        {esPrincipal && !pendiente && (
          <Button
            label="Completar evento"
            icon="editar"
            style={styles.principal}
            loading={ocupado}
            onPress={() => void ejecutar(onEditar)}
          />
        )}
        {evento.rol === ROL_APOYO_SOLICITADO && (
          <Button label="Llegué" style={styles.principal} loading={ocupado} onPress={() => void ejecutar(onConfirmarLlegadaApoyo)} />
        )}
        <View style={styles.secundarias}>
          <Button label="Cómo llegar" icon="ubicacion" variant="ghost" style={styles.actionButton} onPress={comoLlegar} />
          {esPrincipal && (
            <Button label="Más opciones" variant="ghost" style={styles.actionButton} disabled={ocupado} onPress={masOpciones} />
          )}
        </View>
      </View>

      <CompletarEventoSheet
        visible={cerrarVisible}
        onClose={() => setCerrarVisible(false)}
        onConfirm={onCompletar}
        descripcion="Se cierra de inmediato en el centro, sin vehículos ni personas. Para registrarlos, use «Completar datos» en lugar de cerrar aquí."
        aviso={
          evento.estado === EstadoEventoValue.Pendiente
            ? 'Aún no marcó «Llegué»: el evento quedará cerrado sin hora de llegada. Úselo solo si se resolvió antes de que llegara la unidad.'
            : null
        }
      />
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
  apoyo: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: Palette.warning[900],
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
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Palette.neutral[100],
    padding: 14,
  },
  principal: {
    minHeight: 52,
  },
  secundarias: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
  },
});
