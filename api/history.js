export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { ECOWITT_API_KEY, ECOWITT_APP_KEY, ECOWITT_MAC } = process.env;

  if (!ECOWITT_API_KEY || !ECOWITT_APP_KEY || !ECOWITT_MAC) {
    return res.status(500).json({ error: 'Missing API credentials' });
  }

  const now = Math.floor(Date.now() / 1000);
  const hoursBack = 72;
  const startTime = now - (hoursBack * 60 * 60);

  const params = new URLSearchParams({
    application_key: ECOWITT_APP_KEY,
    api_key: ECOWITT_API_KEY,
    mac: ECOWITT_MAC,
    start_date: startTime.toString(),
    end_date: now.toString(),
    cycle_type: '30min',
    call_back: 'wind'
  });

  try {
    const response = await fetch(`https://api.ecowitt.net/api/v3/device/history?${params}`);
    const data = await response.json();

    if (data.code !== 0) {
      return res.status(400).json({ error: data.msg || 'API error' });
    }

    const windData = data.data?.wind || {};
    const windSpeed = windData.wind_speed?.list || {};
    const windGust = windData.wind_gust?.list || {};

    const history = Object.keys(windSpeed)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(timestamp => ({
        time: parseInt(timestamp) * 1000,
        speed: parseFloat(windSpeed[timestamp]) || 0,
        gust: parseFloat(windGust[timestamp]) || 0
      }));

    res.status(200).json({
      code: 0,
      data: {
        history,
        unit: windData.wind_speed?.unit || 'kts'
      }
    });
  } catch (error) {
    console.error('History API error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
}
