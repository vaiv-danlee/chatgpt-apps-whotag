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

export async function getProfileImage(userId: string): Promise<{ user_id: string; image_url: string } | null> {
  const token = await getAccessToken();

  const response = await fetch(
    `https://dev.whotag.ai/api/v1/influencers/images/${userId}/profile/url`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    console.error(`Failed to fetch profile image for ${userId}, status: ${response.status}`);
    return null;
  }

  const data = await response.json();
  if (data.item && data.item.image_url) {
    return {
      user_id: userId,
      image_url: data.item.image_url
    };
  }

  return null;
}

export async function getGridImages(userId: string): Promise<ImageResponse['item']> {
  const token = await getAccessToken();

  console.error(`\n>>> Calling grid API for user: ${userId}`);
  const response = await fetch(
    `https://dev.whotag.ai/api/v1/influencers/images/${userId}/grid/url`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    console.error(`!!! Failed to fetch grid images for ${userId}, status: ${response.status}`);
    return [];
  }

  const data = await response.json();
  console.error(`>>> Grid API response:`, JSON.stringify(data, null, 2));

  // Grid API returns a single object with image_url, wrap it in an array
  if (data.item && data.item.image_url) {
    const result = [{
      post_id: data.item.user_id || userId,
      image_url: data.item.image_url
    }];
    console.error(`>>> Returning grid images:`, result);
    return result;
  }

  console.error(`>>> No grid image found in response`);
  return [];
}
