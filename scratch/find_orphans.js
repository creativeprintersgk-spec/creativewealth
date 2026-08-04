import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const ids = [27, 66, 14, 30, 45, 70, 77, 93, 105, 140];
  
  for (const tableName of ['transc1', 'trans1']) {
      const { data: allTrans } = await supabase
          .from(tableName)
          .select('vid')
          .in('maid', ids);
          
      const uniqueVids = [...new Set(allTrans?.map(t => t.vid) || [])];
      
      if (uniqueVids.length > 0) {
          let unbalancedVids = [];
          const chunkSize = 100;
          for (let i = 0; i < uniqueVids.length; i += chunkSize) {
              const chunk = uniqueVids.slice(i, i + chunkSize);
              const { data: vchTrans } = await supabase
                  .from(tableName)
                  .select('vid, cramt, dramt, maid, dt')
                  .in('vid', chunk);
                  
              if (vchTrans) {
                  const vchMap = {};
                  vchTrans.forEach(t => {
                      if (!vchMap[t.vid]) vchMap[t.vid] = { cramt: 0, dramt: 0, lines: 0, entries: [] };
                      vchMap[t.vid].cramt += (Number(t.cramt) || 0);
                      vchMap[t.vid].dramt += (Number(t.dramt) || 0);
                      vchMap[t.vid].lines += 1;
                      vchMap[t.vid].entries.push(t);
                  });
                  
                  for (const [vid, sums] of Object.entries(vchMap)) {
                      if (Math.abs(sums.cramt - sums.dramt) > 0.01) {
                          unbalancedVids.push({ vid, ...sums });
                      }
                  }
              }
          }
          
          console.log(`\nFound ${unbalancedVids.length} unbalanced ${tableName} vouchers.`);
          if (unbalancedVids.length > 0) {
              unbalancedVids.forEach(u => {
                  console.log(`Unbalanced ${tableName}: vid=${u.vid}`);
                  u.entries.forEach(e => {
                      if (ids.includes(e.maid)) {
                          console.log(`  -> maid=${e.maid}, dt=${e.dt}, cramt=${e.cramt}, dramt=${e.dramt}`);
                      }
                  });
              });
          }
      }
  }
}

run().catch(console.error);
