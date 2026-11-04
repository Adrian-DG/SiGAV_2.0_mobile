import * as Crypto from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { EventoFormulario } from '@/features/events/components/evento-formulario';
import { nuevoEventoForm } from '@/features/events/form/evento-form';
import { guardarEventoLocal } from '@/features/events/local/eventos-local';
import { pedirPestanaInicio } from '@/features/events/local/pestana-inicio';

/** Registrar evento: queda guardado en el dispositivo, "en curso", hasta que el agente lo cierre y lo envíe. */
export default function NewEventScreen() {
  const db = useSQLiteContext();

  // requestId y hora de llegada se fijan al abrir el formulario: la llegada es cuando el agente
  // encontró el evento, y la clave acompaña al evento hasta el envío (la API no lo duplica).
  const [inicial] = useState(() => nuevoEventoForm(Crypto.randomUUID()));

  return (
    <EventoFormulario
      titulo="Registrar evento"
      inicial={inicial}
      capturarUbicacion
      llegadaEditable
      textoGuardar="Guardar evento"
      mensajeGuardado="Evento guardado en «En curso». Ciérrelo y envíelo al terminar."
      onGuardar={async (form, tipos, sesion) => {
        if (!sesion) throw new Error('La sesión no tiene agente o unidad: vuelva a iniciar sesión.');
        await guardarEventoLocal(db, form, sesion, tipos);
        pedirPestanaInicio('en_curso');
      }}
    />
  );
}
