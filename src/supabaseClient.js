import { createClient } from '@supabase/supabase-js';

// Usaremos el mismo proyecto de Supabase que tienes para MoneyFlow, 
// pero con las nuevas tablas específicas para Workforce.
const supabaseUrl = 'https://qotybwlyzqbrvetvemqo.supabase.co';
const supabaseKey = 'sb_publishable_F4nkJq1CTwITEXq6W6rG6w_qEOVZdRQ';

export const supabase = createClient(supabaseUrl, supabaseKey);
