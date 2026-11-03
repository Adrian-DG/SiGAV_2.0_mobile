import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Card } from '@/components/ui/card';
import { Palette } from '@/constants/colors';
import { buscarSesion } from '@/features/auth/sesiones-conocidas';
import { pendientesDeOtrasSesiones, type LocalDb, type SesionEvento } from '@/features/events/local/eventos-local';

type Props = {
  db: LocalDb;
  sesion: SesionEvento;
  /** Cambia para volver a consultar (p. ej. al recargar el inicio). */
  version: number;
};

/**
 * Aviso de eventos sin enviar que dejó en el teléfono otra sesión (otro agente o unidad), p. ej.
 * porque venció antes de enviarlos. La API toma agente y unidad del token, así que solo se envían
 * entrando con esa cédula y esa ficha.
 */
export function PendientesOtrasSesiones({ db, sesion, version }: Props) {
  const { agenteId, unidadId } = sesion;
  const [lineas, setLineas] = useState<string[]>([]);

  useEffect(() => {
    let cancelado = false;
    async function run() {
      const grupos = await pendientesDeOtrasSesiones(db, { agenteId, unidadId });
      const textos = await Promise.all(
        grupos.map(async (g) => {
          const conocida = await buscarSesion(g.agenteId, g.unidadId);
          const cuantos = g.total === 1 ? '1 evento' : `${g.total} eventos`;
          return conocida ? `• ${cuantos} de ${conocida.agente}, unidad ${conocida.ficha}` : `• ${cuantos} de una sesión anterior`;
        }),
      );
      if (!cancelado) setLineas(textos);
    }
    run().catch(() => {
      if (!cancelado) setLineas([]);
    });
    return () => {
      cancelado = true;
    };
  }, [db, agenteId, unidadId, version]);

  if (lineas.length === 0) return null;

  return (
    <Card style={styles.card} accessibilityRole="alert">
      <Text style={styles.titulo}>Eventos sin enviar de otra sesión</Text>
      <Text style={styles.texto}>{lineas.join('\n')}</Text>
      <Text style={styles.texto}>
        Siguen guardados en este teléfono. Para enviarlos, inicie sesión con esa cédula y esa ficha.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
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
