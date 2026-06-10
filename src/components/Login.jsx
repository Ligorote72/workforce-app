import React, { useState } from 'react';
import { Fingerprint, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { isBiometricsSupported, registerBiometrics } from '../biometrics';

export default function Login() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!pin) return;
    
    setLoading(true);
    setError('');

    try {
      const { data, error: dbError } = await supabase
        .from('workforce_employees')
        .select('*')
        .eq('pin', pin)
        .limit(1)
        .single();

      if (dbError || !data) {
        throw new Error('PIN incorrecto o empleado no encontrado.');
      }

      // Guardamos la sesión en el navegador
      localStorage.setItem('workforce_user', JSON.stringify(data));

      // Si el dispositivo soporta huella, la registramos localmente 
      // (si no está ya registrada)
      const supportsBio = await isBiometricsSupported();
      if (supportsBio) {
        try {
          await registerBiometrics();
        } catch (bioError) {
          console.log('Usuario canceló o falló registro de huella:', bioError);
        }
      }

      // Redirigir según el rol
      if (data.role === 'Administrador') {
        navigate('/admin');
      } else {
        navigate('/clock');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '40px 32px' }}>
        
        <div style={{
          width: '80px', height: '80px', background: 'rgba(195, 245, 60, 0.1)', 
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', color: 'var(--primary)'
        }}>
          <Fingerprint size={40} />
        </div>

        <h1 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Bienvenido</h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: '32px' }}>
          Ingresa tu PIN de acceso
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input 
            type="password" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="****"
            maxLength={4}
            style={{
              padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1.5rem', textAlign: 'center',
              letterSpacing: '8px'
            }}
          />
          
          {error && <p style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>{error}</p>}

          <button 
            type="submit" 
            disabled={loading || !pin}
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? <Loader className="animate-spin" size={20} /> : 'Iniciar Sesión'}
          </button>
        </form>

      </div>
    </div>
  );
}
