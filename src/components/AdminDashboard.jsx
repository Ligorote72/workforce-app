import React, { useState, useEffect, useRef } from 'react';
import { Users, FileSpreadsheet, LogOut, CheckCircle, Clock, Calendar, Plus, Trash2, Upload, Download, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('resumen'); // 'resumen' | 'horarios' | 'personal'
  
  // States for Resumen
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  
  // States for Horarios & Personal
  const [allEmployees, setAllEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  
  // Forms
  const [scheduleForm, setScheduleForm] = useState({ 
    employee_id: '', 
    date: new Date().toISOString().split('T')[0], 
    shift_type: 'Mañana (6 AM - 2 PM)' 
  });
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    role: 'Operario',
    pin: ''
  });

  const [isAssigning, setIsAssigning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingEmp, setIsCreatingEmp] = useState(false);
  
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
    fetchAllEmployees();
    fetchSchedules();
    
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { count } = await supabase
        .from('workforce_employees')
        .select('*', { count: 'exact', head: true });
      setTotalEmployees(count || 0);

      const { data, error } = await supabase
        .from('workforce_attendance')
        .select(`
          id,
          clock_in,
          status,
          employee:workforce_employees (
            name,
            role
          )
        `)
        .is('clock_out', null)
        .order('clock_in', { ascending: false });

      if (error) throw error;
      setActiveEmployees(data || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  const fetchAllEmployees = async () => {
    const { data } = await supabase
      .from('workforce_employees')
      .select('id, name, role, pin')
      .order('name');
    if (data) {
      setAllEmployees(data);
      const operarios = data.filter(e => e.role !== 'Administrador');
      if (operarios.length > 0) setScheduleForm(prev => ({ ...prev, employee_id: operarios[0].id }));
    }
  };

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('workforce_schedules')
      .select(`
        id, date, shift_type, start_time, end_time,
        employee:workforce_employees(name)
      `)
      .order('date', { ascending: false })
      .limit(50);
    if (data) setSchedules(data);
  };

  // -------------------------
  // EMPLOYEE LOGIC
  // -------------------------
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!employeeForm.name || !employeeForm.pin) return;
    if (employeeForm.pin.length !== 4) {
      alert("El PIN debe tener exactamente 4 dígitos.");
      return;
    }

    setIsCreatingEmp(true);
    try {
      const { error } = await supabase.from('workforce_employees').insert([{
        name: employeeForm.name,
        role: employeeForm.role,
        pin: employeeForm.pin
      }]);

      if (error) throw error;
      
      alert('¡Empleado registrado correctamente!');
      setEmployeeForm({ name: '', role: 'Operario', pin: '' });
      fetchAllEmployees(); // Refrescar lista
      fetchDashboardData(); // Refrescar conteo total
    } catch (error) {
      alert('Error al registrar empleado: ' + error.message);
    } finally {
      setIsCreatingEmp(false);
    }
  };

  // -------------------------
  // SCHEDULE LOGIC
  // -------------------------
  const handleAssignSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleForm.employee_id || !scheduleForm.date) return;
    
    setIsAssigning(true);
    let start_time = '06:00:00';
    let end_time = '14:00:00';
    
    if (scheduleForm.shift_type.includes('Tarde')) {
      start_time = '14:00:00';
      end_time = '22:00:00';
    } else if (scheduleForm.shift_type.includes('Noche')) {
      start_time = '22:00:00';
      end_time = '06:00:00';
    }

    try {
      const { error } = await supabase.from('workforce_schedules').insert([{
        employee_id: scheduleForm.employee_id,
        date: scheduleForm.date,
        shift_type: scheduleForm.shift_type,
        start_time,
        end_time
      }]);

      if (error) throw error;
      
      alert('¡Turno asignado correctamente!');
      fetchSchedules();
    } catch (error) {
      alert('Error al asignar (¿quizás ya tiene un turno ese día?): ' + error.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (window.confirm('¿Eliminar este turno?')) {
      await supabase.from('workforce_schedules').delete().eq('id', id);
      fetchSchedules();
    }
  };

  // -------------------------
  // BULK UPLOAD LOGIC
  // -------------------------
  const downloadTemplate = () => {
    const csvContent = "Nombre Empleado,Fecha (YYYY-MM-DD),Turno\nEjemplo Perez,2026-06-15,Mañana (6 AM - 2 PM)\n";
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Plantilla_Horarios.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      
      const inserts = [];
      let errors = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const separator = line.includes(';') ? ';' : ',';
        const cols = line.split(separator);
        
        if (cols.length < 3) continue;

        const empName = cols[0]?.replace(/['"]/g, '')?.trim();
        const date = cols[1]?.replace(/['"]/g, '')?.trim();
        const shiftType = cols[2]?.replace(/['"]/g, '')?.trim();

        if (!empName || !date || !shiftType) continue; 

        const employee = allEmployees.find(emp => emp.name.toLowerCase() === empName.toLowerCase());
        
        if (!employee) {
          errors.push(`Fila ${i + 1}: No se encontró al empleado "${empName}"`);
          continue;
        }

        let start_time = '06:00:00';
        let end_time = '14:00:00';
        if (shiftType.includes('Tarde')) {
          start_time = '14:00:00';
          end_time = '22:00:00';
        } else if (shiftType.includes('Noche')) {
          start_time = '22:00:00';
          end_time = '06:00:00';
        }

        inserts.push({
          employee_id: employee.id,
          date: date,
          shift_type: shiftType,
          start_time,
          end_time
        });
      }

      if (inserts.length > 0) {
        try {
          const { error } = await supabase.from('workforce_schedules').insert(inserts);
          if (error) throw error;
          
          alert(`¡Éxito! Se subieron ${inserts.length} turnos correctamente.\n${errors.length > 0 ? '\nErrores:\n' + errors.join('\n') : ''}`);
          fetchSchedules();
        } catch (error) {
          alert('Error al subir los turnos: ' + error.message);
        }
      } else {
        alert(`No se encontraron turnos válidos para subir.\n${errors.join('\n')}`);
      }
      
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onerror = () => {
      alert("Error leyendo el archivo.");
      setIsUploading(false);
    };

    reader.readAsText(file);
  };

  const handleExportExcel = async () => {
    try {
      const { data, error } = await supabase
        .from('workforce_attendance')
        .select(`
          clock_in,
          clock_out,
          status,
          employee:workforce_employees (name, role)
        `)
        .order('clock_in', { ascending: false });

      if (error) throw error;

      let csvContent = "Nombre,Rol,Hora de Entrada,Hora de Salida,Estado\n";
      data.forEach(row => {
        const nombre = row.employee?.name || 'Desconocido';
        const rol = row.employee?.role || '';
        const entrada = new Date(row.clock_in).toLocaleString('es-CO');
        const salida = row.clock_out ? new Date(row.clock_out).toLocaleString('es-CO') : 'En curso';
        const estado = row.status;
        csvContent += `"${nombre}","${rol}","${entrada}","${salida}","${estado}"\n`;
      });

      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Reporte_Asistencia_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Error al exportar datos: ' + err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('workforce_user');
    navigate('/login');
  };

  const formatTimeOnly = (dateString) => {
    return new Date(dateString).toLocaleTimeString('es-CO', { 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  // Only show non-admins in the schedule dropdown
  const operarios = allEmployees.filter(e => e.role !== 'Administrador');

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 16px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', marginBottom: '8px' }}>Panel de Control</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Gestión de Asistencia Workforce</p>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
          <LogOut size={18} /> Cerrar Sesión
        </button>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', gap: '12px', marginBottom: '32px', 
        borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', 
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none', // Oculta la scrollbar en Firefox
      }}>
        <button 
          onClick={() => setActiveTab('resumen')}
          className={`btn ${activeTab === 'resumen' ? 'btn-primary' : ''}`}
          style={{ 
            flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.9rem', padding: '10px 16px',
            background: activeTab === 'resumen' ? 'var(--primary)' : 'transparent', 
            color: activeTab === 'resumen' ? 'var(--bg-dark)' : 'white' 
          }}
        >
          <Clock size={16} /> Asistencia en Vivo
        </button>
        <button 
          onClick={() => setActiveTab('horarios')}
          className={`btn ${activeTab === 'horarios' ? 'btn-primary' : ''}`}
          style={{ 
            flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.9rem', padding: '10px 16px',
            background: activeTab === 'horarios' ? 'var(--primary)' : 'transparent', 
            color: activeTab === 'horarios' ? 'var(--bg-dark)' : 'white' 
          }}
        >
          <Calendar size={16} /> Planificar Horarios
        </button>
        <button 
          onClick={() => setActiveTab('personal')}
          className={`btn ${activeTab === 'personal' ? 'btn-primary' : ''}`}
          style={{ 
            flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.9rem', padding: '10px 16px',
            background: activeTab === 'personal' ? 'var(--primary)' : 'transparent', 
            color: activeTab === 'personal' ? 'var(--bg-dark)' : 'white' 
          }}
        >
          <Users size={16} /> Gestión de Personal
        </button>
      </div>

      {/* TAB 1: RESUMEN */}
      {activeTab === 'resumen' && (
        <div className="animate-fade-in">
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            <div className="glass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', background: 'rgba(195, 245, 60, 0.1)', borderRadius: '16px', color: 'var(--primary)' }}>
                  <Users size={24} />
                </div>
                <div>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', fontWeight: '600' }}>Personal en Turno</p>
                  <h2 style={{ fontSize: '1.8rem' }}>{activeEmployees.length} <span style={{fontSize:'1rem', color:'var(--text-dim)'}}>/ {totalEmployees}</span></h2>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <button onClick={handleExportExcel} className="btn btn-primary" style={{ width: '100%', height: '100%' }}>
                <FileSpreadsheet size={24} /> Exportar a Excel
              </button>
            </div>
          </div>

          {/* Active Employees Table */}
          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Personal en Turno Hoy</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Actualizado en vivo
              </span>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <th style={{ padding: '16px 24px', color: 'var(--text-dim)', fontWeight: '600' }}>Nombre</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-dim)', fontWeight: '600' }}>Hora de Entrada</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-dim)', fontWeight: '600' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        No hay empleados en turno actualmente.
                      </td>
                    </tr>
                  ) : (
                    activeEmployees.map(emp => (
                      <tr key={emp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '16px 24px', fontWeight: '500' }}>{emp.employee?.name || 'Desconocido'}</td>
                        <td style={{ padding: '16px 24px' }}>{formatTimeOnly(emp.clock_in)}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600',
                            background: 'rgba(195, 245, 60, 0.1)', color: 'var(--primary)'
                          }}>
                            <CheckCircle size={14} /> En Turno
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HORARIOS */}
      {activeTab === 'horarios' && (
        <div className="animate-fade-in">
          
          <div className="glass-card" style={{ marginBottom: '24px', background: 'rgba(195, 245, 60, 0.05)', border: '1px dashed var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--primary)' }}>Carga Masiva (Mes Completo)</h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Sube todos los turnos desde un archivo Excel (.csv)</p>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button onClick={downloadTemplate} className="btn btn-secondary" style={{ border: '1px solid var(--primary)', color: 'var(--primary)' }}>
                  <Download size={18} /> Descargar Plantilla
                </button>
                <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                  <Upload size={18} /> {isUploading ? 'Subiendo...' : 'Subir Archivo CSV'}
                  <input 
                    type="file" 
                    accept=".csv" 
                    style={{ display: 'none' }} 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ marginBottom: '40px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={20} color="var(--text-main)" /> Asignación Individual
            </h3>
            
            <form onSubmit={handleAssignSchedule} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-dim)' }}>Empleado</label>
                <select 
                  value={scheduleForm.employee_id} 
                  onChange={e => setScheduleForm({...scheduleForm, employee_id: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white' }}
                  required
                >
                  <option value="" disabled>Seleccionar...</option>
                  {operarios.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-dim)' }}>Fecha</label>
                <input 
                  type="date" 
                  value={scheduleForm.date}
                  onChange={e => setScheduleForm({...scheduleForm, date: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-dim)' }}>Turno</label>
                <select 
                  value={scheduleForm.shift_type} 
                  onChange={e => setScheduleForm({...scheduleForm, shift_type: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white' }}
                  required
                >
                  <option value="Mañana (6 AM - 2 PM)">Mañana (6 AM - 2 PM)</option>
                  <option value="Tarde (2 PM - 10 PM)">Tarde (2 PM - 10 PM)</option>
                  <option value="Noche (10 PM - 6 AM)">Noche (10 PM - 6 AM)</option>
                </select>
              </div>

              <button type="submit" className="btn btn-secondary" disabled={isAssigning} style={{ height: '48px' }}>
                {isAssigning ? 'Asignando...' : 'Asignar Uno'}
              </button>
            </form>
          </div>

          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Turnos Programados Recientes</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <th style={{ padding: '16px 24px', color: 'var(--text-dim)', fontWeight: '600' }}>Fecha</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-dim)', fontWeight: '600' }}>Empleado</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-dim)', fontWeight: '600' }}>Turno</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-dim)', fontWeight: '600', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        No hay turnos programados.
                      </td>
                    </tr>
                  ) : (
                    schedules.map(sch => (
                      <tr key={sch.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '16px 24px' }}>{sch.date}</td>
                        <td style={{ padding: '16px 24px', fontWeight: '500' }}>{sch.employee?.name}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ 
                            padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem',
                            background: 'rgba(255,255,255,0.1)'
                          }}>
                            {sch.shift_type}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <button onClick={() => handleDeleteSchedule(sch.id)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '8px' }}>
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PERSONAL */}
      {activeTab === 'personal' && (
        <div className="animate-fade-in">
          
          {/* Register Form */}
          <div className="glass-card" style={{ marginBottom: '40px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={20} color="var(--primary)" /> Registrar Nuevo Empleado
            </h3>
            
            <form onSubmit={handleCreateEmployee} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-dim)' }}>Nombre Completo</label>
                <input 
                  type="text" 
                  value={employeeForm.name}
                  onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})}
                  placeholder="Ej. Juan Perez"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-dim)' }}>Rol</label>
                <select 
                  value={employeeForm.role} 
                  onChange={e => setEmployeeForm({...employeeForm, role: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white' }}
                  required
                >
                  <option value="Operario">Operario (Trabajador)</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-dim)' }}>PIN de Acceso (4 dígitos)</label>
                <input 
                  type="password" 
                  maxLength={4}
                  value={employeeForm.pin}
                  onChange={e => setEmployeeForm({...employeeForm, pin: e.target.value.replace(/\D/g, '')})}
                  placeholder="****"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white' }}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={isCreatingEmp} style={{ height: '48px' }}>
                {isCreatingEmp ? 'Registrando...' : 'Registrar Empleado'}
              </button>
            </form>
          </div>

          {/* Employees List */}
          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Personal Registrado</h3>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <th style={{ padding: '16px 24px', color: 'var(--text-dim)', fontWeight: '600' }}>Nombre</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-dim)', fontWeight: '600' }}>Rol</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-dim)', fontWeight: '600' }}>PIN</th>
                  </tr>
                </thead>
                <tbody>
                  {allEmployees.map(emp => (
                    <tr key={emp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '16px 24px', fontWeight: '500' }}>{emp.name}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ 
                          padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem',
                          background: emp.role === 'Administrador' ? 'rgba(255,255,255,0.2)' : 'rgba(195, 245, 60, 0.1)',
                          color: emp.role === 'Administrador' ? 'white' : 'var(--primary)'
                        }}>
                          {emp.role}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-dim)', letterSpacing: '2px' }}>
                        ****
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
