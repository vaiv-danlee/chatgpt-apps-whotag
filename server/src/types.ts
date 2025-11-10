export interface SearchResponse {
  code: string;
  item: {
    origin_query: string;
    conversation_id: string;
    total_count: number;
    influencers: string[];
    search_summary: string;
    suggestions: string[];
  };
  message: string;
  timestamp: string;
}

export interface InfluencerProfile {
  profile: {
    user_id: string;
    username: string;
    full_name: string;
    biography: string;
    category_name: string;
    engagement_rate: number;
    engagement_rate_tag: string;
    followed_by: number;
    follows: number;
    media_count: number;
    account_status: string;
    crawl_date: string;
    external_url: string;
    profile_pic_url: string;
    viral_reach_rate: number;
    viral_reach_rate_tag: string;
    related_accounts: string[];
    bio_hashtags: string[];
  };
  general: {
    user_id: string;
    account_type: string;
    account_type_reason: string | null;
    region: string[];
    country: string[];
    language: string[];
    interests: string[];
    interests_in_detail: string[];
    field_of_creator: string[];
    field_of_creator_reason: string | null;
    hobbies: string[];
    age_range: string;
    gender: string;
    ethnicity: string;
    ethnic_category: string;
    marital_status: string;
    has_children: boolean;
    child_age: string[];
    lifestage: string;
    pets: boolean;
    pets_type: string[];
    occupation: string;
    occupation_reason: string | null;
    personality: string[];
    personality_reason: string | null;
    physical_appearance_desc: string;
    inferred_lifestyle: string;
    description: string;
    short_bio: string;
    demo_short: string;
    keywords_for_brand: string[];
    tag_brand: string[];
    collaborate_brand: string[];
    collaboration_tier: string;
    collaboration_tier_reason: string | null;
    willing_to_collaborate: boolean;
    note_for_brand_collaborate_point: string[];
    note_for_brand_weak_point: string[];
    content_hashtags: string[];
    representative_images: string[];
    creator_identity_profile: string;
    influencer_comprehensive_desc: string;
    title: string;
    luxury_consumption: boolean;
    luxury_consumption_reason: string | null;
    kinterest: boolean;
    kinterest_reason: string | null;
  };
  beauty?: {
    user_id: string;
    beauty_creator_desc: string;
    skin_tone: string;
    skin_type: string[];
    skin_concerns: string[];
    skin_concerns_in_detail: string[];
    personal_color: string;
    personal_color_detailed: string;
    hair_type: string;
    hair_length_status: string;
    hair_color: string | null;
    hair_color_history: string[];
    hair_concerns: string[];
    hair_items: string[];
    beauty_brands: string[];
    beauty_products: string[];
    makeup_items: string[];
    skincare_items: string[];
    skincare_ingredients: string[];
    beauty_tools_usage: string[];
    beauty_tools_categories: string[];
    beauty_tools_brands: string[];
    makeup_interests: string[];
    makeup_points: string[];
    makeup_color_preferences: string[];
    makeup_hashtags: string[];
    beauty_content_types: string[];
    beauty_review_focus: string[];
    beauty_interest_areas: string[];
    purchase_channels: string[];
    aesthetic_keywords: string[];
    brand_tier_segments: string;
    brand_positioning_segments: string;
    kbeauty_products: string[];
  };
  links?: {
    user_id: string;
    links: Array<{
      platform: string;
      channel: string | null;
      type: string;
      updated_at: string;
      urls: string[];
    }>;
    has_links: boolean;
    total_link_count: number;
  };
  user_id: string;
  is_in_my_bucket: null | boolean;
}

export interface ImageResponse {
  code: string;
  item: Array<{
    post_id: string;
    image_url: string;
  }>;
}
