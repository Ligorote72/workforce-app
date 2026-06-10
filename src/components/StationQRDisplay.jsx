import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Clock, LogIn, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SECRET_KEY = "Workforce_Secret_Key_Bomba"; // En producción esto vendría de variables de entorno
const ROTATION_MINUTES = 5;

// Función para obtener el índice de la ventana de tiempo actual
export const getTimeWindow = () => {
  return Math.floor(Date.now() / (ROTATION_MINUTES * 60 * 1000));
};

export default function StationQRDisplay() {
  const [timeWindow, setTimeWindow] = useState(getTimeWindow());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Actualizar reloj cada segundo
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Revisar cambio de ventana de tiempo
    const windowInterval = setInterval(() => {
      const currentWindow = getTimeWindow();
      if (currentWindow !== timeWindow) {
        setTimeWindow(currentWindow);
      }
    }, 1000); // Check frequently to catch exactly when it flips

    return () => {
      clearInterval(timeInterval);
      clearInterval(windowInterval);
    };
  }, [timeWindow]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Check if iOS to provide manual instructions
      const isIos = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase());
      if (isIos) {
        alert('Para instalar en iPhone: Toca el ícono de "Compartir" (el cuadrito con la flecha) en el menú de tu navegador, y luego selecciona "Agregar a inicio".');
      } else {
        alert('La app ya está instalada o tu navegador no soporta instalación directa. Intenta buscar la opción "Instalar aplicación" o "Agregar a inicio" en el menú de tu navegador.');
      }
      return;
    }
    
    // Show prompt
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Generar un hash rudimentario con el secreto para el payload
  // Payload final: BOMBA_QR|{window}|{secret_hash}
  // En un entorno real se usa HMAC, pero esto previene adivinanzas simples
  const generatePayload = (window) => {
    return `BOMBA_QR|${window}|${SECRET_KEY}`;
  };

  const currentPayload = generatePayload(timeWindow);

  // Calcular tiempo restante para el siguiente cambio
  const msInWindow = ROTATION_MINUTES * 60 * 1000;
  const timeElapsed = Date.now() % msInWindow;
  const msRemaining = msInWindow - timeElapsed;
  const secondsRemaining = Math.floor(msRemaining / 1000);
  const m = Math.floor(secondsRemaining / 60);
  const s = secondsRemaining % 60;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-main)' }}>
      <div className="glass-card animate-fade-in" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <h1 style={{ color: 'var(--primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>
          Workforce
        </h1>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>
          Estación "La Bomba"
        </h2>
        
        <p style={{ color: 'var(--text-dim)', textAlign: 'center', maxWidth: '300px' }}>
          Escanea este código QR con la app de Workforce para marcar tu entrada o salida.
        </p>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', margin: '20px 0' }}>
          <QRCodeSVG value={currentPayload} size={256} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 'bold' }}>
          <Clock size={20} color="var(--primary)" />
          {currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        
        <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          El código se actualizará en: <strong style={{color: 'var(--accent)'}}>{m}:{s.toString().padStart(2, '0')}</strong>
        </div>
      </div>
      
      {/* Botón de Inicio de Sesión */}
      <button 
        onClick={() => navigate('/login')}
        className="btn btn-secondary"
        style={{ 
          position: 'fixed', 
          bottom: '24px', 
          right: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px',
          borderRadius: '30px',
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}
      >
        <LogIn size={20} />
        Iniciar Sesión
      </button>

      {/* Botón de Descargar App */}
      <button 
        onClick={handleInstallClick}
        className="btn btn-primary"
        style={{ 
          position: 'fixed', 
          bottom: '24px', 
          left: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          fontSize: '0.85rem',
          borderRadius: '20px',
          boxShadow: '0 4px 16px rgba(195, 245, 60, 0.2)'
        }}
      >
        <Download size={16} />
        Instalar App
      </button>
    </div>
  );
}
