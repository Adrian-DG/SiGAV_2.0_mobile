import * as Crypto from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { EventoFormulario } from '@/features/events/components/evento-formulario';
import { nuevoEventoForm } from '@/features/events/form/evento-form';
import { guardarEventoLocal } from '@/features/events/local/eventos-local';
import { useSesionEvento } from '@/features/events/local/use-sesion-evento';

/** Registrar evento: queda guardado en el dispositivo, "en curso", hasta que el agente lo cierre y lo envíe. */
export default function NewEventScreen() {
  const db = useSQLiteContext();
  const sesion = useSesionEvento();

  // requestId y hora de llegada se fijan al abrir el formulario: la llegada es cuando el agente
  // encontró el evento, y la clave acompaña al evento hasta el envío (la API no lo duplica).
  const [inicial] = useState(() => nuevoEventoForm(Crypto.randomUUID()));

  return (
    <EventoFormulario
      titulo="Registrar evento"
      inicial={inicial}
      capturarUbicacion
      textoGuardar="Guardar evento"
      onGuardar={async (form, tipos) => {
        if (!sesion) throw new Error('La sesión no tiene agente o unidad: vuelva a iniciar sesión.');
        await guardarEventoLocal(db, form, sesion, tipos);
      }}
    />
  );
}
