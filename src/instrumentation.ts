export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const pingUrl = process.env.PING_URL || process.env.NEXT_PUBLIC_APP_URL
    if (pingUrl) {
      console.log(`[Self-Ping] Starting self-ping cron for ${pingUrl} every 10 minutes.`)
      
      // Ping immediately on start
      try {
        fetch(pingUrl).catch(() => {});
      } catch {}

      setInterval(async () => {
        try {
          const res = await fetch(pingUrl)
          console.log(`[Self-Ping] Ping sent to ${pingUrl}. Status: ${res.status}`)
        } catch (err) {
          console.error(`[Self-Ping] Failed to ping ${pingUrl}:`, err)
        }
      }, 10 * 60 * 1000) // 10 minutes
    }
  }
}
