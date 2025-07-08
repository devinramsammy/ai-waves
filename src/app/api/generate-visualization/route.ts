import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const requestHistory = new Map<string, number[]>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per 1 minute
const MIN_REQUEST_INTERVAL = 1000; // 1 seconds between requests
const MAX_PROMPT_LENGTH = 200;
const DAILY_TOKEN_LIMIT = 50000;

let dailyTokenUsage = 0;
let lastResetDate = new Date().toDateString();

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || real || 'unknown';
}

function checkRateLimit(clientIP: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  
  rateLimitMap.forEach((value, key) => {
    if (value.resetTime < now) {
      rateLimitMap.delete(key);
    }
  });
  
  const clientData = rateLimitMap.get(clientIP);
  if (clientData && clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    const timeLeft = Math.ceil((clientData.resetTime - now) / 1000 / 60);
    return { 
      allowed: false, 
      message: `Rate limit exceeded. Try again in ${timeLeft} minutes.` 
    };
  }
  
  const history = requestHistory.get(clientIP) || [];
  const recentRequests = history.filter(time => time > now - MIN_REQUEST_INTERVAL);
  if (recentRequests.length > 0) {
    const timeLeft = Math.ceil((MIN_REQUEST_INTERVAL - (now - recentRequests[0])) / 1000);
    return { 
      allowed: false, 
      message: `Please wait ${timeLeft} seconds between requests.` 
    };
  }
  
  return { allowed: true };
}

function updateRateLimit(clientIP: string) {
  const now = Date.now();
  const resetTime = now + RATE_LIMIT_WINDOW;
  
  const clientData = rateLimitMap.get(clientIP);
  if (clientData) {
    clientData.count++;
  } else {
    rateLimitMap.set(clientIP, { count: 1, resetTime });
  }
  
  const history = requestHistory.get(clientIP) || [];
  history.push(now);
  if (history.length > 10) {
    history.shift();
  }
  requestHistory.set(clientIP, history);
}

function validatePrompt(prompt: string): { valid: boolean; message?: string } {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, message: 'Prompt is required and must be a string' };
  }

  
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return { valid: false, message: `Prompt must be less than ${MAX_PROMPT_LENGTH} characters` };
  }
  
  const suspiciousPatterns = [
    /javascript:/i,
    /<script/i,
    /eval\(/i,
    /function\s*\(/i,
    /=>\s*{/,
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(prompt)) {
      return { valid: false, message: 'Prompt contains potentially unsafe content' };
    }
  }
  
  return { valid: true };
}

function checkDailyTokenLimit(): { allowed: boolean; message?: string } {
  const today = new Date().toDateString();
  
  if (lastResetDate !== today) {
    dailyTokenUsage = 0;
    lastResetDate = today;
  }
  
  if (dailyTokenUsage >= DAILY_TOKEN_LIMIT) {
    return { 
      allowed: false, 
      message: 'Daily token limit reached. Please try again tomorrow.' 
    };
  }
  
  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const clientIP = getClientIP(request);
    
    const rateLimitCheck = checkRateLimit(clientIP);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { error: rateLimitCheck.message },
        { status: 429 }
      );
    }
    
    const tokenLimitCheck = checkDailyTokenLimit();
    if (!tokenLimitCheck.allowed) {
      return NextResponse.json(
        { error: tokenLimitCheck.message },
        { status: 429 }
      );
    }

    const { prompt } = await request.json();
    
    const promptValidation = validatePrompt(prompt);
    if (!promptValidation.valid) {
      return NextResponse.json(
        { error: promptValidation.message },
        { status: 400 }
      );
    }

    updateRateLimit(clientIP);

    const systemPrompt = `You are an expert at creating audio-reactive visualizations using HTML5 Canvas and JavaScript.

Generate JavaScript code for a visualization based on this description: "${prompt}"

Requirements:
1. Only return the drawing logic - NO component wrapper, imports, or exports
2. Use these exact parameters: (ctx, frequencyData, canvas, timeRef)
3. frequencyData is Uint8Array with frequency values 0-255
4. timeRef.current is timestamp in milliseconds
5. Use only safe Canvas 2D operations and Math functions
6. Make it audio-reactive - use frequencyData to drive animations
7. Include proper 3D perspective, colors, and smooth animations
8. Create something visually interesting that matches the description
9. Use canvas.width and canvas.height for screen dimensions
10. No external dependencies or unsafe operations
11. Do not include code back ticks, only the raw string
12. If any variables are created, only reference those. Do not assume any are created. For instance: normalizedFreq isn't defined even though it is in the example structure.

Example structure:
\`\`\`
// Clear or set background if needed
ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Your visualization logic here
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;

// Use frequencyData to make it reactive
const averageFreq = frequencyData.reduce((sum, val) => sum + val, 0) / frequencyData.length;
const normalizedFreq = averageFreq / 255;

// Draw your visualization
ctx.strokeStyle = \`hsl(\${timeRef.current * 0.1 % 360}, 70%, 60%)\`;
// ... more drawing code
\`\`\`

Return only the raw JavaScript code, no markdown formatting or explanations.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Create a visualization: ${prompt}`
          }
        ],
        max_tokens: 1500, // Reduced from 1500 to save tokens
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generatedCode = data.choices[0]?.message?.content;

    if (!generatedCode) {
      throw new Error('No code generated by AI');
    }

    // Track token usage
    const tokensUsed = data.usage?.total_tokens || 1000; // Estimate if not provided
    dailyTokenUsage += tokensUsed;

    // Basic validation - ensure it looks like JavaScript code
    if (!generatedCode.includes('ctx') || !generatedCode.includes('frequencyData')) {
      throw new Error('Generated code does not appear to be a valid visualization');
    }

    return NextResponse.json({
      code: generatedCode.trim(),
      prompt: prompt,
      timestamp: new Date().toISOString(),
      tokensUsed: tokensUsed,
      remainingTokens: Math.max(0, DAILY_TOKEN_LIMIT - dailyTokenUsage),
    });

  } catch (error) {
    console.error('Visualization generation error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        fallback: true 
      },
      { status: 500 }
    );
  }
} 