const supabase = require('./supabaseClient');

async function check() {
    console.log('Checking media_stats table...');
    const { data, error } = await supabase
        .from('media_stats')
        .select('*');

    if (error) {
        console.error('Error fetching stats:', error.message);
        return;
    }

    console.log(`Found ${data.length} records in media_stats.`);
    if (data.length > 0) {
        console.log('First record sample:', JSON.stringify(data[0], null, 2));
    }
}

check();
