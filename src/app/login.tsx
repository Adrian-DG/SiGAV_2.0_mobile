import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiEnvironmentBadge } from '@/components/api-environment-badge';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Palette } from '@/constants/colors';
import { useSession } from '@/contexts/auth-context';
import { confirmAgente, confirmUnidad } from '@/features/auth/api';
import {
  FICHA_MAX_LENGTH,
  isCedulaComplete,
  isFichaComplete,
  maskCedula,
  maskFicha,
  unmaskCedula,
} from '@/features/auth/format';
import { ApiError } from '@/lib/api-client';

type FieldStatus = 'idle' | 'checking' | 'valid' | 'invalid';

export default function LoginScreen() {
  const { signIn, notice } = useSession();

  const [cedula, setCedula] = useState('');
  const [cedulaStatus, setCedulaStatus] = useState<FieldStatus>('idle');
  const [cedulaError, setCedulaError] = useState<string | null>(null);

  const [ficha, setFicha] = useState('');
  const [fichaStatus, setFichaStatus] = useState<FieldStatus>('idle');
  const [fichaError, setFichaError] = useState<string | null>(null);

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function validateCedula() {
    if (!cedula) return;

    if (!isCedulaComplete(cedula)) {
      setCedulaStatus('invalid');
      setCedulaError('Formato inválido. Use 000-0000000-0.');
      return;
    }

    setCedulaStatus('checking');
    setCedulaError(null);
    try {
      const result = await confirmAgente(unmaskCedula(cedula));
      if (!result.created) {
        setCedulaStatus('invalid');
        setCedulaError('Cédula no registrada.');
      } else if (!result.isAuthorized) {
        setCedulaStatus('invalid');
        setCedulaError('Agente no autorizado. Contacte a front desk.');
      } else {
        setCedulaStatus('valid');
      }
    } catch (error) {
      setCedulaStatus('invalid');
      setCedulaError(error instanceof ApiError ? error.message : 'No se pudo validar la cédula.');
    }
  }

  async function validateFicha() {
    if (!ficha) return;

    if (!isFichaComplete(ficha)) {
      setFichaStatus('invalid');
      setFichaError('Ficha inválida. Use solo letras, números y guiones, ej. CA-1759.');
      return;
    }

    setFichaStatus('checking');
    setFichaError(null);
    try {
      // La API responde false tanto si la ficha no existe como si la unidad está desactivada o
      // no disponible: el mensaje no puede asumir que la ficha esté mal escrita.
      const disponible = await confirmUnidad(ficha);
      if (!disponible) {
        setFichaStatus('invalid');
        setFichaError('Unidad no encontrada o no disponible. Verifique la ficha o contacte a front desk.');
      } else {
        setFichaStatus('valid');
      }
    } catch (error) {
      setFichaStatus('invalid');
      setFichaError(error instanceof ApiError ? error.message : 'No se pudo validar la ficha.');
    }
  }

  async function handleSignIn() {
    setFormError(null);
    setIsSigningIn(true);
    try {
      await signIn(unmaskCedula(cedula), ficha);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setIsSigningIn(false);
    }
  }

  const canShowFicha = cedulaStatus === 'valid';
  const canSignIn = cedulaStatus === 'valid' && fichaStatus === 'valid';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandPanel}>
            <Image
              source={require('@/assets/images/brand/comipol-crest.png')}
              style={styles.crest}
              resizeMode="contain"
            />
            <Text style={styles.title}>Asistencia Vial</Text>
            <Text style={styles.subtitle}>
              Accede con tu cédula y ficha de unidad para iniciar tu jornada operativa.
            </Text>
          </View>

          <View style={styles.card}>
            {notice && (
              <Text style={styles.notice} accessibilityRole="alert">
                {notice}
              </Text>
            )}
            <TextField
              label="Cédula"
              placeholder="000-0000000-0"
              value={cedula}
              onChangeText={(text) => {
                setCedula(maskCedula(text));
                setCedulaStatus('idle');
                setCedulaError(null);
              }}
              onSubmitEditing={validateCedula}
              editable={cedulaStatus !== 'checking'}
              keyboardType="number-pad"
              maxLength={13}
              returnKeyType="next"
              errorText={cedulaError}
            />
            {cedulaStatus !== 'valid' && (
              <Button
                label="Validar cédula"
                variant="ghost"
                loading={cedulaStatus === 'checking'}
                disabled={!isCedulaComplete(cedula)}
                onPress={validateCedula}
              />
            )}
            {cedulaStatus === 'valid' && <Text style={styles.validText}>✓ Agente verificado</Text>}

            {canShowFicha && (
              <>
                <TextField
                  label="Ficha de unidad"
                  placeholder="Ej. CA-1759"
                  value={ficha}
                  onChangeText={(text) => {
                    setFicha(maskFicha(text));
                    setFichaStatus('idle');
                    setFichaError(null);
                  }}
                  onSubmitEditing={validateFicha}
                  editable={fichaStatus !== 'checking'}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={FICHA_MAX_LENGTH}
                  returnKeyType="done"
                  errorText={fichaError}
                />
                {fichaStatus !== 'valid' && (
                  <Button
                    label="Validar unidad"
                    variant="ghost"
                    loading={fichaStatus === 'checking'}
                    disabled={!isFichaComplete(ficha)}
                    onPress={validateFicha}
                  />
                )}
                {fichaStatus === 'valid' && <Text style={styles.validText}>✓ Unidad verificada</Text>}
              </>
            )}

            {formError && <Text style={styles.formError}>{formError}</Text>}

            <Button
              label="Ingresar"
              onPress={handleSignIn}
              loading={isSigningIn}
              disabled={!canSignIn}
              style={styles.signInButton}
            />                        

          </View>          
        </ScrollView>
        {/* Fuera del scroll: queda fija en la esquina superior derecha, dentro del área segura */}
        <ApiEnvironmentBadge style={styles.apiBadge} />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Palette.white,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    gap: 24,
  },
  apiBadge: {
    position: 'absolute',
    top: 12,
    right: 16,
  },
  brandPanel: {
    alignItems: 'center',
    gap: 8,
  },
  crest: {
    width: 120,
    height: 125,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    // Antes Palette.white sobre fondo blanco: el título no se veía
    color: Palette.primary[700],
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Palette.primary[500],
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    fontWeight: '500',
  },
  card: {
    backgroundColor: Palette.white,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  validText: {
    color: Palette.success[600],
    fontWeight: '700',
    fontSize: 13,
  },
  notice: {
    // warning[900] sobre warning[50] = 7.65:1 (warning[700] daba 3.55:1, bajo el mínimo WCAG de 4.5)
    color: Palette.warning[900],
    backgroundColor: Palette.warning[50],
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  formError: {
    color: Palette.danger[600],
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  signInButton: {
    marginTop: 8,
  },
});
