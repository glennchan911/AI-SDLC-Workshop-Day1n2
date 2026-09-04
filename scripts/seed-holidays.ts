import { holidayDB } from '../lib/db';

// Singapore public holidays 2026-2027
const singaporeHolidays = [
  // 2026
  { date: '2026-01-01', name: 'New Year\'s Day' },
  { date: '2026-02-10', name: 'Chinese New Year' },
  { date: '2026-02-11', name: 'Chinese New Year (in lieu)' },
  { date: '2026-04-10', name: 'Good Friday' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-05-24', name: 'Vesak Day' },
  { date: '2026-07-04', name: 'Hari Raya Puasa' },
  { date: '2026-08-09', name: 'National Day' },
  { date: '2026-09-02', name: 'Hari Raya Haji' },
  { date: '2026-11-14', name: 'Deepavali' },
  { date: '2026-12-25', name: 'Christmas Day' },

  // 2027
  { date: '2027-01-01', name: 'New Year\'s Day' },
  { date: '2027-01-30', name: 'Chinese New Year' },
  { date: '2027-01-31', name: 'Chinese New Year' },
  { date: '2027-02-01', name: 'Chinese New Year (in lieu)' },
  { date: '2027-03-29', name: 'Good Friday' },
  { date: '2027-05-01', name: 'Labour Day' },
  { date: '2027-05-13', name: 'Vesak Day' },
  { date: '2027-06-23', name: 'Hari Raya Puasa' },
  { date: '2027-08-09', name: 'National Day' },
  { date: '2027-08-21', name: 'Hari Raya Haji' },
  { date: '2027-11-04', name: 'Deepavali' },
  { date: '2027-12-25', name: 'Christmas Day' },

  // 2028
  { date: '2028-01-01', name: 'New Year\'s Day' },
  { date: '2028-02-19', name: 'Chinese New Year' },
  { date: '2028-02-20', name: 'Chinese New Year' },
  { date: '2028-02-21', name: 'Chinese New Year (in lieu)' },
  { date: '2028-04-10', name: 'Good Friday' },
  { date: '2028-05-01', name: 'Labour Day' },
  { date: '2028-05-03', name: 'Vesak Day' },
  { date: '2028-06-12', name: 'Hari Raya Puasa' },
  { date: '2028-08-09', name: 'National Day' },
  { date: '2028-08-10', name: 'Hari Raya Haji' },
  { date: '2028-10-24', name: 'Deepavali' },
  { date: '2028-12-25', name: 'Christmas Day' },
];

console.log(`🌍 Seeding ${singaporeHolidays.length} Singapore holidays...`);

let created = 0;
let skipped = 0;

for (const holiday of singaporeHolidays) {
  const result = holidayDB.create(holiday.date, holiday.name);
  if (result) {
    created++;
  } else {
    skipped++;
  }
}

console.log(`✅ Seeding complete: ${created} created, ${skipped} skipped (already exist)`);
