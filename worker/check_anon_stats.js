const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://slinivfmdprzmlhdqqwu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsaW5pdmZtZHByem1saGRxcXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1Nzg3MjAsImV4cCI6MjA4NzE1NDcyMH0.ieyOhIogMB9eKjF58LOaZz8nBKX0-WNDutfj8Q73IFc';

async function check() {
    console.log('Checking media_stats table as ANON...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
        .from('media_stats')
        .select('*');

    if (error) {
        console.error('Error fetching stats as ANON:', error.message);
        return;
    }

    console.log(`Found ${data.length} records in media_stats as ANON.`);
}

check();
