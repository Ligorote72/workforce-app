import { Capacitor } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

// --- WebAuthn Helpers ---
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

// --- Main Exports ---
export async function isBiometricsSupported() {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await BiometricAuth.checkBiometry();
      return info.isAvailable;
    } catch (e) {
      console.error('Error checking native biometry', e);
      return false;
    }
  } else {
    return window.PublicKeyCredential !== undefined;
  }
}

export function hasLocalBiometrics() {
  if (Capacitor.isNativePlatform()) {
    return localStorage.getItem('workforce_native_bio') !== null;
  }
  return localStorage.getItem('workforce_credential_id') !== null;
}

export function clearLocalBiometrics() {
  if (Capacitor.isNativePlatform()) {
    localStorage.removeItem('workforce_native_bio');
  } else {
    localStorage.removeItem('workforce_credential_id');
  }
}

export async function registerBiometrics() {
  const supported = await isBiometricsSupported();
  if (!supported) throw new Error('Biometría no soportada');

  if (Capacitor.isNativePlatform()) {
    try {
      const hasBio = await BiometricAuth.authenticate({
        reason: "Registra tu huella para entrar rápidamente",
        cancelTitle: "Cancelar"
      });
      if (hasBio) {
        localStorage.setItem('workforce_native_bio', 'true');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error en registro nativo:', error);
      return false;
    }
  } else {
    // WebAuthn
    const challenge = new Uint8Array(32);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(challenge);
    crypto.getRandomValues(userId);

    try {
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: "Workforce App" },
          user: {
            id: userId,
            name: "empleado@workforce",
            displayName: "Empleado Workforce"
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 }
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          },
          timeout: 60000,
          attestation: "none"
        }
      });

      if (cred) {
        localStorage.setItem('workforce_credential_id', bufferToBase64(cred.rawId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error registrando huella web:', error);
      return false;
    }
  }
}

export async function verifyBiometrics() {
  if (!hasLocalBiometrics()) return false;

  if (Capacitor.isNativePlatform()) {
    try {
      const authResult = await BiometricAuth.authenticate({
        reason: "Autentícate para continuar",
        cancelTitle: "Cancelar"
      });
      return authResult; // true if success
    } catch (error) {
      console.error('Error verificando huella nativa:', error);
      return false;
    }
  } else {
    // WebAuthn
    const credIdBase64 = localStorage.getItem('workforce_credential_id');
    if (!credIdBase64) return false;

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    try {
      const cred = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          allowCredentials: [{
            id: base64ToBuffer(credIdBase64),
            type: "public-key",
          }],
          userVerification: "required"
        }
      });
      return !!cred;
    } catch (error) {
      console.error('Error verificando huella web:', error);
      return false;
    }
  }
}
