import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qotybwlyzqbrvetvemqo.supabase.co';
const supabaseKey = 'sb_publishable_F4nkJq1CTwITEXq6W6rG6w_qEOVZdRQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const newEmployees = [
    { name: 'Carlos Perez', role: 'Operario', pin: '1111' },
    { name: 'Maria Gomez', role: 'Operario', pin: '2222' },
    { name: 'Luis Martinez', role: 'Operario', pin: '3333' }
  ];

  console.log('Creando empleados...');
  const { data, error } = await supabase
    .from('workforce_employees')
    .insert(newEmployees)
    .select();

  if (error) {
    console.error('Error insertando empleados:', error);
  } else {
    console.log('Empleados creados exitosamente:');
    data.forEach(emp => {
      console.log(`- ${emp.name} (PIN: ${emp.pin})`);
    });
  }
}

seed();
