const NLPCloudClient = require('nlpcloud');

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // Verify API key exists
  const apiKey = process.env.NLPCLOUD_API_KEY;
  if (!apiKey) {
    console.error('Missing NLP Cloud API key');
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Server configuration error - missing API key'
      })
    };
  }

  try {
    const { action, text } = JSON.parse(event.body);
    const client = new NLPCloudClient({
      model: 'finetuned-llama-3-70b',
      token: apiKey,
      gpu: true
    });

    let result;

    switch (action) {
      case 'summarize':
        result = await client.summarization({
          text: text,
          size: 'small'
        });
        break;
        
      case 'expand':
        result = await client.generation({
          text: `Expand on this idea: ${text}`,
          max_length: 250
        });
        break;
        
      case 'draft':
        result = await client.generation({
          text: `Write about: ${text}`,
          max_length: 400
        });
        break;
        
      default:
        throw new Error('Invalid action');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result.data)
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({ 
        error: error.message,
        details: error.response?.data || 'Internal server error'
      })
    };
  }
};
