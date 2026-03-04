const supabase = require('./supabaseClient');

async function debugLastTicket() {
    const { data: tickets, error } = await supabase
        .from('ia_request_queue')
        .select('*')
        .eq('status', 'DONE')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    if (tickets.length > 0) {
        const t = tickets[0];
        console.log(`ID: ${t.id}`);
        console.log(`Prompt: ${t.prompt.substring(0, 100)}...`);
        console.log(`Result: ${t.result}`);
    } else {
        console.log("No tickets found.");
    }
    process.exit(0);
}

debugLastTicket();
