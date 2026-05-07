const cronParser = require('cron-parser');

const COLOMBIA_TZ = 'America/Bogota';

function shouldRun(cron, lastRun, now) {
  try {
    const options = { 
      currentDate: now,
      tz: COLOMBIA_TZ 
    };
    
    const interval = cronParser.CronExpressionParser.parse(cron, options);
    const lastScheduledRun = interval.prev().toDate();
    const lastRunDate = lastRun ? new Date(lastRun) : new Date(0);

    console.log(`Cron: ${cron}`);
    console.log(`Now: ${now.toISOString()} (${now.toLocaleString('es-CO', { timeZone: COLOMBIA_TZ })})`);
    console.log(`Last Scheduled: ${lastScheduledRun.toISOString()} (${lastScheduledRun.toLocaleString('es-CO', { timeZone: COLOMBIA_TZ })})`);
    console.log(`Last Run: ${lastRunDate.toISOString()}`);
    console.log(`Should run: ${lastRunDate < lastScheduledRun}`);
    console.log('---');
    
    return lastRunDate < lastScheduledRun;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return false;
  }
}

// Test cases
const now = new Date('2026-05-06T15:00:00-05:00'); // 3:00 PM Colombia

console.log('Test 1: Schedule at 12:35 PM, Last run at 11:00 AM');
shouldRun('35 12 * * *', '2026-05-06T11:00:00-05:00', now);

console.log('Test 2: Schedule at 12:35 PM, Last run at 12:40 PM');
shouldRun('35 12 * * *', '2026-05-06T12:40:00-05:00', now);

console.log('Test 3: Schedule at 11:35 and 17:35, Last run yesterday');
shouldRun('35 11,17 * * *', '2026-05-05T18:00:00-05:00', now);
