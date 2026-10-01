import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Palette } from '@/constants/colors';
import { EventoFormulario } from '@/features/events/components/evento-formulario';
import { guardarEventoLocal, obtenerEventoLocal, type EventoLocal } from '@/features/events/local/eventos-local';
import { useSesionEvento } from '@/features/events/local/use-sesion-evento';

type Carga = { estado: 'cargando' } | { estado: 'listo'; evento: EventoLocal } | { estado: 'no-disponible'; mensaje: string };

/** Editar un evento guardado en el dispositivo. Los cambios quedan locales hasta que se envíe. */
export default function EditEventScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const sesion = useSesionEvento();
  const { id } = useLocalSearchParams<{ id: string }>();
  const localId = Number(id);
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });

  const agenteId = sesion?.agenteId;
  const unidadId = sesion?.unidadId;

  const valido = !!agenteId && !!unidadId && Number.isInteger(localId);

  useEffect(() => {
    if (!agenteId || !unidadId || !Number.isInteger(localId)) return;
    let cancelado = false;
    obtenerEventoLocal(db, localId, { agenteId, unidadId })
      .then((evento) => {
        if (cancelado) return;
        if (!evento) setCarga({ estado: 'no-disponible', mensaje: 'El evento no existe en este dispositivo.' });
        else if (evento.estatus === 'enviado')
          setCarga({ estado: 'no-disponible', mensaje: `El evento No. ${evento.serverId} ya fue enviado y no puede editarse.` });
        else setCarga({ estado: 'listo', evento });
      })
      .catch(() => {
        if (!cancelado) setCarga({ estado: 'no-disponible', mensaje: 'No se pudo abrir el evento.' });
      });
    return () => {
      cancelado = true;
    };
  }, [db, localId, agenteId, unidadId]);

  const vista: Carga = valido ? carga : { estado: 'no-disponible', mensaje: 'No se encontró el evento.' };

  if (vista.estado !== 'listo') {
    return (
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScreenHeader title="Editar evento" right={<IconButton glyph="✕" label="Cerrar" onPress={() => router.back()} />} />
        <View style={styles.centro}>
          {vista.estado === 'cargando' ? (
            <ActivityIndicator color={Palette.primary[500]} />
          ) : (
            <>
              <EmptyState glyph="⚠" title="No disponible" description={vista.mensaje} />
              <Button label="Volver" variant="ghost" onPress={() => router.back()} />
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const { evento } = vista;

  return (
    <EventoFormulario
      titulo="Editar evento"
      inicial={evento.form}
      capturarUbicacion={false}
      textoGuardar="Guardar cambios"
      aviso={
        evento.tipoCierreId != null
          ? `Cerrado como "${evento.tipoCierre ?? `tipo #${evento.tipoCierreId}`}". Puede corregirlo hasta enviarlo.`
          : null
      }
      onGuardar={async (form, tipos) => {
        if (!sesion) throw new Error('La sesión no tiene agente o unidad: vuelva a iniciar sesión.');
        await guardarEventoLocal(db, form, sesion, tipos, new Date(), evento.localId);
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Palette.neutral[50] },
  centro: { flex: 1, justifyContent: 'center', padding: 20, gap: 12 },
});
