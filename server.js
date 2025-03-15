const express = require('express');
const cors = require('cors');
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Target Ollama service URL
const OLLAMA_SERVICE_URL = 'https://ollama-bb-bot-753741223620.us-central1.run.app/api/chat';
// Target audience for authentication
const targetAudience = 'https://ollama-bb-bot-753741223620.us-central1.run.app';

// Initialize Google Auth
const auth = new GoogleAuth();
// Route to proxy requests to Ollama API with streaming
app.post('/chat', async (req, res) => {
  try {
    console.log('Received request:', req.body);
    const userMessage = req.body.message;
    
    if (!userMessage) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get ID token
    const client = await auth.getIdTokenClient(targetAudience);
    const token = await client.idTokenProvider.fetchIdToken(targetAudience);
    
    // Create request payload with stream: true
    const requestPayload = {
      model: 'bb-bot',
      messages: [{ role: 'user', content: userMessage }],
      stream: true
    };
    
    // Set response headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Use axios for the streaming request
    const response = await axios({
      method: 'POST',
      url: OLLAMA_SERVICE_URL,
      data: requestPayload,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      responseType: 'stream'
    });
    
    console.log('Stream connection established');
    
    // Handle the streaming response
    response.data.on('data', (chunk) => {
      // Process each chunk (could be multiple JSON objects or partial)
      const chunkStr = chunk.toString();
      
      // Split by newlines in case multiple JSON objects are in one chunk
      const jsonLines = chunkStr.split('\n').filter(line => line.trim());
      
      jsonLines.forEach(jsonLine => {
        try {
          // Send each complete JSON object as a separate chunk
          res.write(jsonLine + '\n');
        } catch (e) {
          console.warn('Error processing chunk:', e.message);
        }
      });
    });
    
    response.data.on('end', () => {
      console.log('Stream ended');
      res.end();
    });
    
    response.data.on('error', (err) => {
      console.error('Stream error:', err);
      res.end();
    });
    
  } catch (error) {
    console.error('Error details:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      return res.status(error.response.status).json({ 
        error: 'API error', 
        details: error.response.data 
      });
    }
    
    res.status(500).json({ error: 'Failed to communicate with Ollama API', message: error.message });
  }
});

// Simple health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running',
    environment: process.env.NODE_ENV || 'production' 
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port} in ${process.env.NODE_ENV || 'production'} mode`);
});