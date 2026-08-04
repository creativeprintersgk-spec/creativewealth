/**
 * Check Krisha's (acid=32) acmac1 group hierarchy — why type=UNKNOWN
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log('=== KRISHA (acid=32) GROUP HIERARCHY ANALYSIS ===\n');

  // Get ALL acmac1 rows
  let all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from('acmac1').select('*').order('id').range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  console.log(`Total acmac1 rows: ${all.length}`);

  const KRISHA_ACID = 32;
  const krishaRows = all.filter((a: any) => Number(a.acid) === KRISHA_ACID);
  const krishaGroups = krishaRows.filter((a: any) => a.is_group);

  console.log(`Krisha groups (acid=32): ${krishaGroups.length}\n`);

  // Show top-level groups (no parent, or parent not in Krisha's groups)
  const krishaGroupIds = new Set(krishaGroups.map((g: any) => g.id));
  const topLevelGroups = krishaGroups.filter((g: any) => !g.parent || !krishaGroupIds.has(g.parent));

  console.log('--- Top-Level Groups for Krisha ---');
  topLevelGroups.forEach((g: any) => {
    console.log(`  id=${g.id} name="${g.name}" type=${g.type} parent=${g.parent} acid=${g.acid}`);
  });

  // Check if top-level groups have the 'type' set
  const groupsWithType = krishaGroups.filter((g: any) => g.type);
  const groupsWithoutType = krishaGroups.filter((g: any) => !g.type);
  console.log(`\nGroups WITH type: ${groupsWithType.length}`);
  console.log(`Groups WITHOUT type: ${groupsWithoutType.length}`);

  if (groupsWithType.length > 0) {
    console.log('\nGroups that have type set:');
    groupsWithType.slice(0, 10).forEach((g: any) => {
      console.log(`  id=${g.id} name="${g.name}" type=${g.type} parent=${g.parent}`);
    });
  }

  // Compare with a WORKING acid (e.g., acid=31 Saahil) to see how their groups look
  const saahilGroups = all.filter((a: any) => Number(a.acid) === 31 && a.is_group);
  const saahilWithType = saahilGroups.filter((g: any) => g.type);
  console.log(`\nSaahil (acid=31) groups: ${saahilGroups.length}, with type: ${saahilWithType.length}`);

  console.log('\nSaahil top-level groups:');
  const saahilGroupIds = new Set(saahilGroups.map((g: any) => g.id));
  saahilGroups.filter((g: any) => !g.parent || !saahilGroupIds.has(g.parent)).slice(0, 10).forEach((g: any) => {
    console.log(`  id=${g.id} name="${g.name}" type=${g.type} parent=${g.parent}`);
  });

  // Sample the Capital Account ledger (maid=230) for Krisha to see its groupId
  const cap230 = all.find((a: any) => a.id === 230 && Number(a.acid) === KRISHA_ACID);
  console.log('\nKrisha Capital Account (maid=230):');
  console.log(JSON.stringify(cap230, null, 2));

  if (cap230?.groupId) {
    const capGroup = all.find((a: any) => a.id === cap230.groupId);
    console.log(`\nCapital Account group (id=${cap230.groupId}):`);
    console.log(JSON.stringify(capGroup, null, 2));

    if (capGroup?.parent) {
      const parentGroup = all.find((a: any) => a.id === capGroup.parent);
      console.log(`\nParent group (id=${capGroup.parent}):`);
      console.log(JSON.stringify(parentGroup, null, 2));
    }
  }

  // Also check: what parent IDs do Krisha's top-level groups reference?
  console.log('\n--- Krisha top-level groups parent references ---');
  topLevelGroups.forEach((g: any) => {
    if (g.parent) {
      const parentRow = all.find((a: any) => a.id === g.parent);
      console.log(`  Group "${g.name}" (id=${g.id}) → parent=${g.parent} → found=${parentRow ? `"${parentRow.name}" type=${parentRow.type} acid=${parentRow.acid}` : 'NOT FOUND'}`);
    } else {
      console.log(`  Group "${g.name}" (id=${g.id}) → no parent (root group) type=${g.type}`);
    }
  });
}

run().catch(console.error);
