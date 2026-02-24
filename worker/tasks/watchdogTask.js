const supabase = require('../supabaseClient');

// How many minutes a ticket can be in PROCESSING before considered a deadlock
const STUCK_THRESHOLD_MINUTES = parseInt(process.env.WATCHDOG_STUCK_THRESHOLD_MINUTES || '5', 10);

module.exports = {
    delayMs: 60000, // Check every 60 seconds

    execute: async function () {
        const thresholdDate = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();

        // Find all tickets stuck in PROCESSING for more than the threshold
        const { data: stuckTickets, error: fetchError } = await supabase
            .from('ia_request_queue')
            .select('id, created_at, updated_at')
            .eq('status', 'PROCESSING')
            .lt('updated_at', thresholdDate);

        if (fetchError) {
            console.error('[Watchdog] Error querying stuck tickets:', fetchError.message);
            return;
        }

        if (!stuckTickets || stuckTickets.length === 0) {
            console.log(`[Watchdog] ✅ Queue clean, no stuck tickets found.`);
            return;
        }

        console.log(`[Watchdog] ⚠️ Found ${stuckTickets.length} stuck ticket(s) in PROCESSING. Resetting to PENDING...`);

        for (const ticket of stuckTickets) {
            const { error: resetError } = await supabase
                .from('ia_request_queue')
                .update({
                    status: 'PENDING',
                    error_msg: `[AUTO-RESET by Watchdog] Was stuck in PROCESSING for over ${STUCK_THRESHOLD_MINUTES} minutes at ${new Date().toISOString()}`,
                    updated_at: new Date()
                })
                .eq('id', ticket.id)
                .eq('status', 'PROCESSING'); // Safe guard, only reset if still PROCESSING

            if (resetError) {
                console.error(`[Watchdog] Error resetting ticket ${ticket.id}:`, resetError.message);
            } else {
                console.log(`[Watchdog] 🔄 Reset ticket ${ticket.id.substring(0, 8)} back to PENDING.`);
            }
        }
    }
};
