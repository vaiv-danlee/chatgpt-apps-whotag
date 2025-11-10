import { SearchResponse, InfluencerProfile, ImageResponse } from '../types.js';
import { getAccessToken } from './auth.js';

export async function searchInfluencers(query: string): Promise<SearchResponse> {
  const token = await getAccessToken();
  
  const response = await fetch('https://dev.whotag.ai/api/v1/influencers/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: query,
    }),
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

export async function getInfluencerBatch(userIds: string[]): Promise<InfluencerProfile[]> {
  const token = await getAccessToken();
  
  const response = await fetch('https://dev.whotag.ai/api/v1/influencers/search/info/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      influencers: userIds,
    }),
  });

  if (!response.ok) {
    throw new Error(`Batch fetch failed: ${response.status}`);
  }

  const data = await response.json();
  return data.item || [];
}

export async function getRepresentativeImages(userId: string): Promise<ImageResponse['item']> {
  const token = await getAccessToken();
  
  const response = await fetch(
    `https://dev.whotag.ai/api/v1/influencers/images/${userId}/representative/url`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    console.error(`Failed to fetch images for ${userId}`);
    return [];
  }

  const data = await response.json();
  return data.item || [];
}
