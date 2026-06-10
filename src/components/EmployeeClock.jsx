import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle, Clock, Loader, Calendar, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { verifyBiometrics, isBiometricsSupported } from '../biometrics';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function EmployeeClock() {
  const [time, setTime] = useState(new Date());
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isScanningQR, setIsScanningQR] = useState(false);
  const [user, setUser] = useState(null);
  const [currentAttendanceId, setCurrentAttendanceId] = useState(null);
  const [todaySchedule, setTodaySchedule] = useState(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('workforce_user');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    checkCurrentStatus(parsedUser.id);
    fetchTodaySchedule(parsedUser.id);
  }, [navigate]);

  useEffect(() => {
    let scanner = null;
    const SECRET_KEY = "Workforce_Secret_Key_Bomba";
    const ROTATION_MINUTES = 5;
    
    if (isScanningQR) {
      const onScanSuccess = (decodedText, decodedResult) => {
        // Expected format: BOMBA_QR|{window}|{secret}
        const parts = decodedText.split('|');
        if (parts.length === 3 && parts[0] === 'BOMBA_QR' && parts[2] === SECRET_KEY) {
          const scannedWindow = parseInt(parts[1], 10);
          const currentWindow = Math.floor(Date.now() / (ROTATION_MINUTES * 60 * 1000));
          
          // Permite la ventana actual, o la inmediatamente anterior (gracia de 5 mins en caso de que acabe de rotar)
          if (scannedWindow === currentWindow || scannedWindow === currentWindow - 1) {
            if (scanner) {
              scanner.clear().catch(console.error);
              scanner = null;
            }
            setIsScanningQR(false);
            setStatusMsg('QR válido. Por favor, verifica tu huella.');
            setTimeout(() => {
              startFingerprintAuth();
            }, 800);
          } else {
            setStatusMsg('Código QR expirado. Escanea el nuevo código.');
          }
        } else {
          setStatusMsg('Código QR inválido para esta sede.');
        }
      };

      const onScanFailure = (error) => {
        // Ignorar fallos de escaneo frame a frame
      };

      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      scanner.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [isScanningQR]);

  const fetchTodaySchedule = async (employeeId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('workforce_schedules')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .maybeSingle();
      
      if (data) {
        setTodaySchedule(data);
      }
    } catch (err) {
      console.error("Error fetching schedule:", err);
    }
  };

  const checkCurrentStatus = async (employeeId) => {
    try {
      const { data, error } = await supabase
        .from('workforce_attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setIsClockedIn(true);
        setCurrentAttendanceId(data.id);
      }
    } catch (err) {
      setIsClockedIn(false);
      setCurrentAttendanceId(null);
    }
  };

  const handleActionStart = () => {
    setIsScanningQR(true);
    setStatusMsg('Escanea el QR de la oficina...');
  };

  const startFingerprintAuth = async () => {
    setIsScanning(true);
    setStatusMsg('Verificando huella...');
    
    try {
      // 1. Validar Huella Digital
      const supportsBio = await isBiometricsSupported();
      if (supportsBio) {
        const verified = await verifyBiometrics();
        if (!verified) {
          throw new Error('Validación de huella fallida.');
        }
      }

      setStatusMsg('Registrando en el sistema...');

      if (isClockedIn && currentAttendanceId) {
        // Marcar Salida
        const { error } = await supabase
          .from('workforce_attendance')
          .update({ 
            clock_out: new Date().toISOString(),
            status: 'Completado'
          })
          .eq('id', currentAttendanceId);

        if (error) throw error;
        
        setIsClockedIn(false);
        setCurrentAttendanceId(null);
        setStatusMsg('¡Salida registrada con éxito!');
      } else {
        // Marcar Entrada
        const { data, error } = await supabase
          .from('workforce_attendance')
          .insert([{ 
            employee_id: user.id,
            status: 'Trabajando'
          }])
          .select()
          .single();

        if (error) throw error;
        
        setIsClockedIn(true);
        setCurrentAttendanceId(data.id);
        setStatusMsg('¡Entrada registrada con éxito!');
      }

    } catch (error) {
      setStatusMsg('Error: ' + error.message);
      console.error(error);
    } finally {
      setIsScanning(false);
      setTimeout(() => setStatusMsg(''), 4000);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('es-CO', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (!user) return null;

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
      
      <div className="glass-card animate-fade-in" style={{ width: '100%', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ color: 'var(--primary)', fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
            Workforce
          </h2>
          <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: '500', marginBottom: '4px' }}>
            Hola, {user.name.split(' ')[0]}
          </p>
          <p style={{ color: 'var(--text-dim)', textTransform: 'capitalize' }}>
            {formatDate(time)}
          </p>
        </div>

        {/* Schedule Info */}
        <div style={{ 
          background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', 
          marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
        }}>
          <Calendar size={18} color="var(--primary)" />
          {todaySchedule ? (
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>
              Turno de hoy: <span style={{ color: 'var(--primary)' }}>{todaySchedule.shift_type}</span>
            </span>
          ) : (
            <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>
              Sin turno programado hoy
            </span>
          )}
        </div>

        {!isScanningQR && (
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '3.5rem', fontWeight: '700', letterSpacing: '-2px', textShadow: '0 0 20px rgba(255,255,255,0.1)' }}>
              {formatTime(time)}
            </h1>
            <div style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '8px', 
              background: isClockedIn ? 'rgba(195, 245, 60, 0.1)' : 'rgba(255, 255, 255, 0.05)', 
              padding: '8px 16px', borderRadius: '20px', marginTop: '16px',
              color: isClockedIn ? 'var(--primary)' : 'var(--text-dim)',
              border: `1px solid ${isClockedIn ? 'rgba(195, 245, 60, 0.2)' : 'transparent'}`
            }}>
              <Clock size={16} />
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                {isClockedIn ? 'Turno en curso' : 'Fuera de turno'}
              </span>
            </div>
          </div>
        )}

        {isScanningQR && (
          <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div id="qr-reader" style={{ width: '100%', maxWidth: '300px', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}></div>
            <button 
              onClick={() => {
                setIsScanningQR(false);
                setStatusMsg('');
              }}
              className="btn btn-secondary"
              style={{ marginTop: '16px', borderRadius: '20px' }}
            >
              Cancelar Escaneo
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          
          {!isScanningQR && (
            <button 
              onClick={handleActionStart}
              disabled={isScanning}
              className={`btn ${isClockedIn ? 'btn-danger' : 'btn-primary'}`}
              style={{ 
                width: '100%', height: '80px', borderRadius: '24px', 
                fontSize: '1.4rem', gap: '16px',
                position: 'relative'
              }}
            >
              <div className={isScanning ? 'clock-pulse' : ''}>
                {isScanning ? <Loader className="animate-spin" size={32} /> : (isScanningQR ? <QrCode size={32} /> : <Fingerprint size={32} />)}
              </div>
              {isScanning ? 'Verificando...' : (isClockedIn ? 'MARCAR SALIDA' : 'MARCAR ENTRADA')}
            </button>
          )}

          <div style={{ 
            opacity: statusMsg ? 1 : 0, 
            transform: statusMsg ? 'translateY(0)' : 'translateY(10px)',
            transition: 'all 0.3s ease',
            color: statusMsg.includes('Error') ? 'var(--accent)' : (isClockedIn ? 'var(--primary)' : 'var(--text-main)'),
            display: 'flex', alignItems: 'center', gap: '8px',
            fontWeight: '600',
            textAlign: 'center'
          }}>
            {!statusMsg.includes('Error') && statusMsg !== 'Verificando huella...' && statusMsg !== 'Registrando en el sistema...' && statusMsg !== 'Escanea el QR de la oficina...' && <CheckCircle size={20} />}
            {statusMsg}
          </div>

        </div>

      </div>

    </div>
  );
}

