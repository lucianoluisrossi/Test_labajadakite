export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { ECOWITT_API_KEY, ECOWITT_APP_KEY, ECOWITT_MAC } = process.env;

  if (!ECOWITT_API_KEY || !ECOWITT_APP_KEY || !ECOWITT_MAC) {
    return res.status(500).json({ code: -1, error: 'Missing API credentials' });
  }

  // Formato de fecha YYYY-MM-DD HH:MM:SS
  const now = new Date();
  const startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const params = new URLSearchParams({
    application_key: ECOWITT_APP_KEY,
    api_key: ECOWITT_API_KEY,
    mac: ECOWITT_MAC,
    start_date: formatDate(startDate),
    end_date: formatDate(now),
    cycle_type: '30min',
    call_back: 'outdoor,wind'
  });

  try {
    const response = await fetch(`https://api.ecowitt.net/api/v3/device/history?${params}`);
    const data = await response.json();

    if (data.code !== 0) {
      return res.status(400).json({ 
        code: data.code, 
        error: data.msg || 'API error'
      });
    }

    const windData = data.data?.wind || {};
    const windSpeed = windData.wind_speed?.list || {};
    const windGust = windData.wind_gust?.list || {};

    if (Object.keys(windSpeed).length === 0) {
      return res.status(200).json({
        code: 0,
        data: { history: [], unit: 'kts' }
      });
    }

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
    console.error('History API error:', error.message);
    res.status(500).json({ code: -1, error: 'Failed to fetch history' });
  }
}
