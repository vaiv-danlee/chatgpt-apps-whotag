import * as dotenv from 'dotenv';
dotenv.config();

interface TokenCache {
  token: string;
  expiresAt: Date;
}

let tokenCache: TokenCache | null = null;

export async function getAccessToken(): Promise<string> {
  // 캐시된 토큰이 유효하면 반환
  if (tokenCache && tokenCache.expiresAt > new Date()) {
    console.error('Using cached token');
    return tokenCache.token;
  }

  console.error('Fetching new access token...');
  
  try {
    const response = await fetch('https://dev.whotag.ai/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: process.env.WHOTAG_USERNAME,
        password: process.env.WHOTAG_PASSWORD,
      }),
    });

    if (!response.ok) {
      throw new Error(`Auth failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.code !== 'SUCCESS') {
      throw new Error(`Auth failed: ${data.message}`);
    }

    // 토큰 캐시 (만료 1분 전에 갱신)
    tokenCache = {
      token: data.item.access_token,
      expiresAt: new Date(Date.now() + (data.item.expires_in - 60) * 1000),
    };

    console.error('Token acquired successfully');
    return tokenCache.token;
  } catch (error) {
    console.error('Failed to get access token:', error);
    throw error;
  }
}
