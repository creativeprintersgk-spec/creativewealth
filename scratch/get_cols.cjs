require('dotenv').config();
const {createClient} = require('@supabase/supabase-js');

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const q = `
CREATE OR REPLACE FUNCTION get_table_columns() RETURNS json AS $$ 
BEGIN 
  RETURN (
    SELECT json_object_agg(table_name, columns) 
    FROM (
      SELECT table_name, json_agg(column_name) as columns 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      GROUP BY table_name
    ) t
  ); 
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

s.rpc('exec_sql', { query: q }).then(r => {
  if(r.error) {
    console.error(r.error);
  } else {
    s.rpc('get_table_columns').then(res => {
      console.log(JSON.stringify(res.data, null, 2));
    });
  }
});
